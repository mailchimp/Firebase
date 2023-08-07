// default configuration for testing
const defaultConfig = {
  location: "location",
  mailchimpOAuthToken: "mailchimpOAuthToken-us9",
  mailchimpAudienceId: "mailchimpAudienceId",
  mailchimpContactStatus: "mailchimpContactStatus",
  mailchimpMemberTagsWatchPath: "_unused_",
  mailchimpMemberTags: "{}",
  mailchimpMergeFieldWatchPath: "_unused_",
  mailchimpMergeField: "{}",
  mailchimpMemberEventsWatchPath: "_unused_",
  mailchimpMemberEvents: "{}",
  mailchimpRetryAttempts: "0",
};

const errorWithStatus = (status) => {
  const err = new Error();
  err.status = status;
  return err;
};

module.exports = {
  defaultConfig,
  errorWithStatus,
};
