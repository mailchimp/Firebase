const crypto = require('crypto');
const _ = require('lodash');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Mailchimp = require('mailchimp-api-v3');

let config = require('./config');
const logs = require('./logs');
const { isEmpty } = require('lodash');

const CONFIG_PARAM_NAMES = Object.freeze(['mailchimpMemberTags', 'mailchimpMergeField', 'mailchimpMemberEvents']);

admin.initializeApp();
logs.init();

let mailchimp;
try {
  // Create a new Mailchimp object instance
  mailchimp = new Mailchimp(config.mailchimpApiKey);
  
  // extension.yml receives seralized JSON inputs representing configuration settings for merge fields, tags, and custom events
  // the following code deserializes the JSON inputs and builds a configuration object with each custom setting path (tags, merge fields, custom events) at the root.
  config = Object.entries(config).reduce((acc, [key, value]) => {
    const logError = message => {
      functions.logger.log(message);
      return acc;
    }
    if (CONFIG_PARAM_NAMES.includes(key)) {
      const parsedConfig = JSON.parse(config[key]);
      if (!parsedConfig.watch) {
        // Functions must point to a document to trigger
        // Thus, a specific id (users/marie) or wildcard (users/{userId}) must be specified
        // https://firebase.google.com/docs/firestore/extend-with-functions#wildcards-parameters
        logError(`${key} requires a property named 'watch'`);
      }
      if (!parsedConfig.subscriberEmail) {
        logError(`${key} requires a property named 'subscriberEmail'`);
      }
      acc[key] = parsedConfig;
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
} catch (err) {
  logs.initError(err);
}

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
      const results = await mailchimp.post(
        `/lists/${config.mailchimpAudienceId}/members`,
        {
          email_address: email,
          status: config.mailchimpContactStatus,
        }
      );
      logs.userAdded(
        uid,
        config.mailchimpAudienceId,
        results.id,
        config.mailchimpContactStatus
      );
      logs.complete();
    } catch (err) {
      logs.errorAddUser(err);
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
      const hashed = crypto
        .createHash("md5")
        .update(email)
        .digest("hex");

      logs.userRemoving(uid, hashed, config.mailchimpAudienceId);
      await mailchimp.delete(
        `/lists/${config.mailchimpAudienceId}/members/${hashed}`
      );
      logs.userRemoved(uid, hashed, config.mailchimpAudienceId);
      logs.complete();
    } catch (err) {
      logs.errorRemoveUser(err);
    }
  }
);

if (config.mailchimpMemberTags) {
  exports.mergeTagsHandler = functions.firestore.document(config.mailchimpMemberTags.watch)
    .onWrite(async (event, context) => {
      functions.logger.log(context);
      try {
        // Get the configuration settings for mailchimp tags as is defined in extension.yml
        const tagsConfig = config.mailchimpMemberTags;
        console.log('tagsConfig', tagsConfig);

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
        const getTagsFromEventSnapshot = snapshot => tagsConfig.memberTags.reduce((acc, tag) => {
          const tags = _.get(snapshot, tag);
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
        const subscriberHash = crypto.createHash("md5").update(newDoc[tagsConfig.subscriberEmail]).digest("hex");

        // Invoke mailchimp API with updated tags
        if (tags && tags.length) {
          const result = await mailchimp.post(`/lists/${config.mailchimpAudienceId}/members/${subscriberHash}/tags`, { tags });
          functions.logger.log(result);
        }
      } catch (e) {
        functions.logger.log(e);
      }
    });
}

if (config.mailchimpMergeField) {
  exports.mergeFieldsHandler = functions.firestore.document(config.mailchimpMergeField.watch)
    .onWrite(async (event, context) => {
      functions.logger.log(context);
      try {
        // Get the configuration settings for mailchimp merge fields as is defined in extension.yml
        const mergeFieldsConfig = config.mailchimpMergeField;

        // Validate proper configuration settings were provided
        if (!mailchimp) {
          logs.mailchimpNotInitialized();
          return;
        }
        if (!mergeFieldsConfig.mergeFields || isEmpty(mergeFieldsConfig.mergeFields)) {
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
        const mergeFieldsToUpdate = Object.entries(mergeFieldsConfig.mergeFields).reduce((acc, [docFieldName, mergeFieldName]) => {
          const prevMergeFieldVaue = _.get(prevDoc, docFieldName);
          // lookup the same field value in new snapshot
          const newMergeFieldValue = _.get(newDoc, docFieldName, '');
          // if delta exists, then update accumulator collection
          if (prevMergeFieldVaue !== newMergeFieldValue) {
            acc[mergeFieldName] = newMergeFieldValue;
          }
          return acc;
        }, {});

        // Compute the mailchimp subscriber email hash
        const subscriberHash = crypto.createHash("md5").update(newDoc[mergeFieldsConfig.subscriberEmail]).digest("hex");

        const params = {
          email_address: newDoc[mergeFieldsConfig.subscriberEmail],
          merge_fields: mergeFieldsToUpdate
        };

        // Invoke mailchimp API with updated tags
        if (!_.isEmpty(mergeFieldsToUpdate)) {
          const result = await mailchimp.put(`/lists/${config.mailchimpAudienceId}/members/${subscriberHash}`, params);
          functions.logger.log(result);
        }
      } catch (e) {
        functions.logger.log(e);
      }
    });
}

if (config.mailchimpMemberEvents) {
  exports.memberEventsHandler = functions.firestore.document(config.mailchimpMemberEvents.watch)
    .onWrite(async (event, context) => {
      functions.logger.log(context);
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
        const getMemberEventsFromSnapshot = snapshot => eventsConfig.memberEvents.reduce((acc, memberEvent) => {
          const events = _.get(snapshot, memberEvent);
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
        const subscriberHash = crypto.createHash("md5").update(newDoc[eventsConfig.subscriberEmail]).digest("hex");

        // Invoke mailchimp API with updated tags
        if (memberEvents && memberEvents.length) {
          const requests = memberEvents.reduce((acc, name) => {
            acc.push(mailchimp.post(`/lists/${config.mailchimpAudienceId}/members/${subscriberHash}/events`, { name }));
            return acc;
          }, []);
          await Promise.all(requests);          
        }
      } catch (e) {
        functions.logger.log(e);
      }
    });
}
