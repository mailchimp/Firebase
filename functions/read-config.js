const _ = require("lodash");
const validation = require("./validation");

const CONFIG_PARAMS = Object.freeze({
  mailchimpMemberTags: {
    validator: validation.validateTagConfig,
    hasWatchPath: true,
  },
  mailchimpMergeField: {
    validator: validation.validateMergeFieldsConfig,
    hasWatchPath: true,
  },
  mailchimpMemberEvents: {
    validator: validation.validateEventsConfig,
    hasWatchPath: true,
  },
  backfillConfig: {
    validator: validation.validateBackfillConfig,
    hasWatchPath: false,
  },
});

/**
 * @typedef {('AUTH'|'MERGE_FIELDS'|'MEMBER_TAGS'|'MEMBER_EVENTS')} BackfillConfigSource
 */

/**
 * @typedef {('INSTALL'|'UPDATE'|'CONFIGURE')} BackfillConfigEvent
 */

/**
 * @typedef {object} BackfillConfig
 * @property {BackfillConfigSource[]} [sources]
 * @property {BackfillConfigEvent[]} [events]
 */

/**
 * @typedef {object} MultiDimensionalSelector
 * @property {string} documentPath
 */

/**
 * @typedef {object} MergeFieldExtendedConfig
 * @property {string} mailchimpFieldName
 * @property {"none"|"timestampToDate"|"stringToNumber"} [typeConversion]
 * @property {"changed"|"always"} [when]
 */

/**
 * @typedef {object} TagConfig
 * @property {(string | MultiDimensionalSelector)[]} memberTags
 * @property {string} subscriberEmail
 */

/**
 * @typedef {object} MergeFieldsConfig
 * @property {Object.<string, (string | MergeFieldExtendedConfig)} mergeFields
 * @property {object} [statusField]
 * @property {string} statusField.documentPath
 * @property {"boolean"|"string"} [statusField.statusFormat]
 * @property {string} subscriberEmail
 */

/**
 * @typedef {object} EventsConfig
 * @property {(string | MultiDimensionalSelector)[]} memberEvents
 * @property {string} subscriberEmail
 */

/**
 * @typedef {object} Config
 * @property {string} location
 * @property {string} mailchimpOAuthToken
 * @property {string} mailchimpAudienceId
 * @property {("subscribed"|"pending")} mailchimpContactStatus
 * @property {string} mailchimpMemberTagsWatchPath
 * @property {TagConfig} [mailchimpMemberTags]
 * @property {string} mailchimpMergeFieldWatchPath
 * @property {MergeFieldsConfig} [mailchimpMergeField]
 * @property {string} mailchimpMemberEventsWatchPath
 * @property {EventsConfig} [mailchimpMemberEvents]
 * @property {BackfillConfig} [backfillConfig]
 * @property {string} mailchimpRetryAttempts
 */

/**
 * Reads, deserializes and validates configuration.
 *
 * @param {import("./config")} rawConfig
 * @param {import("firebase-functions").logger} logger
 * @returns {Config}
 */
function readConfig(rawConfig, logger) {
  // extension.yaml receives serialized JSON inputs representing configuration settings
  //  for merge fields, tags, and custom events. the following code deserialized the JSON
  //  inputs and builds a configuration object with each custom setting path
  //  (tags, merge fields, custom events) at the root.
  return Object.entries(rawConfig).reduce((acc, [key, value]) => {
    const logError = (message) => {
      logger.log(message, key, value);
      return acc;
    };
    if (rawConfig[key] && Object.keys(CONFIG_PARAMS).includes(key)) {
      const { validator, hasWatchPath } = CONFIG_PARAMS[key];
      const parsedConfig = JSON.parse(rawConfig[key]);
      if (hasWatchPath && !rawConfig[`${key}WatchPath`]) {
        // Firebase functions must listen to a document path
        // As such, a specific id (users/marie) or wildcard path (users/{userId}) must be specified
        // https://firebase.google.com/docs/firestore/extend-with-functions#wildcards-parameters
        return logError(
          `${key}WatchPath config property is undefined. Please ensure a proper watch path param has been provided.`,
        );
      }
      if (hasWatchPath && rawConfig[`${key}WatchPath`] === "N/A") {
        // The Firebase platform requires a watch path to be provided conforming to a
        //  regular expression string/string. However, given this Mailchimp extension
        //  represents a suite of features, it's possible a user will not utilize all of them
        // As such, when a watch path of "N/A" is provided as input, it serves as an indicator
        //  to skip this feature and treat the function as NO-OP.
        return logError(
          `${key}WatchPath property is N/A. Setting ${rawConfig[key]} cloud function as NO-OP.`,
        );
      }

      if (_.isEmpty(parsedConfig)) {
        return logError(`${key} configuration not provided.`);
      }

      const validationResult = validator(parsedConfig);
      if (!validationResult.valid) {
        return logError(
          `${key} syntax is invalid: \n${validationResult.errors
            .map((e) => e.message)
            .join(",\n")}`,
        );
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

module.exports = {
  readConfig,
};
