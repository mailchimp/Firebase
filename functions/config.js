module.exports = {
  location: process.env.LOCATION,
  mailchimpOAuthToken: process.env.MAILCHIMP_API_KEY,
  mailchimpAudienceId: process.env.MAILCHIMP_AUDIENCE_ID,
  mailchimpContactStatus: process.env.MAILCHIMP_CONTACT_STATUS,
  mailchimpMemberTagsWatchPath: process.env.MAILCHIMP_MEMBER_TAGS_WATCH_PATH,
  mailchimpMemberTags: process.env.MAILCHIMP_MEMBER_TAGS_CONFIG,
  mailchimpMergeFieldWatchPath: process.env.MAILCHIMP_MERGE_FIELDS_WATCH_PATH,
  mailchimpMergeField: process.env.MAILCHIMP_MERGE_FIELDS_CONFIG,
  mailchimpMemberEventsWatchPath: process.env.MAILCHIMP_MEMBER_EVENTS_WATCH_PATH,
  mailchimpMemberEvents: process.env.MAILCHIMP_MEMBER_EVENTS_CONFIG,
  performBackfillFromAuth: process.env.PERFORM_BACKFILL_FROM_AUTH === "true",
  mailchimpRetryAttempts: process.env.MAILCHIMP_RETRY_ATTEMPTS,
};
