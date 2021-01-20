module.exports = {
  location: process.env.LOCATION || 'us-east4',
  mailchimpApiKey: process.env.MAILCHIMP_API_KEY || '9c2fb9c6dd3bc4412108c507d966a013-us2',
  mailchimpAudienceId: process.env.MAILCHIMP_AUDIENCE_ID || '36599652f2',
  mailchimpContactStatus: process.env.MAILCHIMP_CONTACT_STATUS || 'subscribed',
  mailchimpMemberTags: process.env.FIREBASE_MEMBER_TAGS_CONFIG || '{"watch": "trainingRegistrations/{id}", "memberTags": ["jobTitle", "domainKnowledge"], "subscriberEmail": "email"}',
  mailchimpMergeField: process.env.FIREBASE_MERGE_FIELDS_CONFIG || '{"watch": "trainingRegistrations/{id}", "mergeFields": {"firstName": "FNAME", "lastName": "LNAME", "phoneNumber": "PHONE", "courseName": "COURSE_NAM"}, "subscriberEmail": "email"}',
  mailchimpMemberEvents: process.env.FIREBASE_MEMBER_EVENTS_CONFIG || '{"watch": "trainingRegistrations/{id}", "memberEvents": ["activity"], "subscriberEmail": "email"}'
};
