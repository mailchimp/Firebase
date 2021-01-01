module.exports = {
  location: process.env.LOCATION || 'us-east4',
  mailchimpApiKey: process.env.MAILCHIMP_API_KEY || '9c2fb9c6dd3bc4412108c507d966a013-us2',
  mailchimpAudienceId: process.env.MAILCHIMP_AUDIENCE_ID || '36599652f2',
  mailchimpContactStatus: process.env.MAILCHIMP_CONTACT_STATUS || 'subscribed',
  mailchimpTagsPath: '{"watch": "users", "tags": ["meta", "role"], "email": "email"}',
  mailchimpMergeFieldPath: '{"watch": "users", "mergeFields": {"FNAME": "firstName", "PHONE": "phoneNumber", "ROLE": "role"}, "email": "email"}',
  mailchimpMemberEventsPath: '{"watch": "conferenceRegistrations", "events": ["mailchimpEvents"], "email": "email"}'
};
