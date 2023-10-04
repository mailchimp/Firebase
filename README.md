# Manage Marketing with Mailchimp

**Author**: Mailchimp (**[https://mailchimp.com](https://mailchimp.com)**)

**Description**: Syncs user data with a Mailchimp audience for sending personalized email marketing campaigns.



**Details**: Use this extension to:

 - Add new users to an existing Mailchimp audience
 - Remove user from an existing Mailchimp audience
 - Associate member tags with a Mailchimp subscriber
 - Use merge fields to sync user data with a Mailchimp subscriber
 - Set member events to trigger Mailchimp actions and automations 

#### Additional setup

Make sure that you've set up [Firebase Authentication](https://firebase.google.com/docs/auth) to manage your users.

You must also have a Mailchimp account before installing this extension.

#### Billing
 
This extension uses the following Firebase services which may have associated charges:

- Cloud Firestore
- Cloud Functions
- Firebase Authentication

This extension also uses the following third-party services:

- Mailchimp Billing ([pricing information](https://mailchimp.com/pricing))

You are responsible for any costs associated with your use of these services.

#### Note from Firebase

To install this extension, your Firebase project must be on the Blaze (pay-as-you-go) plan. You will only be charged for the resources you use. Most Firebase services offer a free tier for low-volume use. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

You will be billed a small amount (typically less than $0.10) when you install or reconfigure this extension. See the [Cloud Functions for Firebase billing FAQ](https://firebase.google.com/support/faq#expandable-15) for a detailed explanation.




**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension?

* Mailchimp OAuth Token: To obtain a Mailchimp OAuth Token, click [here](https://firebase.mailchimp.com/index.html).

* Audience ID: What is the Mailchimp Audience ID to which you want to subscribe new users? To find your Audience ID: visit https://admin.mailchimp.com/lists, click on the desired audience or create a new audience, then select **Settings**. Look for **Audience ID** (for example, `27735fc60a`).

* Mailchimp Retry Attempts: The number of attempts to retry operation against Mailchimp.  Race conditions can occur between user creation events and user update events, and this allows the extension to retry operations that failed transiently.  Currently this is limited to 404 responses for removeUserFromList, memberTagsHandler, mergeFieldsHandler and memberEventsHandler calls.

* Contact status: When the extension adds a new user to the Mailchimp audience, what is their initial status? This value can be `subscribed` or `pending`. `subscribed` means the user can receive campaigns; `pending` means the user still needs to opt-in to receive campaigns.

* Firebase Member Tags Watch Path: The Firestore collection to watch for member tag changes

* Firebase Member Tags Config: Provide a configuration mapping in JSON format indicating which Firestore event(s) to listen for and associate as Mailchimp member tags.

Required Fields:
1) `memberTags` - The Firestore document fields(s) to retrieve data from and classify as subscriber tags in Mailchimp. Acceptable data types include:
    
    - `Array<String>` - The extension will lookup the values in the provided fields and update the subscriber's member tags with the respective data values. The format of each string can be any valid [JMES Path query](https://jmespath.org/). e.g. ["primaryTags", "additionalTags", "tags.primary"]

    - `Array<Object>` - An extended object configuration is supported with the following fields:
        - `documentPath` - (required) The path to the field in the document containing tag/s, as a string. The format can be any valid [JMES Path query](https://jmespath.org/). e.g. "primaryTags", "tags.primary".

2) `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp

Configuration Example:
```json
{
  "memberTags": ["domainKnowledge", "jobTitle"],
  "subscriberEmail": "emailAddress"
}
```

Or via equivalent extended syntax:
```json
{
  "memberTags": [{ "documentPath": "domainKnowledge" }, { "documentPath": "jobTitle" }],
  "subscriberEmail": "emailAddress"
} 
```
Based on the sample configuration, if the following Firestore document is provided:
```json
{
  "firstName": "..",
  "lastName": "..",
  "phoneNumber": "..",
  "courseName": "..",
  "emailAddress": "..", // The config property 'subscriberEmail' maps to this document field
  "jobTitle": "..", // The config property 'memberTags' maps to this document field
  "domainKnowledge": "..", // The config property 'memberTags' maps to this document field
  "activity": []
} 
```
Any data associated with the mapped fields (i.e. `domainKnowledge` and `jobTitle`) will be considered Member Tags and the Mailchimp user's profile will be updated accordingly.
For complex documents such as:
```json
{
  "emailAddress": "..", // The config property 'subscriberEmail' maps to this document field
  "meta": {
    "tags": [{
      "label": "Red",
      "value": "red"
    },{
      "label": "Team 1",
      "value": "team1"
    }]
  }
} 
```
A configuration of the following will allow for the tag values of "red", "team1" to be sent to Mailchimp:
```json
{
  "memberTags": [{ "documentPath": "meta.tags[*].value" }],
  "subscriberEmail": "emailAddress"
} 
```
NOTE: To disable this cloud function listener, provide an empty JSON config `{}`.

* Firebase Merge Fields Watch Path: The Firestore collection to watch for merge field changes

* Firebase Merge Fields Config: Provide a configuration mapping in JSON format indicating which Firestore event(s) to listen for and associate as Mailchimp merge fields.

Required Fields:
1) `mergeFields` - JSON mapping representing the Firestore document fields to associate with Mailchimp Merge Fields. The key format can be any valid [JMES Path query](https://jmespath.org/) as a string. The value must be the name of a Mailchimp Merge Field as a string, or an object with the following properties:

    - `mailchimpFieldName` - (required) The name of the Mailchimp Merge Field to map to, e.g. "FNAME". Paths are allowed, e.g. "ADDRESS.addr1" will map to an "ADDRESS" object.

    - `typeConversion` - (optional) Whether to apply a type conversion to the value found at documentPath. Valid options: 
        
        - `none`: no conversion is applied.

        - `timestampToDate`: Converts from a [Firebase Timestamp](https://firebase.google.com/docs/reference/android/com/google/firebase/Timestamp) to YYYY-MM-DD format (UTC).
        
        - `stringToNumber`: Converts to a number.

    - `when` - (optional) When to send the value of the field to Mailchimp. Options are "always" (which will send the value of this field on _any_ change to the document, not just this field) or "changed". Default is "changed".

2) `statusField` - An optional configuration setting for syncing the users mailchimp status. Properties are:

    - `documentPath` - (required) The path to the field in the document containing the users status, as a string. The format can be any valid [JMES Path query](https://jmespath.org/). e.g. "status", "meta.status".

    - `statusFormat` - (optional) Indicates the format that the status field is. The options are:
        - `"string"` - The default, this will sync the value from the status field as is, with no modification.
        - `"boolean"` - This will check if the value is truthy (e.g. true, 1, "subscribed"), and if so will resolve the status to "subscribed", otherwise it will resolve to "unsubscribed".

3) `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp

Configuration Example:
```json
{
  "mergeFields": {
    "firstName": "FNAME",
    "lastName": "LNAME",
    "phoneNumber": "PHONE"
  },
  "subscriberEmail": "emailAddress"
}
```
Or via equivalent extended syntax:
```json
{
  "mergeFields": {
    "firstName": { "mailchimpFieldName": "FNAME" },
    "lastName":{ "mailchimpFieldName": "LNAME" },
    "phoneNumber": { "mailchimpFieldName": "PHONE", "when": "changed" }
  },
  "subscriberEmail": "emailAddress"
} 
```

Based on the sample configuration, if the following Firestore document is provided:
```json
{
  "firstName": "..", // The config property FNAME maps to this document field
  "lastName": "..", // The config property LNAME maps to this document field
  "phoneNumber": "..", // The config property PHONE maps to this document field
  "emailAddress": "..", // The config property "subscriberEmail" maps to this document field
  "jobTitle": "..", 
  "domainKnowledge": "..",
  "activity": []
} 
```

Any data associated with the mapped fields (i.e. firstName, lastName, phoneNumber) will be considered Merge Fields and the Mailchimp user's profile will be updated accordingly.
If there is a requirement to always send the firstName and lastName values, the `"when": "always"` configuration option can be set on those fields, like so:
```json
{
  "mergeFields": {
    "firstName": { "mailchimpFieldName": "FNAME", "when": "always" },
    "lastName":{ "mailchimpFieldName": "LNAME", "when": "always" },
    "phoneNumber": { "mailchimpFieldName": "PHONE", "when": "changed" }
  },
  "subscriberEmail": "emailAddress"
} 
```
This can be handy if Firebase needs to remain the source or truth or if the extension has been installed after data is already in the collection and there is a data migration period.
If the users status is also captured in the Firestore document, the status can be updated in Mailchimp by using the following configuration:
```json
{
  "statusField": {
    "documentPath": "meta.status",
    "statusFormat": "string",
  },
  "subscriberEmail": "emailAddress"
} 
```
This can be as well, or instead of, the `mergeFields` configuration property being set.
NOTE: To disable this cloud function listener, provide an empty JSON config `{}`.

* Firebase Member Events Watch Path: The Firestore collection to watch for member event changes

* Firebase Member Events Config: Provide a configuration mapping in JSON format indicating which Firestore event(s) to listen for and associate as Mailchimp merge events.

Required Fields:
1) `memberEvents` - The Firestore document fields(s) to retrieve data from and classify as member events in Mailchimp. Acceptable data types include:

  - `Array<String>` - The extension will lookup the values (mailchimp event names) in the provided fields and post those events to Mailchimp on the subscriber's activity feed. The format can be any valid [JMES Path query](https://jmespath.org/). e.g. ["events", "meta.events"]

  - `Array<Object>` - An extended object configuration is supported with the following fields:
      - `documentPath` - (required) The path to the field in the document containing events. The format can be any valid [JMES Path query](https://jmespath.org/). e.g. "events", "meta.events".

2) `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp

Configuration Example:
```json
{
  "memberEvents": [
    "activity"
  ],
  "subscriberEmail": "emailAddress"
} 
```
Or via equivalent extended syntax:
```json
{
  "memberEvents": [{ "documentPath": "activity" }],
  "subscriberEmail": "emailAddress"
} 
```
Based on the sample configuration, if the following Firestore document is provided:
```json
{
  "firstName": "..",
  "lastName": "..",
  "phoneNumber": "..",
  "courseName": "..",
  "jobTitle": "..", 
  "domainKnowledge": "..",
  "emailAddress": "..", // The config property "subscriberEmail" maps to this document field
  "activity": ["send_welcome_email"] // The config property "memberTags" maps to this document field
} 
```
Any data associated with the mapped fields (i.e. `activity`) will be considered events and the Mailchimp user's profile will be updated accordingly.
For complex documents such as:
```json
{
  "emailAddress": "..", // The config property 'subscriberEmail' maps to this document field
  "meta": {
    "events": [{
      "title": "Registered",
      "date": "2021-10-08T00:00:00Z"
    },{
      "title": "Invited Friend",
      "date": "2021-10-09T00:00:00Z"
    }]
  }
} 
```
A configuration of the following will allow for the events of "Registered", "Invited Friend" to be sent to Mailchimp:
```json
{
  "memberEvents": [{ "documentPath": "meta.events[*].title" }],
  "subscriberEmail": "emailAddress"
} 
```
NOTE: To disable this cloud function listener, provide an empty JSON config `{}`.



**Cloud Functions:**

* **addUserToList:** Listens for new user accounts (as managed by Firebase Authentication), then automatically adds the new user to your specified MailChimp audience.

* **removeUserFromList:** Listens for existing user accounts to be deleted (as managed by Firebase Authentication), then automatically removes them from your specified MailChimp audience.

* **memberTagsHandler:** Member Tags provide the ability to associate "metadata" or "labels" with a Mailchimp subscriber. The memberTagsHandler function listens for Firestore write events based on specified config path, then automatically classifies the document data as Mailchimp subscriber tags.

* **mergeFieldsHandler:** Merge fields provide the ability to create new properties that can be associated with Mailchimp subscriber. The mergeFieldsHandler function listens for Firestore write events based on specified config path, then automatically populates the Mailchimp subscriber's respective merge fields.

* **memberEventsHandler:** Member events are Mailchimp specific activity events that can be created and associated with a predefined action. The memberEventsHandler function Listens for Firestore write events based on specified config path, then automatically uses the document data to create a Mailchimp event on the subscriber's profile which can subsequently trigger automation workflows.
