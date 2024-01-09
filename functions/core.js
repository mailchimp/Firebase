const crypto = require("crypto");
const assert = require("assert");
const _ = require("lodash");
const { logger } = require("firebase-functions");
const { Timestamp } = require("firebase-admin/firestore");
const mailchimp = require("@mailchimp/mailchimp_marketing");
const jmespath = require("jmespath");
const { readConfig } = require("./read-config");
const logs = require("./logs");

/**
 * @type {import("./read-config").Config}
 */
const config = {};

function processConfig(configInput) {
  Object.assign(config, readConfig(configInput, logger));
}

/**
 * MD5 hashes the email address, for use as the mailchimp identifier
 * @param {string} email
 * @returns {string} The MD5 Hash
 */
function subscriberHasher(email) {
  return crypto.createHash("md5").update(email.toLowerCase()).digest("hex");
}

/**
 * Extracts the subscriber email from a document, based on a string path.
 *  Uses lodash's "get" function.
 * @param {any} prevDoc
 * @param {any} newDoc
 * @param {string} emailPath
 * @returns {string} the subscribers email
 */
function getSubscriberEmail(prevDoc, newDoc, emailPath) {
  return _.get(prevDoc, emailPath, false) || _.get(newDoc, emailPath);
}

/**
 * Uses JMESPath to retrieve a value from a document.
 * @param {any} doc
 * @param {string | { documentPath: string }} documentPathOrConfig
 * @param {string} defaultValue
 * @returns
 */
function resolveValueFromDocumentPath(doc, documentPathOrConfig, defaultValue = undefined) {
  const documentSelector = _.isObject(documentPathOrConfig)
    ? documentPathOrConfig.documentPath
    : documentPathOrConfig;
  return jmespath.search(doc, documentSelector) ?? defaultValue;
}

/**
 * Determines a period to wait, based on an exponential backoff function.
 * @param {number} attempt
 * @returns {Promise<void>}
 */
async function wait(attempt) {
  const random = Math.random() + 1;
  const factor = 2;
  const minTimeout = 500;
  const maxTimeout = 2000;
  const time = Math.min(random * minTimeout * factor ** attempt, maxTimeout);
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, time));
}

/**
 * Converts a Firestore Timestamp type to YYYY-MM-DD format
 * @param {import('firebase-admin').firestore.Timestamp} timestamp
 * @returns {string} The date in string format.
 */
function convertTimestampToMailchimpDate(timestamp) {
  assert(timestamp instanceof Timestamp, `Value ${timestamp} is not a Timestamp`);
  const timestampDate = timestamp.toDate();
  const padNumber = (number) => _.padStart(number, 2, "0");
  return `${timestampDate.getUTCFullYear()}-${padNumber(
    timestampDate.getUTCMonth() + 1,
  )}-${padNumber(timestampDate.getUTCDate())}`;
}

/**
 * Attempts the provided function
 * @template T
 * @param {() => Promise<T>} fn The function to try with retries
 * @param {(err: any) => boolean} errorFilter Return true to retry this error (optional).
 *  Default is to retry all errors.
 * @returns {Promise<T>} The response of the function or the first error thrown.
 */
async function retry(fn, errorFilter) {
  let attempt = 0;
  let firstError = null;
  const retries = Math.max(0, parseInt(config.mailchimpRetryAttempts || "0", 10));
  do {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await fn();
      if (attempt !== 0) {
        logs.subsequentAttemptRecovered(attempt, retries);
      }
      return result;
    } catch (err) {
      if (errorFilter && !errorFilter(err)) {
        throw err;
      }

      if (!firstError) firstError = err;
      logs.attemptFailed(attempt, retries);
      attempt += 1;
      if (attempt <= retries) {
        // eslint-disable-next-line no-await-in-loop
        await wait(attempt);
      }
    }
  } while (attempt <= retries);

  throw firstError;
}

function errorFilterFor404(err) {
  return err?.status === 404;
}

/**
 * Add Firebase Auth User to Mailchimp
 * @param {auth.UserRecord} user The user to add.
 */
async function addUser(user) {
  const { email, uid } = user;
  if (!email) {
    logs.userNoEmail();
    return false;
  }

  logs.userAdding(uid, config.mailchimpAudienceId);
  const results = await mailchimp.lists.addListMember(config.mailchimpAudienceId, {
    email_address: email,
    status: config.mailchimpContactStatus,
  });
  logs.userAdded(uid, config.mailchimpAudienceId, results.id, config.mailchimpContactStatus);
  return true;
}

/**
 * Sync merge fields between Firestore and Mailchimp according to changes
 * between the provided documents.
 * @param {FirebaseFirestore.DocumentData | undefined} newDoc
 * @param {FirebaseFirestore.DocumentData | undefined} prevDoc
 */
async function syncMergeFields(newDoc, prevDoc) {
  // Get the configuration settings for mailchimp merge fields as is defined in extension.yml
  const mergeFieldsConfig = config.mailchimpMergeField;

  // Validate proper configuration settings were provided
  if (!mailchimp) {
    logs.mailchimpNotInitialized();
    return;
  }
  if (!mergeFieldsConfig.mergeFields || _.isEmpty(mergeFieldsConfig.mergeFields)) {
    logger.log(`A property named 'mergeFields' is required`);
    return;
  }
  if (!_.isObject(mergeFieldsConfig.mergeFields)) {
    logger.log("Merge Fields config must be an object");
    return;
  }

  // Determine all the merge prior to write event
  const mergeFieldsToUpdate = Object.entries(mergeFieldsConfig.mergeFields).reduce(
    (acc, [documentPath, mergeFieldConfig]) => {
      const mergeFieldName = _.isObject(mergeFieldConfig)
        ? mergeFieldConfig.mailchimpFieldName
        : mergeFieldConfig;

      const prevMergeFieldValue = jmespath.search(prevDoc, documentPath);
      // lookup the same field value in new snapshot
      const newMergeFieldValue = jmespath.search(newDoc, documentPath) ?? "";

      // if delta exists or the field should always be sent, then update accumulator collection
      if (
        prevMergeFieldValue !== newMergeFieldValue ||
        (_.isObject(mergeFieldConfig) &&
          mergeFieldConfig.when &&
          mergeFieldConfig.when === "always")
      ) {
        const conversionToApply =
          _.isObject(mergeFieldConfig) && mergeFieldConfig.typeConversion
            ? mergeFieldConfig.typeConversion
            : "none";
        let finalValue = newMergeFieldValue;
        switch (conversionToApply) {
          case "timestampToDate":
            finalValue = convertTimestampToMailchimpDate(newMergeFieldValue);
            break;
          case "stringToNumber":
            finalValue = Number(newMergeFieldValue);
            assert(!isNaN(finalValue), `${newMergeFieldValue} could not be converted to a number.`);
            break;
          default:
            break;
        }
        _.set(acc, mergeFieldName, finalValue);
      }
      return acc;
    },
    {},
  );

  // Compute the mailchimp subscriber email hash
  const subscriberHash = subscriberHasher(
    getSubscriberEmail(prevDoc, newDoc, mergeFieldsConfig.subscriberEmail),
  );

  const params = {
    status_if_new: config.mailchimpContactStatus,
    email_address: _.get(newDoc, mergeFieldsConfig.subscriberEmail),
  };

  if (!_.isEmpty(mergeFieldsToUpdate)) {
    params.merge_fields = mergeFieldsToUpdate;
  }

  // sync status if opted in
  if (_.isObject(mergeFieldsConfig.statusField)) {
    const { documentPath, statusFormat } = mergeFieldsConfig.statusField;
    let prevStatusValue = jmespath.search(prevDoc, documentPath) ?? "";
    // lookup the same field value in new snapshot
    let newStatusValue = jmespath.search(newDoc, documentPath) ?? "";

    if (statusFormat && statusFormat === "boolean") {
      prevStatusValue = prevStatusValue ? "subscribed" : "unsubscribed";
      newStatusValue = newStatusValue ? "subscribed" : "unsubscribed";
    }

    if (prevStatusValue !== newStatusValue) {
      params.status = newStatusValue;
      params.status_if_new = newStatusValue;
    }
  }

  // Invoke mailchimp API with updated data
  if (params.merge_fields || params.status) {
    await retry(
      () => mailchimp.lists.setListMember(config.mailchimpAudienceId, subscriberHash, params),
      errorFilterFor404,
    );
  }
}

/**
 * Sync tags between Firestore and Mailchimp according to changes
 * between the provided documents.
 * @param {FirebaseFirestore.DocumentData | undefined} newDoc
 * @param {FirebaseFirestore.DocumentData | undefined} prevDoc
 */
async function syncMemberTags(newDoc, prevDoc) {
  // Get the configuration settings for mailchimp tags as is defined in extension.yml
  const tagsConfig = config.mailchimpMemberTags;

  // Validate proper configuration settings were provided
  if (!mailchimp) {
    logs.mailchimpNotInitialized();
    return;
  }
  if (!tagsConfig.memberTags) {
    logger.log(`A property named 'memberTags' is required`);
    return;
  }
  if (!Array.isArray(tagsConfig.memberTags)) {
    logger.log(`"memberTags" must be an array`);
    return;
  }

  // Retrieves subscriber tags before/after write event
  const getTagsFromEventSnapshot = (snapshot) =>
    tagsConfig.memberTags.reduce((acc, tagConfig) => {
      const tags = resolveValueFromDocumentPath(snapshot, tagConfig);
      if (Array.isArray(tags) && tags && tags.length) {
        return [...acc, ...tags];
      }
      if (tags) {
        return acc.concat(tags);
      }
      return acc;
    }, []);

  // Determine all the tags prior to write event
  const prevTags = prevDoc ? getTagsFromEventSnapshot(prevDoc) : [];
  // Determine all the tags after write event
  const newTags = newDoc ? getTagsFromEventSnapshot(newDoc) : [];

  // Compute the delta between existing/new tags
  const tagsToRemove = prevTags
    .filter((tag) => !newTags.includes(tag))
    .map((tag) => ({ name: tag, status: "inactive" }));
  const tagsToAdd = newTags
    .filter((tag) => !prevTags.includes(tag))
    .map((tag) => ({ name: tag, status: "active" }));
  const tags = [...tagsToRemove, ...tagsToAdd];

  // Compute the mailchimp subscriber email hash
  const subscriberHash = subscriberHasher(
    getSubscriberEmail(prevDoc, newDoc, tagsConfig.subscriberEmail),
  );

  // Invoke mailchimp API with updated tags
  if (tags?.length) {
    await retry(
      () =>
        mailchimp.lists.updateListMemberTags(config.mailchimpAudienceId, subscriberHash, {
          tags,
        }),
      errorFilterFor404,
    );
  }
}

module.exports = {
  config,
  processConfig,
  syncMemberTags,
  syncMergeFields,
  addUser,
  subscriberHasher,
  retry,
  errorFilterFor404,
  resolveValueFromDocumentPath,
  getSubscriberEmail,
};
