const crypto = require('crypto');
const _ = require('lodash');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Mailchimp = require('mailchimp-api-v3');

let config = require('./config');
const logs = require('./logs');
const { isEmpty } = require('lodash');

admin.initializeApp();
logs.init();

let mailchimp;
try {
  // Create a new Mailchimp object instance
  mailchimp = new Mailchimp(config.mailchimpApiKey);

  // Functions must point to a document to trigger
  // Thus, a specific id (users/marie) or wildcard (users/{userId}) must be specified
  // https://firebase.google.com/docs/firestore/extend-with-functions#wildcards-parameters
  const VALID_COLLECTION_NAME = /[a-zA-Z]+\/{[a-zA-Z]+}/g;

  // extension.yml receives seralized JSON inputs representing configuration settings for merge fields, tags, and custom events
  // the following code deserializes the JSON inputs and builds a configuration object with each custom setting path (tags, merge fields, custom events) at the root.
  config = Object.entries(config).reduce((acc, [key,value]) => {
    const logError = message => {
      functions.logger.log(message);
      return acc;
    }
    if (key.includes('Path')) {
      const parsedConfig = JSON.parse(config[key]);
      if (!parsedConfig.watch) {
        logError(`${key} requires a property named 'watch'`);
      }
      if (!parsedConfig.email) {
        logError(`${key} requires a property named 'email'`);
      }
      console.log('testing', parsedConfig.watch);
      if (!VALID_COLLECTION_NAME.test(parsedConfig.watch)) {
        logError(`${key} requires a property named 'watch' with a specific/wildcard param defined i.e (1) users/marie (2) users/{userId}`);
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

if (config.mailchimpTagsPath) {
  exports.handleTags = functions.firestore.document(config.mailchimpTagsPath.watch)
    .onWrite(async (event, context) => {
      functions.logger.log(context);
      try {
        // Get the configuration settings for mailchimp tags as is defined in extension.yml
        const watchPaths = config.mailchimpTagsPath;
  
        // Validate proper configuration settings were provided
        if (!mailchimp) {
          logs.mailchimpNotInitialized();
          return;
        }
        if (!watchPaths.tags) {
          return null;
        }
        if (!Array.isArray(watchPaths.tags)) {
          functions.logger.log('Tags must be an array')
          return null;
        }
  
        // Get snapshot of document before & after write event
        const prevDoc = event && event.before && event.before.data();
        const newDoc = event && event.after && event.after.data();
  
        // Determine all the tags prior to write event
        const prevTags = prevDoc && watchPaths.tags.reduce((acc, tag) => {
          const prevTags = _.get(prevDoc, tag);
          if (Array.isArray(prevTags) && prevTags && prevTags.length) {
            acc = [...acc, ...prevTags];
          } else if (prevTags) {
            acc = acc.concat(prevTags);
          }
          return acc;
        }, []);
  
        // Determine all the tags after write event
        const nextTags = newDoc && watchPaths.tags.reduce((acc, tag) => {
          const nextTags = _.get(newDoc, tag);
          if (Array.isArray(nextTags) && nextTags && nextTags.length) {
            acc = [...acc, ...nextTags];
          } else if (nextTags) {
            acc = acc.concat(nextTags);
          }        
          return acc;
        }, []);
  
        // Compute the delta between existing/new tags
        const tagsToRemove = (prevTags || []).filter(tag => !(nextTags || []).includes(tag)).map(tag => ({ name: tag, status: 'inactive' }));
        const tagsToAdd = (nextTags || []).filter(tag => !(prevTags || []).includes(tag)).map(tag => ({ name: tag, status: 'active' }));
        const tags = [...tagsToRemove, ...tagsToAdd];
    
        // Compute the mailchimp subscriber email hash
        const subscriberHash = crypto.createHash("md5").update(newDoc.email).digest("hex");    
    
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

if (config.mailchimpMergeFieldPath) {
  exports.handleMergeFields = functions.firestore.document(config.mailchimpMergeFieldPath.watch)
    .onWrite(async (event, context) => {
      functions.logger.log(context);
      try {
        // Get the configuration settings for mailchimp merge fields as is defined in extension.yml
        const watchPaths = config.mailchimpMergeFieldPath;
  
        // Validate proper configuration settings were provided
        if (!mailchimp) {
          logs.mailchimpNotInitialized();
          return;
        }
        if (!watchPaths.mergeFields || isEmpty(watchPaths.mergeFields)) {
          functions.logger.log(`A property named 'mergeFields' is required`);
          return null;
        }
        if (!_.isObject(watchPaths.mergeFields)) {
          functions.logger.log('Merge Fields config must be an object');
          return null;
        }
  
        // Get snapshot of document before & after write event
        const prevDoc = event && event.before && event.before.data();
        const newDoc = event && event.after && event.after.data();
  
        // Determine all the merge prior to write event
        const mergeFieldsToUpdate = Object.entries(watchPaths.mergeFields).reduce((acc, [docFieldName, mergeFieldName]) => {
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
        const subscriberHash = crypto.createHash("md5").update(newDoc[watchPaths.email]).digest("hex");    
    
        const params = {
          email_address: newDoc[watchPaths.email],
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

if (config.mailchimpMemberEventsPath) {
  exports.handleListMemberEvents = functions.firestore.document(config.mailchimpMemberEventsPath.watch)
  .onWrite(async (event, context) => {
    functions.logger.log(context);
    try {
      // Get the configuration settings for mailchimp custom events as is defined in extension.yml
      const watchPaths = config.mailchimpMemberEventsPath;

      // Validate proper configuration settings were provided
      if (!watchPaths.events) {
        functions.logger.log(`A property named 'events' is required`);
        return null;
      }
      if (!Array.isArray(watchPaths.events)) {
        functions.logger.log(`'events' property must be an array`);
        return null;
      }

      // Get snapshot of document after write event
      const newDoc = event && event.after && event.after.data();

      const memberEventsToCreate = watchPaths.events.reduce((acc, key) => {
        const mailchimpEventName = _.get(newDoc, key);
        acc = Array.isArray(mailchimpEventName) ? acc = [...acc, ...mailchimpEventName] : acc.concat(mailchimpEventName);
        return acc;
      }, []);

      // Compute the mailchimp subscriber email hash
      const subscriberHash = crypto.createHash("md5").update(newDoc[watchPaths.email]).digest("hex");

      // Invoke mailchimp API with updated tags
      if (!_.isEmpty(memberEventsToCreate)) {
        const requests = memberEventsToCreate.reduce((acc, name) => {
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
