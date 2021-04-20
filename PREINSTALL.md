Use this extension to:
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
