const crypto = require('crypto');
const _ = require('lodash');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
// @ts-ignore incorrect typescript typings
const Mailchimp = require('mailchimp-api-v3');

const config = require('./config');
const logs = require('./logs');

admin.initializeApp();
logs.init();

let mailchimp;
try {
  console.log('config =>', config);
  mailchimp = new Mailchimp(config.mailchimpApiKey);
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

exports.handleTags = functions.firestore.document('users/{userId}')
  .onWrite(async (event, context) => {
    functions.logger.log(context);
    try {
      // Deserialize User Input Watch Paths
      const watchPaths = JSON.parse(config.mailchimpTagsPaths);

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

      // Determine the delta/difference/intersection of old/new tags
      const removeTags = (prevTags || []).filter(tag => !(nextTags || []).includes(tag)).map(tag => ({ name: tag, status: 'inactive' }));
      const addTags = (nextTags || []).filter(tag => !(prevTags || []).includes(tag)).map(tag => ({ name: tag, status: 'active' }));
      const tags = [...removeTags, ...addTags];
      functions.logger.log('removeTags'); functions.logger.log(removeTags);
      functions.logger.log('addTags'); functions.logger.log(addTags);
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

exports.handleMergeFields = functions.firestore.document('users/{userId}')
  .onWrite(async (event, context) => {
    functions.logger.log(context);
    try {
      // Deserialize User Input Watch Paths
      const watchPaths = JSON.parse(config.mailchimpTagsPath);

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

      // Determine the delta/difference/intersection of old/new tags
      const removeTags = (prevTags || []).filter(tag => !(nextTags || []).includes(tag)).map(tag => ({ name: tag, status: 'inactive' }));
      const addTags = (nextTags || []).filter(tag => !(prevTags || []).includes(tag)).map(tag => ({ name: tag, status: 'active' }));
      const tags = [...removeTags, ...addTags];
      functions.logger.log('removeTags'); functions.logger.log(removeTags);
      functions.logger.log('addTags'); functions.logger.log(addTags);
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
