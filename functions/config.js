/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = {
  location: process.env.LOCATION || 'us-east4',
  mailchimpApiKey: process.env.MAILCHIMP_API_KEY || '9c2fb9c6dd3bc4412108c507d966a013-us2',
  mailchimpAudienceId: process.env.MAILCHIMP_AUDIENCE_ID || '36599652f2',
  mailchimpContactStatus: process.env.MAILCHIMP_CONTACT_STATUS || 'subscribed',
  mailchimpTagsPath: '{"watch": "users", "tags": ["meta", "role"], "email": "email"}',
  mailchimpMergeFieldPath: '{"watch": "users", "mergeFields": {"FNAME": "firstName", "PHONE": "phoneNumber", "ROLE": "role"}, "email": "email"}',
};
