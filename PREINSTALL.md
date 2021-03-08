Use this extension to:
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
