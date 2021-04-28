# Mailchimp Firebase Sync

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: This extension uses Firebase Authentication to manage (add/remove) users and Firestore to create member tags, merge fields, and member events with Mailchimp.



**Details**: Use this extension to:
 - Add new users to an existing [Mailchimp](https://mailchimp.com) audience.
 - Remove user from an existing Mailchimp audience
 - Associate member tags with a Mailchimp subscriber
 - Use merge fields to sync user data with a Mailchimp subscriber
 - Set member events to trigger Mailchimp actions and automations 

#### Additional setup

This extension uses the following Firebase products:
 - [Authentication](https://firebase.google.com/docs/auth) to manage (add/remove) users
 - [Cloud Firestore](https://firebase.google.com/docs/firestore) to create member tags, merge fields, and member events with Mailchimp.

This extension uses Mailchimp, so you'll need to supply your [Mailchimp OAuth Token](http://firebase.mailchimp.com/index.html) and Audience ID when installing this extension.

#### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
  - Cloud Functions (Node.js 10+ runtime. See [FAQs](https://firebase.google.com/support/faq#expandable-24))

Usage of this extension also requires you to have a Mailchimp account. You are responsible for any associated costs with your usage of Mailchimp.




#### Configuration Parameters

* Cloud Functions location: Where do you want to deploy the functions created for this extension?

* Mailchimp OAuth Token: To obtain a Mailchimp OAuth Token, click [here](https://firebase.mailchimp.com/index.html).

* Audience ID: What is the Mailchimp Audience ID to which you want to subscribe new users? To find your Audience ID: visit https://admin.mailchimp.com/lists, click on the desired audience or create a new audience, then select **Settings**. Look for **Audience ID** (for example, `27735fc60a`).

* Contact status: When the extension adds a new user to the Mailchimp audience, what is their initial status? This value can be `subscribed` or `pending`. `subscribed` means the user can receive campaigns; `pending` means the user still needs to opt-in to receive campaigns.

* Firebase Member Tags Watch Path: The Firestore collection to watch for member tag changes

* Firebase Member Tags Config: Provide a configuration mapping in JSON format indicating which Firestore event(s) to listen for and associate as Mailchimp member tags.

  * Required Fields:
  
    1. `memberTags` - The Firestore document fields(s) to retrieve data from and classify as subscriber tags in Mailchimp. Acceptable data types include:
        - `Array<String>` - The extension will lookup the values in the provided fields and update the subscriber's member tags with the respective data values.

        - `String` - The extension will lookup the value in the provided field and update the subscriber's member tags with the provided value.

    2. `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp

    Configuration Example:
    
    ``` 
    {
      "memberTags": ["domainKnowledge", "jobTitle"],
      "subscriberEmail": "emailAddress"
    } 
    ```

    Based on the sample configuration, if the following Firestore document is provided:
     
    ``` 
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

    Any data associated with the mapped fields will be considered Member Tags and the Mailchimp user's profile will be updated accordingly.

    **NOTE: To disable this cloud function listener, provide an empty JSON config `{}`.**

* Firebase Merge Fields Watch Path: The Firestore collection to watch for merge field changes

* Firebase Merge Fields Config: Provide a configuration mapping in JSON format indicating which Firestore event(s) to listen for and associate as Mailchimp merge fields.

  * Required Fields:
    1. `mergeFields` - JSON mapping representing the Firestore document fields to associate with Mailchimp Merge Fields.
    
    2. `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp

    Configuration Example:
    ``` 
    {
      "mergeFields": {
        "firstName": "FNAME",
        "lastName": "LNAME",
        "phoneNumber": "PHONE"
      },
      "subscriberEmail": "emailAddress"
    } 
    ```
    
    Based on the sample configuration, if the following Firestore document is provided: 
    ``` 
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
    
    Any data associated with the mapped fields will be considered Merge Fields and the Mailchimp user's profile will be updated accordingly.
    
    **NOTE: To disable this cloud function listener, provide an empty JSON config `{}`.**

* Firebase Member Events Watch Path: The Firestore collection to watch for member event changes

* Firebase Member Events Config: Provide a configuration mapping in JSON format indicating which Firestore event(s) to listen for and associate as Mailchimp merge events.

  * Required Fields:
    1. `memberEvents` - The Firestore document fields(s) to retrieve data from and classify as member events in Mailchimp. Acceptable data types include:
        - `Array<String>` - The extension will lookup the values (mailchimp event names) in the provided fields and post those events to Mailchimp on the subscriber's activity feed.
        
        - `String` - The extension will lookup the value (mailchimp event name) in this specific field and post the event to Mailchimp on the subscriber's activity feed.
    
    2. `subscriberEmail` - The Firestore document field capturing the user email as is recognized by Mailchimp
    
    Configuration Example:
    ``` 
    {
      "memberEvents": [
        "activity"
      ],
      "subscriberEmail": "emailAddress"
    } 
    ```
    
    Based on the sample configuration, if the following Firestore document is provided: 
    ``` 
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
    
    Any data associated with the mapped fields will be considered Merge Fields and the Mailchimp user's profile will be updated accordingly.
    
    NOTE: To disable this cloud function listener, provide an empty JSON config `{}`.



**Cloud Functions:**

* **addUserToList:** Listens for new user accounts (as managed by Firebase Authentication), then automatically adds the new user to your specified MailChimp audience.

* **removeUserFromList:** Listens for existing user accounts to be deleted (as managed by Firebase Authentication), then automatically removes them from your specified MailChimp audience.

* **memberTagsHandler:** Member Tags provide the ability to associate "metadata" or "labels" with a Mailchimp subscriber. The memberTagsHandler function listens for Firestore write events based on specified config path, then automatically classifies the document data as Mailchimp subscriber tags.

* **mergeFieldsHandler:** Merge fields provide the ability to create new properties that can be associated with Mailchimp subscriber. The mergeFieldsHandler function listens for Firestore write events based on specified config path, then automatically populates the Mailchimp subscriber's respective merge fields.

* **memberEventsHandler:** Member events are Mailchimp specific activity events that can be created and associated with a predefined action. The memberEventsHandler function Listens for Firestore write events based on specified config path, then automatically uses the document data to create a Mailchimp event on the subscriber's profile which can subsequently trigger automation workflows.
