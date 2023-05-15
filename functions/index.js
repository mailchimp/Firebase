const crypto = require('crypto');
const _ = require('lodash');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const mailchimp = require('@mailchimp/mailchimp_marketing');
const validation = require("./validation");
const jmespath = require('jmespath');

let config = require('./config');
const logs = require('./logs');

const CONFIG_PARAMS = Object.freeze({
  'mailchimpMemberTags': validation.validateTagConfig,
  'mailchimpMergeField': validation.validateMergeFieldsConfig,
  'mailchimpMemberEvents': validation.validateEventsConfig
});

admin.initializeApp();
logs.init();

const processConfig = (configInput) => {
// extension.yaml receives serialized JSON inputs representing configuration settings for merge fields, tags, and custom events
  // the following code deserialized the JSON inputs and builds a configuration object with each custom setting path (tags, merge fields, custom events) at the root.
  config = Object.entries(configInput).reduce((acc, [key, value]) => {
    const logError = message => {
      functions.logger.log(message, key, value);
      return acc;
    }
    if (configInput[key] && Object.keys(CONFIG_PARAMS).includes(key)) {
      const parsedConfig = JSON.parse(configInput[key]);
      if (!configInput[`${key}WatchPath`]) {
        // Firebase functions must listen to a document path
        // As such, a specific id (users/marie) or wildcard path (users/{userId}) must be specified
        // https://firebase.google.com/docs/firestore/extend-with-functions#wildcards-parameters
        return logError(`${key}WatchPath config property is undefined. Please ensure a proper watch path param has been provided.`);
      }
      if (configInput[`${key}WatchPath`] === 'N/A') {
        // The Firebase platform requires a watch path to be provided conforming to a regular expression string/string
        // However, given this Mailchimp extension represents a suite of features, it's possible a user will not utilize all of them
        // As such, when a watch path of "N/A" is provided as input, it serves as an indicator to skip this feature and treat the function as NO-OP.
        return logError(`${key}WatchPath property is N/A. Setting ${configInput[key]} cloud function as NO-OP.`);
      }

      if(_.isEmpty(parsedConfig)) {
        return logError(`${key} configuration not provided.`);
      } 

      const validator = CONFIG_PARAMS[key];
      const validationResult = validator(parsedConfig);
      if(!validationResult.valid) {
        return logError(`${key} syntax is invalid: \n${validationResult.errors.map(e => e.message).join(",\n")}`);
      }

      // persist the deserialized JSON
      acc[key] = parsedConfig;
    } else {
      // persist the string value as-is (location, oAuth Token, AudienceId, Contact Status, etc.)
      acc[key] = value;
    }
    return acc;
  }, {});
}


try {
  // Configure mailchimp api client
  // The datacenter id is appended to the API key in the form key-dc; 
  //if your API key is 0123456789abcdef0123456789abcde-us6, then the data center subdomain is us6
  // See https://mailchimp.com/developer/marketing/guides/quick-start/
  // See https://github.com/mailchimp/mailchimp-marketing-node/
  // See https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
  const apiKey = config.mailchimpOAuthToken;
  
  const apiKeyParts = apiKey.split('-');
  
  if (apiKeyParts.length === 2){
    const server = apiKeyParts.pop();
    mailchimp.setConfig({
      apiKey: apiKey,       
      server: server,
    });
  } else {
    throw new Error('Unable to set Mailchimp configuration');
  }


  processConfig(config)
  
} catch (err) {
  logs.initError(err);
}

const subscriberHasher = (email) => crypto.createHash("md5").update(email.toLowerCase()).digest("hex");

const getSubscriberEmail = (prevDoc, newDoc, emailPath) => _.get(prevDoc, emailPath, false) || _.get(newDoc, emailPath)

const resolveValueFromDocumentPath = (doc, documentPathOrConfig, defaultValue = undefined) => {
  const documentSelector = _.isObject(documentPathOrConfig) ? documentPathOrConfig.documentPath : documentPathOrConfig
  return jmespath.search(doc, documentSelector) ?? defaultValue
};

exports.addUserToList = functions.handler.auth.user.onCreate(
  async (user) => {
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
      logs.userAdding(uid, config.mailchimpAudienceId);
      const results = await mailchimp.lists.addListMember(config.mailchimpAudienceId, {
        email_address: email,
        status: config.mailchimpContactStatus,
      });

      logs.userAdded(
        uid,
        config.mailchimpAudienceId,
        results.id,
        config.mailchimpContactStatus
      );
      logs.complete();
    } catch (err) {
      err.title === 'Member Exists' ? logs.userAlreadyInAudience( ) : logs.errorAddUser(err);
    }
  }
);

exports.removeUserFromList = functions.handler.auth.user.onDelete(
  async (user) => {
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
      await mailchimp.lists.deleteListMember(
        config.mailchimpAudienceId,
        hashed
      );
      logs.userRemoved(uid, hashed, config.mailchimpAudienceId);
      logs.complete();
    } catch (err) {
      err.title === 'Method Not Allowed' ? logs.userNotInAudience() : logs.errorRemoveUser(err);
    }
  }
);

exports.memberTagsHandler = functions.handler.firestore.document
  .onWrite(async (event) => {
    // If an empty JSON configuration was provided then consider function as NO-OP
    if (_.isEmpty(config.mailchimpMemberTags)) return null;

    try {
      // Get the configuration settings for mailchimp tags as is defined in extension.yml
      const tagsConfig = config.mailchimpMemberTags;

      // Validate proper configuration settings were provided
      if (!mailchimp) {
        logs.mailchimpNotInitialized();
        return;
      }
      if (!tagsConfig.memberTags) {
        functions.logger.log(`A property named 'memberTags' is required`);
        return null;
      }
      if (!Array.isArray(tagsConfig.memberTags)) {
        functions.logger.log('"memberTags" must be an array')
        return null;
      }

      // Get snapshot of document before & after write event
      const prevDoc = event && event.before && event.before.data();
      const newDoc = event && event.after && event.after.data();

      // Retrieves subscriber tags before/after write event
      const getTagsFromEventSnapshot = snapshot => tagsConfig.memberTags.reduce((acc, tagConfig) => {
        const tags = resolveValueFromDocumentPath(snapshot, tagConfig);
        if (Array.isArray(tags) && tags && tags.length) {
          acc = [...acc, ...tags];
        } else if (tags) {
          acc = acc.concat(tags);
        }
        return acc;
      }, []);

      // Determine all the tags prior to write event
      const prevTags = prevDoc ? getTagsFromEventSnapshot(prevDoc) : [];
      // Determine all the tags after write event
      const newTags = newDoc ? getTagsFromEventSnapshot(newDoc) : [];

      // Compute the delta between existing/new tags
      const tagsToRemove = prevTags.filter(tag => !newTags.includes(tag)).map(tag => ({ name: tag, status: 'inactive' }));
      const tagsToAdd = newTags.filter(tag => !prevTags.includes(tag)).map(tag => ({ name: tag, status: 'active' }));
      const tags = [...tagsToRemove, ...tagsToAdd];

      // Compute the mailchimp subscriber email hash
      const subscriberHash = subscriberHasher(getSubscriberEmail(prevDoc, newDoc, tagsConfig.subscriberEmail));

      // Invoke mailchimp API with updated tags
      if (tags && tags.length) {
        await mailchimp.lists.updateListMemberTags(
          config.mailchimpAudienceId,
          subscriberHash,
          { tags: tags }
        );
      }
    } catch (e) {
      functions.logger.log(e);
    }
  });

exports.mergeFieldsHandler = functions.handler.firestore.document
  .onWrite(async (event) => {
    // If an empty JSON configuration was provided then consider function as NO-OP
    if (_.isEmpty(config.mailchimpMergeField)) return null;

    try {
      // Get the configuration settings for mailchimp merge fields as is defined in extension.yml
      const mergeFieldsConfig = config.mailchimpMergeField;

      // Validate proper configuration settings were provided
      if (!mailchimp) {
        logs.mailchimpNotInitialized();
        return;
      }
      if (!mergeFieldsConfig.mergeFields || _.isEmpty(mergeFieldsConfig.mergeFields)) {
        functions.logger.log(`A property named 'mergeFields' is required`);
        return null;
      }
      if (!_.isObject(mergeFieldsConfig.mergeFields)) {
        functions.logger.log('Merge Fields config must be an object');
        return null;
      }

      // Get snapshot of document before & after write event
      const prevDoc = event && event.before && event.before.data();
      const newDoc = event && event.after && event.after.data();

      // Determine all the merge prior to write event
      const mergeFieldsToUpdate = Object.entries(mergeFieldsConfig.mergeFields).reduce((acc, [documentPath, mergeFieldConfig]) => {
        const mergeFieldName = _.isObject(mergeFieldConfig) ? mergeFieldConfig.mailchimpFieldName : mergeFieldConfig;
        
        const prevMergeFieldValue = jmespath.search(prevDoc, documentPath);
        // lookup the same field value in new snapshot
        const newMergeFieldValue = jmespath.search(newDoc, documentPath) ?? "";

        // if delta exists or the field should always be sent, then update accumulator collection
        if (prevMergeFieldValue !== newMergeFieldValue || (_.isObject(mergeFieldConfig) && mergeFieldConfig.when && mergeFieldConfig.when === "always")) {
          acc[mergeFieldName] = newMergeFieldValue;
        }
        return acc;
      }, {});

      // Compute the mailchimp subscriber email hash
      const subscriberHash = subscriberHasher(getSubscriberEmail(prevDoc, newDoc, mergeFieldsConfig.subscriberEmail));

      const params = {
        status_if_new: config.mailchimpContactStatus,
        email_address: _.get(newDoc, mergeFieldsConfig.subscriberEmail),
      };

      if(!_.isEmpty(mergeFieldsToUpdate)) {
        params.merge_fields = mergeFieldsToUpdate
      }

      // sync status if opted in
      if(_.isObject(mergeFieldsConfig.statusField)) {
        const { documentPath, statusFormat } = mergeFieldsConfig.statusField
        let prevStatusValue = jmespath.search(prevDoc, documentPath) ?? '';
        // lookup the same field value in new snapshot
        let newStatusValue = jmespath.search(newDoc, documentPath) ?? '';

        if(statusFormat && statusFormat === "boolean"
        ) {
          prevStatusValue = prevStatusValue ? "subscribed" : "unsubscribed"
          newStatusValue = newStatusValue ? "subscribed" : "unsubscribed"
        }

        if (prevStatusValue !== newStatusValue) {
          params.status = newStatusValue
          params.status_if_new = newStatusValue
        }
      }

      // Invoke mailchimp API with updated data
      if (params.merge_fields || params.status) {
        await mailchimp.lists.setListMember(
          config.mailchimpAudienceId,
          subscriberHash,
          params
        );
      }
    } catch (e) {
      functions.logger.log(e);
    }
  });

exports.memberEventsHandler = functions.handler.firestore.document
  .onWrite(async (event) => {
    // If an empty JSON configuration was provided then consider function as NO-OP
    if (_.isEmpty(config.mailchimpMemberEvents)) return null;

    try {
      // Get the configuration settings for mailchimp custom events as is defined in extension.yml
      const eventsConfig = config.mailchimpMemberEvents;

      // Validate proper configuration settings were provided
      if (!mailchimp) {
        logs.mailchimpNotInitialized();
        return;
      }
      if (!eventsConfig.memberEvents) {
        functions.logger.log(`A property named 'memberEvents' is required`);
        return null;
      }
      if (!Array.isArray(eventsConfig.memberEvents)) {
        functions.logger.log(`'memberEvents' property must be an array`);
        return null;
      }

      // Get snapshot of document before & after write event
      const prevDoc = event && event.before && event.before.data();
      const newDoc = event && event.after && event.after.data();

      // Retrieves subscriber tags before/after write event
      const getMemberEventsFromSnapshot = snapshot => eventsConfig.memberEvents.reduce((acc, memberEventConfiguration) => {
        const events = resolveValueFromDocumentPath(snapshot, memberEventConfiguration);
        if (Array.isArray(events) && events && events.length) {
          acc = [...acc, ...events];
        } else if (events) {
          acc = acc.concat(events);
        }
        return acc;
      }, []);

      // Get all member events prior to write event
      const prevEvents = prevDoc ? getMemberEventsFromSnapshot(prevDoc) : [];
      // Get all member events after write event
      const newEvents = newDoc ? getMemberEventsFromSnapshot(newDoc) : [];
      // Find the intersection of both collections
      const memberEvents = newEvents.filter(event => !prevEvents.includes(event));

      // Compute the mailchimp subscriber email hash
      const subscriberHash = subscriberHasher(getSubscriberEmail(prevDoc, newDoc, eventsConfig.subscriberEmail));

      // Invoke mailchimp API with updated tags
      if (memberEvents && memberEvents.length) {
        const requests = memberEvents.reduce((acc, name) => {
          acc.push(
            mailchimp.lists.createListMemberEvent(
              config.mailchimpAudienceId,
              subscriberHash,
              { name: name })
            );
          return acc;
        }, []);
        await Promise.all(requests);
      }
    } catch (e) {
      functions.logger.log(e);
    }
  });

exports.processConfig = processConfig