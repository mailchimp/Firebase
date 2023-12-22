const crypto = require("crypto");
const assert = require("assert");
const _ = require("lodash");
const { auth, firestore, logger, tasks } = require("firebase-functions");
const { Timestamp } = require("firebase-admin/firestore");
const mailchimp = require("@mailchimp/mailchimp_marketing");
const jmespath = require("jmespath");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getExtensions } = require("firebase-admin/extensions");
const { getFunctions } = require("firebase-admin/functions");
const rawConfig = require("./config");
const { readConfig } = require("./read-config");

/**
 * @type {import("./read-config").Config}
 */
let config = {};
const logs = require("./logs");

initializeApp();
logs.init();

function processConfig(configInput) {
  config = readConfig(configInput, logger);
}

try {
  processConfig(rawConfig);

  // Configure mailchimp api client
  // The datacenter id is appended to the API key in the form key-dc;
  // if your API key is 0123456789abcdef0123456789abcde-us6, then the data center subdomain is us6
  // See https://mailchimp.com/developer/marketing/guides/quick-start/
  // See https://github.com/mailchimp/mailchimp-marketing-node/
  // See https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
  const apiKey = config.mailchimpOAuthToken;

  const apiKeyParts = apiKey.split("-");

  if (apiKeyParts.length === 2) {
    const server = apiKeyParts.pop();
    mailchimp.setConfig({
      apiKey,
      server,
    });
  } else {
    throw new Error("Unable to set Mailchimp configuration");
  }
} catch (err) {
  logs.initError(err);
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

exports.addUserToList = auth.user().onCreate(async (user) => {
  logs.start();

  if (!mailchimp) {
    logs.mailchimpNotInitialized();
    return;
  }

  try {
    // this call is not retried, as a 404 here indicates
    //  the audience ID is incorrect which will not change.
    const userAdded = await addUser(user);
    if (userAdded) {
      logs.complete();
    }
  } catch (err) {
    if (err.title === "Member Exists") {
      logs.userAlreadyInAudience(user.uid, config.mailchimpAudienceId);
    } else {
      logs.errorAddUser(err);
    }
  }
});

exports.removeUserFromList = auth.user().onDelete(async (user) => {
  logs.start();

  if (!mailchimp) {
    logs.mailchimpNotInitialized();
    return;
  }

  const { email, uid } = user;
  if (!email) {
    logs.userNoEmail();
    return;
  }

  try {
    const hashed = subscriberHasher(email);

    logs.userRemoving(uid, hashed, config.mailchimpAudienceId);
    await retry(
      () => mailchimp.lists.deleteListMember(config.mailchimpAudienceId, hashed),
      errorFilterFor404,
    );
    logs.userRemoved(uid, hashed, config.mailchimpAudienceId);
    logs.complete();
  } catch (err) {
    if (err.title === "Method Not Allowed") {
      logs.userNotInAudience();
    } else {
      logs.errorRemoveUser(err);
    }
  }
});

exports.memberTagsHandler = firestore
  .document(config.mailchimpMemberTagsWatchPath)
  .onWrite(async (event) => {
    // If an empty JSON configuration was provided then consider function as NO-OP
    if (_.isEmpty(config.mailchimpMemberTags)) return;

    try {
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

      // Get snapshot of document before & after write event
      const prevDoc = event?.before?.data();
      const newDoc = event?.after?.data();

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
    } catch (e) {
      logger.log(e);
    }
  });

exports.mergeFieldsHandler = firestore
  .document(config.mailchimpMergeFieldWatchPath)
  .onWrite(async (event) => {
    // If an empty JSON configuration was provided then consider function as NO-OP
    if (_.isEmpty(config.mailchimpMergeField)) return;

    try {
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

      // Get snapshot of document before & after write event
      const prevDoc = event?.before?.data();
      const newDoc = event?.after?.data();

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
                assert(
                  !isNaN(finalValue),
                  `${newMergeFieldValue} could not be converted to a number.`,
                );
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
    } catch (e) {
      logger.log(e);
    }
  });

exports.memberEventsHandler = firestore
  .document(config.mailchimpMemberEventsWatchPath)
  .onWrite(async (event) => {
    // If an empty JSON configuration was provided then consider function as NO-OP
    if (_.isEmpty(config.mailchimpMemberEvents)) return;

    try {
      // Get the configuration settings for mailchimp custom events as is defined in extension.yml
      const eventsConfig = config.mailchimpMemberEvents;

      // Validate proper configuration settings were provided
      if (!mailchimp) {
        logs.mailchimpNotInitialized();
        return;
      }
      if (!eventsConfig.memberEvents) {
        logger.log(`A property named 'memberEvents' is required`);
        return;
      }
      if (!Array.isArray(eventsConfig.memberEvents)) {
        logger.log(`'memberEvents' property must be an array`);
        return;
      }

      // Get snapshot of document before & after write event
      const prevDoc = event?.before?.data();
      const newDoc = event?.after?.data();

      // Retrieves subscriber tags before/after write event
      const getMemberEventsFromSnapshot = (snapshot) =>
        eventsConfig.memberEvents.reduce((acc, memberEventConfiguration) => {
          const events = resolveValueFromDocumentPath(snapshot, memberEventConfiguration);
          if (Array.isArray(events) && events && events.length) {
            return [...acc, ...events];
          }
          if (events) {
            return acc.concat(events);
          }
          return acc;
        }, []);

      // Get all member events prior to write event
      const prevEvents = prevDoc ? getMemberEventsFromSnapshot(prevDoc) : [];
      // Get all member events after write event
      const newEvents = newDoc ? getMemberEventsFromSnapshot(newDoc) : [];
      // Find the intersection of both collections
      const memberEvents = newEvents.filter((e) => !prevEvents.includes(e));

      // Compute the mailchimp subscriber email hash
      const subscriberHash = subscriberHasher(
        getSubscriberEmail(prevDoc, newDoc, eventsConfig.subscriberEmail),
      );

      // Invoke mailchimp API with new events
      if (memberEvents?.length) {
        const requests = memberEvents.reduce((acc, name) => {
          acc.push(
            retry(
              () =>
                mailchimp.lists.createListMemberEvent(config.mailchimpAudienceId, subscriberHash, {
                  name,
                }),
              errorFilterFor404,
            ),
          );
          return acc;
        }, []);
        await Promise.all(requests);
      }
    } catch (e) {
      logger.log(e);
    }
  });

exports.addExistingUsersToList = tasks.taskQueue().onDispatch(async (data) => {
  const runtime = getExtensions().runtime();
  if (!config.backfillConfig) {
    await runtime.setProcessingState("PROCESSING_COMPLETE", "No processing requested.");
    return;
  }
  const { nextPageToken } = data;
  const pastSuccessCount = parseInt(data.successCount, 10) ?? 0;
  const pastErrorCount = parseInt(data.errorCount, 10) ?? 0;

  const res = await getAuth().listUsers(100, nextPageToken);
  const mailchimpPromises = res.users.map(async (user) => {
    try {
      await addUser(user);
    } catch (err) {
      if (err.title === "Member Exists") {
        logs.userAlreadyInAudience(user.uid, config.mailchimpAudienceId);
        // Don't throw error if the member already exists.
      } else {
        logs.errorAddUser(err);
        // For other errors, rethrow them so that we can report
        //  the total number at the end of the lifecycle event.
        throw err;
      }
    }
  });

  const results = await Promise.allSettled(mailchimpPromises);
  const newSucessCount = pastSuccessCount + results.filter((p) => p.status === "fulfilled").length;
  const newErrorCount = pastErrorCount + results.filter((p) => p.status === "rejected").length;
  if (res.pageToken) {
    // If there is a pageToken, we have more users to add, so we enqueue another task.
    const queue = getFunctions().taskQueue("addExistingUsersToList", process.env.EXT_INSTANCE_ID);
    await queue.enqueue({
      nextPageToken: res.pageToken,
      successCount: newSucessCount,
      errorCount: newErrorCount,
    });
  } else {
    // The backfill is complete, now we need to set the processing state.
    logs.backfillComplete(newSucessCount, newErrorCount);
    if (newErrorCount === 0) {
      await runtime.setProcessingState(
        "PROCESSING_COMPLETE",
        `${newSucessCount} users added (or already existed) in Mailchimp audience ${config.mailchimpAudienceId}.`,
      );
    } else if (newErrorCount > 0 && newSucessCount > 0) {
      await runtime.setProcessingState(
        "PROCESSING_WARNING",
        `${newSucessCount} users added (or already existed) in Mailchimp audience ${config.mailchimpAudienceId}, ` +
          `failed to add ${newErrorCount} users.  Check function logs for more information.`,
      );
    }
    if (newErrorCount > 0 && newSucessCount === 0) {
      await runtime.setProcessingState(
        "PROCESSING_FAILED",
        `Failed to add ${newErrorCount} users to ${config.mailchimpAudienceId}. Check function logs for more information.`,
      );
    }
  }
});

/**
 * @typedef {object} BackfillTask
 * @property {"SYNC_AUTH"|"SYNC_FIRESTORE"} type
 * @property {import("./read-config").BackfillConfigSource} sources
 * @property {string} [collectionPath]
 */
/**
 * @typedef {object} BackfillTaskData
 * @property {BackfillTask} task
 * @property {BackfillTask[]} remainingTasks
 * @property {object} taskState
 */

/**
 *
 * @param {BackfillTaskData} data
 */
async function enqueueBackfillTask(data) {
  const queue = getFunctions().taskQueue("executeBackfillTask", process.env.EXT_INSTANCE_ID);
  await queue.enqueue(data);
}

/**
 *
 * @param {import("./read-config").BackfillConfig} backfillConfig
 * @returns {BackfillTask[]} tasks
 */
function gatherBackfillTasksToRun(backfillConfig) {
  const configSources = backfillConfig.sources ?? [];

  /** @type {BackfillTask[]} */
  const tasksToRun = [];
  if (configSources.includes("AUTH")) {
    tasksToRun.push({
      type: "SYNC_AUTH",
      sources: ["AUTH"],
    });
  }

  const remainingSourcesToPaths = {
    MERGE_FIELDS: config.mailchimpMergeFieldWatchPath,
    MEMBER_TAGS: config.mailchimpMemberTagsWatchPath,
    MEMBER_EVENTS: config.mailchimpMemberEventsWatchPath,
  };

  const pathToSources = configSources.reduce((allPathsToSources, source) => {
    if (Object.hasOwn(remainingSourcesToPaths, source)) {
      const collectionPath = remainingSourcesToPaths[source];
      if (Object.hasOwn(allPathsToSources, collectionPath)) {
        allPathsToSources[collectionPath].push(source);
      } else {
        // eslint-disable-next-line no-param-reassign
        allPathsToSources[collectionPath] = [source];
      }
    }
    return allPathsToSources;
  }, {});

  Object.entries(pathToSources).forEach(([collectionPath, sources]) => {
    tasksToRun.push({
      type: "SYNC_FIRESTORE",
      sources,
      collectionPath,
    });
  });

  return tasksToRun;
}

// TODO: Need to return task status (pass/fail) and new task state.
// eslint-disable-next-line no-unused-vars
async function syncAuth(task, taskState) {
  return true;
}

// eslint-disable-next-line no-unused-vars
async function syncFirestore(task, taskState) {
  return true;
}

exports.executeBackfillTask = tasks
  .taskQueue()
  .onDispatch(async (/** @type {BackfillTaskData} */ data) => {
    const runtime = getExtensions().runtime();
    // eslint-disable-next-line no-console
    console.log({ data });
    const { task, taskState, remainingTasks } = data;
    let taskSucceeded = false;

    switch (task.type) {
      case "SYNC_AUTH":
        taskSucceeded = await syncAuth(task, taskState);
        break;
      case "SYNC_FIRESTORE":
        taskSucceeded = await syncFirestore(task, taskState);
        break;
      default:
        logs.unrecognizedTaskType(task.type);
        break;
    }

    if (taskSucceeded) {
      logs.taskSucceeded(task.type, {});
      const nextTask = remainingTasks.shift();
      if (nextTask) {
        await enqueueBackfillTask({
          task: nextTask,
          remainingTasks,
        });
      } else {
        await runtime.setProcessingState("PROCESSING_COMPLETE", `Backfill process completed!.`);
      }
    } else {
      const canRetry = false; // TODO: Add to config the retry level
      if (canRetry) {
        logs.taskAttemptFailed(task.type, {});
        await runtime.setProcessingState(
          "PROCESSING_WARNING",
          `Task ${task.type} attempt failed and will be retried`,
        );
        await enqueueBackfillTask({
          task,
          remainingTasks,
          taskState,
        });
      } else {
        logs.taskFailed(task.type, {});
        await runtime.setProcessingState(
          "PROCESSING_FAILED",
          `Task ${task.type} failed and cannot be retried. Check function logs for more information.`,
        );
      }
    }
  });

/**
 *
 * @param {import("./read-config").BackfillConfigEvent} trigger
 * @returns
 */
async function performBackfill(trigger) {
  const runtime = getExtensions().runtime();
  if (!config.backfillConfig?.events?.includes(trigger)) {
    await runtime.setProcessingState("PROCESSING_COMPLETE", "No processing requested.");
    return;
  }
  const backfillTasks = gatherBackfillTasksToRun(config.backfillConfig);
  if (backfillTasks.length) {
    const firstTask = backfillTasks.shift();
    await enqueueBackfillTask({ task: firstTask, remainingTasks: backfillTasks });
  }
}

exports.performTasksOnInstall = tasks.taskQueue().onDispatch(async () => {
  await performBackfill("INSTALL");
});
exports.performTasksOnUpdate = tasks.taskQueue().onDispatch(async () => {
  await performBackfill("UPDATE");
});
exports.performTasksOnConfigure = tasks.taskQueue().onDispatch(async () => {
  await performBackfill("CONFIGURE");
});

exports.processConfig = processConfig;
