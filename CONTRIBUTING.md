# Contributing

## Adding unit tests

Unit tests are able to be added to `functions/tests/` and then executed via `npm run test:watch` (in the `functions` directory).

These are the fastest way to get feedback on your new code and functionality.

## Using the Firebase Emulator

To use the firebase emulator, you'll need the following:

1. A separate Firebase Project repository. This can be a bare bones project, but needs the following features enabled (see below for an example `firebase.json`):
    1. Firestore
    1. Authentication
    1. Functions
    1. Database
    1. Hosting
    1. UI
1. This repository installed as a local extension to the Project, via the `firebase ext:install PATH_TO_THIS_REPOSITORY`
    1. This will walk you through the set up, similar to the Firebase Console.
    1. Make sure to specify a collection name
1. Start the emulators locally with `firebase emulators:start`.
1. You should then be able to add items to the collection you specified via the Firestore UI to test the triggers.

### Example firebase.json

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run lint",
      "npm --prefix \"$RESOURCE_DIR\" run build"
    ],
    "source": "functions"
  },
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  },
  "emulators": {
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "database": {
      "port": 9000
    },
    "hosting": {
      "port": 5000
    },
    "ui": {
      "enabled": true
    },
    "auth": {
      "port": 9099
    }
  }
}
```
