# Sync with Mailchimp

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Adds new users from Firebase Authentication to a specified Mailchimp audience.



**Details**: Use this extension to add new users to an existing [Mailchimp](https://mailchimp.com) audience.

This extension adds the email address of each new user to your specified Mailchimp audience. Also, if the user deletes their user account for your app, this extension removes the user from the Mailchimp audience.

**Note:** To use this extension, you need to manage your users with Firebase Authentication.

This extension uses Mailchimp, so you'll need to supply your Mailchimp API Key and Audience ID when installing this extension.

#### Additional setup

Make sure that you've set up [Firebase Authentication](https://firebase.google.com/docs/auth) to manage your users.

You must also have a Mailchimp account before installing this extension.

### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
  - Cloud Functions (Node.js 10+ runtime. See [FAQs](https://firebase.google.com/support/faq#expandable-24))

Usage of this extension also requires you to have a Mailchimp account. You are responsible for any associated costs with your usage of Mailchimp.



### Cloud Functions

* **addUserToList:** Listens for new user accounts (as managed by Firebase Authentication), then automatically adds the new user to your specified MailChimp audience.

* **removeUserFromList:** Listens for existing user accounts to be deleted (as managed by Firebase Authentication), then automatically removes them from your specified MailChimp audience.

* **mergeTagsHandler:** Listens for Firebase write events based on specified config path, then automatically classifies the document data as Mailchimp subscriber tags.

* **mergeFieldsHandler:** Listens for Firestore write events based on specified config path, then automatically populates a Mailchimp subscriber's respective merge fields.

* **memberEventsHandler:** Listens for Firestore write events based on specified config path, then automatically uses the document data to create a mailchimp event on the subscriber's profile which can subsequently kickoff automation workflows in Mailchimp.

### Configuration Parameters:

* Cloud Functions location: Where do you want to deploy the functions created for this extension?

* **[Required]** Mailchimp API key: What is your Mailchimp API key? To obtain a Mailchimp API key, go to your [Mailchimp account](https://admin.mailchimp.com/account/api/).

* **[Required]** Audience ID: What is the Mailchimp Audience ID to which you want to subscribe new users? To find your Audience ID: visit https://admin.mailchimp.com/lists, click on the desired audience or create a new audience, then select **Settings**. Look for **Audience ID** (for example, `27735fc60a`).

* **[Required]** Contact status: When the extension adds a new user to the Mailchimp audience, what is their initial status? This value can be `subscribed` or `pending`. `subscribed` means the user can receive campaigns; `pending` means the user still needs to opt-in to receive campaigns.

* **[Optional]** Firebase Member Tags Config

  JSON Required Keys:
  
  1) `watch` - Specifies the Firestore collection to listen on for events. Acceptable values include:
  - `collectionName/{id}` - Wildcard config allowing Firestore to listen on all document ids in this collection
  - `collectionName/specificId` - Specific config allowing Firestore to listen on events with exact document Id.

  2) `memberTags` - Indicates the Firestore document fields to retrieve data from and classify as subscriber tags in Mailchimp. Acceptable data types include:
  - Array\<String\> - The extenion will lookup the values in the provided fields, aggreagate them, and update the subcriber's member tags with the respective data values.
  - String - The extension will lokup the value in this specific field and update the subscriber's member tags with the provided value.

  3) `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp


  For Example
  ```
  {
    "watch": "trainingRegistrations/{id}",
    "memberTags": ["jobTitle", "domainKnowledge"],
    "subscriberEmail": "emailAddress"
  }
  ```

* **[Optional]** Firebase Merge Fields Config

  JSON Required Keys:
  
  1) `watch` - Specifies the Firestore collection to listen on for events. Acceptable values include:
  - `collectionName/{id}` - Wildcard config allowing Firestore to listen on all document ids in this collection
  - `collectionName/specificId` - Specific config allowing Firestore to listen on events with exact document Id.

  2) `mergeFields` - JSON mapping representing the Firestore document fields to associate with Mailchimp Merge Fields. Acceptable data types include:
  - Object - The keys represent the Firestore document fields and values indicate the merge fields they map to.

  3) `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp


  For Example
  ```
  {
    "watch": "trainingRegistrations/{id}",
    "mergeFields": {
      "firstName": "FNAME",
      "lastName": "LNAME",
      "phoneNumber": "PHONE",
      "courseName": "COURSE_NAM"
    },
    "subscriberEmail": "emailAddress"
  }
  ```

* **[Optional]** Firebase Member Events Config

  JSON Required Keys:
  
  1) `watch` - Specifies the Firestore collection to listen on for events. Acceptable values include:
  - `collectionName/{id}` - Wildcard config allowing Firestore to listen on all document ids in this collection
  - `collectionName/specificId` - Specific config allowing Firestore to listen on events with exact document Id.

  2) `memberEvents` - Indicates the Firestore document fields to retrieve data from and classify as Mailchimp events on the subscriber's activity feed. Acceptable data types include:
  - Array\<String\> - The extenion will lookup the values (mailchimp event names) in the provided fields, aggreagate them, and post those events to Mailchimp on the subcriber's activity feed.
  - String - The extension will lokup the value (mailchimp event name) in this specific field and post the event to Mailchimp on the subcriber's activity feed.

  3) `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp


  For Example
  ```
  {
    "watch": "trainingRegistrations/{id}",
    "memberEvents": ["activity"],
    "subscriberEmail": "emailAddress"
  }
  ```
