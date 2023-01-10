## Version 0.5.0

- Support updating Mailchimp when a user changes their email in Firebase (PR #46)
- Support extended syntax for configurations of Member Tags and Member Events, to allow multidimensional arrays to be unwrapped (PR #53)
- Added configuration validation via JSON Schema (PR #54)
- Support extended configuration for Merge Fields, so that fields can be set to continuously sync even when not changed (PR #55)

## Version 0.4.0

- Runtime and dependencies bump (#45)
- Added test coverage for all handlers (#47)

## Version 0.3.0

- List Mailchimp as an external service in Firebase Extensions configuration (PR #23)
- Support for JSON path for subscriber email config values (PR #37)
- Changed initialization process to facilitate user testing (PR #34)
- Use status_if_new with merge fields updates in case user has not yet been created in Mailchimp (PR #20)
- Added unit test setup for easier verification of features (PR #34)
- Add Warsaw cloud function location (europe-central2) (#16)

## Version 0.2.3

- Update extension name

## Version 0.2.2

- Update author name and source repo url.

## Version 0.2.1

- Update preinstall markdown and extension description.

## Version 0.2.0

- Add new Cloud Functions to support member tags, merge fields, and member events.

## Version 0.1.2

- Add new Cloud Functions locations. For more information about locations and their pricing tiers, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

## Version 0.1.1

- Update Cloud Functions runtime to Node.js 10.

## Version 0.1.0

- Initial release of the _Sync with Mailchimp_ extension.
