const crypto = require('crypto');
const _ = require('lodash');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
// @ts-ignore incorrect typescript typings
const Mailchimp = require('mailchimp-api-v3');

let config = require('./config');
const logs = require('./logs');
const { isEmpty } = require('lodash');

admin.initializeApp();
logs.init();

let mailchimp;
try {
  mailchimp = new Mailchimp(config.mailchimpApiKey);
  config = Object.entries(config).reduce((acc, [key,value]) => {
    if (key.includes('Path')) {
      acc[key] = JSON.parse(config[key]);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
  console.log('parsed config ==>', config)
} catch (err) {
  logs.initError(err);
}

// exports.addUserToList = functions.handler.auth.user.onCreate(
//   async (user) => {
//     logs.start();

//     if (!mailchimp) {
//       logs.mailchimpNotInitialized();
//       return;
//     }

//     const { email, uid } = user;
//     if (!email) {
//       logs.userNoEmail();
//       return;
//     }

//     try {
//       logs.userAdding(uid, config.mailchimpAudienceId);
//       const results = await mailchimp.post(
//         `/lists/${config.mailchimpAudienceId}/members`,
//         {
//           email_address: email,
//           status: config.mailchimpContactStatus,
//         }
//       );
//       logs.userAdded(
//         uid,
//         config.mailchimpAudienceId,
//         results.id,
//         config.mailchimpContactStatus
//       );
//       logs.complete();
//     } catch (err) {
//       logs.errorAddUser(err);
//     }
//   }
// );

// exports.removeUserFromList = functions.handler.auth.user.onDelete(
//   async (user) => {
//     logs.start();

//     if (!mailchimp) {
//       logs.mailchimpNotInitialized();
//       return;
//     }

//     const { email, uid } = user;
//     if (!email) {
//       logs.userNoEmail();
//       return;
//     }

//     try {
//       const hashed = crypto
//         .createHash("md5")
//         .update(email)
//         .digest("hex");

//       logs.userRemoving(uid, hashed, config.mailchimpAudienceId);
//       await mailchimp.delete(
//         `/lists/${config.mailchimpAudienceId}/members/${hashed}`
//       );
//       logs.userRemoved(uid, hashed, config.mailchimpAudienceId);
//       logs.complete();
//     } catch (err) {
//       logs.errorRemoveUser(err);
//     }
//   }
// );

if (config.mailchimpTagsPath) {
  exports.handleTags = functions.firestore.document(config.mailchimpTagsPath.watch)
    .onWrite(async (event, context) => {
      functions.logger.log(context);
      try {
        // Deserialize User Input Watch Paths
        const watchPaths = config.mailchimpTagsPath;
  
        // Validation
        if (!watchPaths.tags) {
          return null;
        }
        if (!watchPaths.email) {
          functions.logger.log('An email field must be specified for the mailchimp subscriber')
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
    
        functions.logger.log('prevTags'); functions.logger.log(prevTags);
        functions.logger.log('nextTags'); functions.logger.log(nextTags);
  
        // Compute the delta between existing/new tags
        const tagsToRemove = (prevTags || []).filter(tag => !(nextTags || []).includes(tag)).map(tag => ({ name: tag, status: 'inactive' }));
        const tagsToAdd = (nextTags || []).filter(tag => !(prevTags || []).includes(tag)).map(tag => ({ name: tag, status: 'active' }));
        const tags = [...tagsToRemove, ...tagsToAdd];
        functions.logger.log('tagsToRemove'); functions.logger.log(tagsToRemove);
        functions.logger.log('tagsToAdd'); functions.logger.log(tagsToAdd);
        functions.logger.log('tags'); functions.logger.log(tags);
    
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
        // Deserialize User Input Watch Paths
        const watchPaths = config.mailchimpMergeFieldPath;
  
        // Validation
        if (!watchPaths.mergeFields || isEmpty(watchPaths.mergeFields)) {
          return null;
        }
        if (!watchPaths.watch) {
          functions.logger.log('A watch field must be specified to listen for collection events');
          return null;
        }
        if (!watchPaths.email) {
          functions.logger.log('An email field must be specified for the mailchimp subscriber');
          return null;
        }
        if (!_.isObject(watchPaths.mergeFields)) {
          functions.logger.log('Merge Fields config must be an array');
          return null;
        }
  
        // Get snapshot of document before & after write event
        const prevDoc = event && event.before && event.before.data();
        functions.logger.log('prevDoc'); functions.logger.log(prevDoc);
        const newDoc = event && event.after && event.after.data();
        functions.logger.log('newDoc'); functions.logger.log(newDoc);
  
        // Determine all the merge prior to write event
        const mergeFieldsToUpdate = Object.entries(watchPaths.mergeFields).reduce((acc, [mergeFieldName, docFieldName]) => {
          functions.logger.log('mergeFieldName'); functions.logger.log(mergeFieldName);
          functions.logger.log('docFieldName'); functions.logger.log(docFieldName);
          const prevMergeFieldVaue = _.get(prevDoc, docFieldName);
          functions.logger.log('prevMergeFieldVaue'); functions.logger.log(prevMergeFieldVaue);
          // lookup the same field value in new snapshot
          const newMergeFieldValue = _.get(newDoc, docFieldName, '');
          functions.logger.log('newMergeFieldValue'); functions.logger.log(newMergeFieldValue);
          // if delta exists, then update accumulator collection
          if (prevMergeFieldVaue !== newMergeFieldValue) {
            acc[mergeFieldName] = newMergeFieldValue;
          }
          return acc;
        }, {});
    
        functions.logger.log('mergeFieldsToUpdate'); functions.logger.log(mergeFieldsToUpdate);
  
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
      // Deserialize User Input Watch Paths
      const watchPaths = config.mailchimpMemberEventsPath;

      // Validation
      if (!watchPaths.events) {
        return null;
      }
      if (!watchPaths.watch) {
        functions.logger.log('A watch field must be specified to listen for collection events');
        return null;
      }
      if (!watchPaths.email) {
        functions.logger.log('An email field must be specified for the mailchimp subscriber');
        return null;
      }
      if (!Array.isArray(watchPaths.events)) {
        functions.logger.log('Events config must be an array');
        return null;
      }

      // Get snapshot of document before & after write event
      const newDoc = event && event.after && event.after.data();
      functions.logger.log('newDoc'); functions.logger.log(newDoc);

      const memberEventsToCreate = watchPaths.events.reduce((acc, key) => {
        functions.logger.log('key'); functions.logger.log(key);
        const mailchimpEventName = _.get(newDoc, key)
        functions.logger.log('mailchimpEventName'); functions.logger.log(mailchimpEventName);
        // acc = Array.isArray(mailchimpEventName) ? acc.concat(mailchimpEventName) : acc.push(mailchimpEventName);
        acc = Array.isArray(mailchimpEventName) ? acc = [...acc, ...mailchimpEventName] : acc.concat(mailchimpEventName);
        return acc;
      }, []);
      functions.logger.log('memberEventsToCreate'); functions.logger.log(memberEventsToCreate);

      // Compute the mailchimp subscriber email hash
      const subscriberHash = crypto.createHash("md5").update(newDoc[watchPaths.email]).digest("hex");

      // Invoke mailchimp API with updated tags
      if (!_.isEmpty(memberEventsToCreate)) {
        const requests = memberEventsToCreate.reduce((acc, name) => {
          console.log('name', name);
          acc.push(mailchimp.post(`/lists/${config.mailchimpAudienceId}/members/${subscriberHash}/events`, { name }));
          return acc;
        }, []);
        const result = await Promise.all(requests);
        functions.logger.log(result);
      }
    } catch (e) {
      functions.logger.log(e);
    }
  });  
}
