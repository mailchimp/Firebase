# Firebase Mailchimp Extension

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Adds new users from Firebase Authentication to a specified Mailchimp audience.



**Details**: Use this extension to:
 - Add new users to an existing [Mailchimp](https://mailchimp.com) audience.
 - Remove user from an existing Mailchimp audience
 - Associate tags/metadata/labels with a Mailchimp subscriber
 - Associate user data to Mailchimp subscriber via merge fields
 - Specify activity events that can trigger Mailchimp actions and automations 

#### Additional setup

This extension uses [Firebase Authentication](https://firebase.google.com/docs/auth) to manage (add/remove) users and Firestore to create member tag, merge field, and member event associations with Mailchimp.

This extension uses Mailchimp, so you'll need to supply your [Mailchimp OAuth Token](http://firebase.mailchimp.com/index.html) and Audience ID when installing this extension.

#### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
  - Cloud Functions (Node.js 10+ runtime. See [FAQs](https://firebase.google.com/support/faq#expandable-24))

Usage of this extension also requires you to have a Mailchimp account. You are responsible for any associated costs with your usage of Mailchimp.




**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension?

* Mailchimp OAuth Token: To obtain a Mailchimp OAuth Token, login to [Mailchimp](http://firebase.mailchimp.com/index.html).

* Audience ID: What is the Mailchimp Audience ID to which you want to subscribe new users? To find your Audience ID: visit https://admin.mailchimp.com/lists, click on the desired audience or create a new audience, then select **Settings**. Look for **Audience ID** (for example, `27735fc60a`).

* Contact status: When the extension adds a new user to the Mailchimp audience, what is their initial status? This value can be `subscribed` or `pending`. `subscribed` means the user can receive campaigns; `pending` means the user still needs to opt-in to receive campaigns.

* Firebase Member Tags Watch Path: Specify the Firestore collection to listen for member tag changes

* Firebase Member Tags Config: Provide a JSON configuration specifying which events in Firebase the extension  should listen on to associate Mailchimp member tags to a subscriber.
Required Keys:
1) `memberTags` - Indicates the Firestore document fields to retrieve data from and classify as subscriber tags in Mailchimp. Acceptable data types include: - Array\<String\> - The extenion will lookup the values in the provided fields, aggreagate them, and update the subcriber's member tags with the respective data values. - String - The extension will lookup the value in this specific field and update the subscriber's member tags with the provided value.
2) `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp

* Firebase Merge Fields Watch Path: Specify the Firestore collection to listen for merge field changes

* Firebase Merge Fields Config: Provide a JSON configuration specifying which events in Firebase the extension  should listen on to associate document data with the subscriber's merge fields.
Required Keys:
1) `mergeFields` - JSON mapping representing the Firestore document fields to associate with Mailchimp Merge Fields. Acceptable data types include: - Object - The keys represent the Firestore document fields and values indicate the merge fields they map to.
2) `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp

* Firebase Member Events Watch Path: Specify the Firestore collection to listen for member event changes

* Firebase Member Events Config: Provide a JSON configuration specifying which events in Firebase the extension  should listen on to associate document data with a particular event on the subscriber's profile. 
Required Keys:
1) `memberEvents` - Indicates the Firestore document fields to retrieve data from and classify as Mailchimp events on the subscriber's activity feed. Acceptable data types include: - Array\<String\> - The extenion will lookup the values (mailchimp event names) in the provided fields, aggreagate them, and post those events to Mailchimp on the subcriber's activity feed. - String - The extension will lookup the value (mailchimp event name) in this specific field and post the event to Mailchimp on the subcriber's activity feed.
2) `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp



**Cloud Functions:**

* **addUserToList:** Listens for new user accounts (as managed by Firebase Authentication), then automatically adds the new user to your specified MailChimp audience.

* **removeUserFromList:** Listens for existing user accounts to be deleted (as managed by Firebase Authentication), then automatically removes them from your specified MailChimp audience.

* **memberTagsHandler:** Member Tags provide the ability to associate "metadata" or "labels" with a Mailchimp subscriber. The memberTagsHandler function listens for Firestore write events based on specified config path, then automatically classifies the document data as Mailchimp subscriber tags.

* **mergeFieldsHandler:** Merge fields provide the ability to create new properties that can be associated with Mailchimp subscriber. The mergeFieldsHandler function listens for Firestore write events based on specified config path, then automatically populates the Mailchimp subscriber's respective merge fields.

* **memberEventsHandler:** Member events are Mailchimp specific activity events that can be created and associated with a predefined action. The memberEventsHandler function Listens for Firestore write events based on specified config path, then automatically uses the document data to create a Mailchimp event on the subscriber's profile which can subsequently trigger automation workflows.
