### See it in action

You can test out this extension right away!

#### Add/Remove Users

1.  Go to your [Authentication dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/authentication/users) in the Firebase console.

1.  Click **Add User** to add a test user.

1.  In a few seconds, go to your Mailchimp audience page, you'll see the test user's email appear.

#### Member Tags
1.  Go to your [Firestore Database](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore) in the Firebase console.

Assuming the following params:
```
Member Tags Watch Path: registrations/{documentId}
Member Tags Watch Config:
{
  "memberTags": ["jobTitle", "domainKnowledge"],
  "subscriberEmail": "emailAddress"
}
```

1.  Click **Start collection** and provide the following name "registrations/{documentId}"

1.  Click **Add document** and populate the document:
```
{
  emailAddress: "{A_MAILCHIMP_SUBSCRIBER_EMAIL_ADDRESS}",
  jobTitle: "Marketing Manager"
}
```

1.  Confirm the user data has been updated in the "Tags" portion of your Mailchimp account: https://admin.mailchimp.com/lists/members/view?id={YOUR_MAILCHIMP_ACCOUNT_ID}

#### Merge Fields
1.  Go to your [Firestore Database](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore) in the Firebase console.

Assuming the following params:
```
Merge Fields Watch Path: registrations/{documentId}
Merge Fields Watch Config:
{
  "mergeFields": {
    "firstName": "FNAME",
    "lastName": "LNAME",
    "phoneNumber": "PHONE",
    "courseName": "COURSE_NAM"
  },
  "subscriberEmail": "emailAddress"
}
```

1.  Click **Start collection** and provide the following name "registrations/{documentId}"

1.  Click **Add document** and populate the document:
```
{
  emailAddress: "{A_MAILCHIMP_SUBSCRIBER_EMAIL_ADDRESS}",
  firstName: "Janet",
  phoneNumber: "000-111-2222",
  courseName: "Mailchimp Marketing Campaigns"
}
```

1.  Confirm the user data has been updated in the "Profile Information" portion of your Mailchimp account: https://admin.mailchimp.com/lists/members/view?id={YOUR_MAILCHIMP_ACCOUNT_ID}

#### Member Events
1.  Go to your [Firestore Database](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore) in the Firebase console.

Assuming the following params:
```
Member Events Watch Path: registrations/{documentId}
Member Events Watch Config:
{
  "memberEvents": ["activity"],
  "subscriberEmail": "emailAddress"
}
```

1.  Click **Start collection** and provide the following name "registrations/{documentId}"

1.  Click **Add document** and populate the document:
```
{
  emailAddress: "{A_MAILCHIMP_SUBSCRIBER_EMAIL_ADDRESS}",
  activity: ['training_registration', 'welcome_email', 'reminder_email']
}
```

1.  Click **Add document** and populate the document:

1.  Confirm the event has been registered in the "Activity Feed" portion of your Mailchimp account: https://admin.mailchimp.com/lists/members/view?id={YOUR_MAILCHIMP_ACCOUNT_ID}

### Using the extension

Whenever a new user is added your app, this extension adds the user's email address to your specified Mailchimp audience.

Also, if the user deletes their user account for your app, this extension removes the user from the Mailchimp audience.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
