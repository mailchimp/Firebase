const _ = require("lodash");
const { auth, firestore, logger, tasks } = require("firebase-functions");
const mailchimp = require("@mailchimp/mailchimp_marketing");
const { initializeApp } = require("firebase-admin/app");
const { getExtensions } = require("firebase-admin/extensions");
const rawConfig = require("./config");
const {
  config,
  processConfig,
  addUser,
  errorFilterFor404,
  retry,
  subscriberHasher,
  syncMemberTags,
  syncMergeFields,
  resolveValueFromDocumentPath,
  getSubscriberEmail,
} = require("./core");
const { syncAuth, syncFirestore, enqueueBackfillTask, performBackfill } = require("./backfill");
const logs = require("./logs");

initializeApp();
logs.init();

try {
  processConfig(rawConfig);

  // Configure mailchimp api client
  // The datacenter id is appended to the API key in the form key-dc;
  // if your API key is 0123456789abcdef0123456789abcde-us6, then the data center subdomain is us6
  // See https://mailchimp.com/developer/marketing/guides/quick-start/
  // See https://github.com/mailchimp/mailchimp-marketing-node/
  // See https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
  const apiKey = config.mailchimpOAuthToken;

  const apiKeyParts = apiKey.split("-");

  if (apiKeyParts.length === 2) {
    const server = apiKeyParts.pop();
    mailchimp.setConfig({
      apiKey,
      server,
    });
  } else {
    throw new Error("Unable to set Mailchimp configuration");
  }
} catch (err) {
  logs.initError(err);
}

exports.addUserToList = auth.user().onCreate(async (user) => {
  logs.start();

  if (!mailchimp) {
    logs.mailchimpNotInitialized();
    return;
  }

  try {
    // this call is not retried, as a 404 here indicates
    //  the audience ID is incorrect which will not change.
    const userAdded = await addUser(user);
    if (userAdded) {
      logs.complete();
    }
  } catch (err) {
    if (err.title === "Member Exists") {
      logs.userAlreadyInAudience(user.uid, config.mailchimpAudienceId);
    } else {
      logs.errorAddUser(err);
    }
  }
});

exports.removeUserFromList = auth.user().onDelete(async (user) => {
  logs.start();

  if (!mailchimp) {
    logs.mailchimpNotInitialized();
    return;
  }

  const { email, uid } = user;
  if (!email) {
    logs.userNoEmail();
    return;
  }

  try {
    const hashed = subscriberHasher(email);

    logs.userRemoving(uid, hashed, config.mailchimpAudienceId);
    await retry(
      () => mailchimp.lists.deleteListMember(config.mailchimpAudienceId, hashed),
      errorFilterFor404,
    );
    logs.userRemoved(uid, hashed, config.mailchimpAudienceId);
    logs.complete();
  } catch (err) {
    if (err.title === "Method Not Allowed") {
      logs.userNotInAudience();
    } else {
      logs.errorRemoveUser(err);
    }
  }
});

exports.memberTagsHandler = firestore
  .document(config.mailchimpMemberTagsWatchPath)
  .onWrite(async (event) => {
    // If an empty JSON configuration was provided then consider function as NO-OP
    if (_.isEmpty(config.mailchimpMemberTags)) return;

    try {
      // Get snapshot of document before & after write event
      const prevDoc = event?.before?.data();
      const newDoc = event?.after?.data();
      await syncMemberTags(newDoc, prevDoc);
    } catch (e) {
      logger.log(e);
    }
  });

exports.mergeFieldsHandler = firestore
  .document(config.mailchimpMergeFieldWatchPath)
  .onWrite(async (event) => {
    // If an empty JSON configuration was provided then consider function as NO-OP
    if (_.isEmpty(config.mailchimpMergeField)) return;

    try {
      // Get snapshot of document before & after write event
      const prevDoc = event?.before?.data();
      const newDoc = event?.after?.data();

      await syncMergeFields(newDoc, prevDoc);
    } catch (e) {
      logger.log(e);
    }
  });

/**
 * Sync merge fields between Firestore and Mailchimp according to changes
 * between the provided documents.
 * @param {FirebaseFirestore.DocumentData | undefined} newDoc
 * @param {FirebaseFirestore.DocumentData | undefined} prevDoc
 */
async function syncMemberEvents(newDoc, prevDoc) {
  // Get the configuration settings for mailchimp custom events as is defined in extension.yml
  const eventsConfig = config.mailchimpMemberEvents;

  // Validate proper configuration settings were provided
  if (!mailchimp) {
    logs.mailchimpNotInitialized();
    return;
  }
  if (!eventsConfig.memberEvents) {
    logger.log(`A property named 'memberEvents' is required`);
    return;
  }
  if (!Array.isArray(eventsConfig.memberEvents)) {
    logger.log(`'memberEvents' property must be an array`);
    return;
  }

  // Retrieves subscriber tags before/after write event
  const getMemberEventsFromSnapshot = (snapshot) =>
    eventsConfig.memberEvents.reduce((acc, memberEventConfiguration) => {
      const events = resolveValueFromDocumentPath(snapshot, memberEventConfiguration);
      if (Array.isArray(events) && events && events.length) {
        return [...acc, ...events];
      }
      if (events) {
        return acc.concat(events);
      }
      return acc;
    }, []);

  // Get all member events prior to write event
  const prevEvents = prevDoc ? getMemberEventsFromSnapshot(prevDoc) : [];
  // Get all member events after write event
  const newEvents = newDoc ? getMemberEventsFromSnapshot(newDoc) : [];
  // Find the intersection of both collections
  const memberEvents = newEvents.filter((e) => !prevEvents.includes(e));

  // Compute the mailchimp subscriber email hash
  const subscriberHash = subscriberHasher(
    getSubscriberEmail(prevDoc, newDoc, eventsConfig.subscriberEmail),
  );

  // Invoke mailchimp API with new events
  if (memberEvents?.length) {
    const requests = memberEvents.reduce((acc, name) => {
      acc.push(
        retry(
          () =>
            mailchimp.lists.createListMemberEvent(config.mailchimpAudienceId, subscriberHash, {
              name,
            }),
          errorFilterFor404,
        ),
      );
      return acc;
    }, []);
    await Promise.all(requests);
  }
}

exports.memberEventsHandler = firestore
  .document(config.mailchimpMemberEventsWatchPath)
  .onWrite(async (event) => {
    // If an empty JSON configuration was provided then consider function as NO-OP
    if (_.isEmpty(config.mailchimpMemberEvents)) return;

    try {
      // Get snapshot of document before & after write event
      const prevDoc = event?.before?.data();
      const newDoc = event?.after?.data();

      await syncMemberEvents(newDoc, prevDoc);
    } catch (e) {
      logger.log(e);
    }
  });

exports.executeBackfillTask = tasks
  .taskQueue()
  .onDispatch(async (/** @type {import("./backfill").BackfillTaskData} */ data) => {
    const runtime = getExtensions().runtime();
    // eslint-disable-next-line no-console
    console.log({ data });
    const { task, taskState, remainingTasks } = data;
    /** @type {import("./backfill").TaskResultStatus} */
    let taskResultStatus = "FAIL";
    let nextTaskState = null;

    switch (task.type) {
      case "SYNC_AUTH": {
        const { status, continueTaskState } = await syncAuth(taskState);
        taskResultStatus = status;
        nextTaskState = continueTaskState;
        break;
      }
      case "SYNC_FIRESTORE": {
        const { status, continueTaskState } = await syncFirestore(task, taskState);
        taskResultStatus = status;
        nextTaskState = continueTaskState;
        break;
      }
      default:
        logs.unrecognizedTaskType(task.type);
        break;
    }

    if (taskResultStatus === "PASS") {
      logs.taskSucceeded(task.type, { task, nextTaskState });
      const nextTask = remainingTasks.shift();
      if (nextTask) {
        await enqueueBackfillTask({
          task: nextTask,
          remainingTasks,
        });
      } else {
        await runtime.setProcessingState("PROCESSING_COMPLETE", `Backfill process completed!.`);
      }
    } else if (taskResultStatus === "CONTINUE") {
      logs.taskContinued(task.type, { task, nextTaskState });
      await enqueueBackfillTask({
        task,
        remainingTasks,
        taskState: nextTaskState,
      });
    } else {
      const canRetry = false; // TODO: Add to config the retry level
      if (canRetry) {
        logs.taskAttemptFailed(task.type, { task, nextTaskState });
        await runtime.setProcessingState(
          "PROCESSING_WARNING",
          `Task ${task.type} attempt failed and will be retried`,
        );
        await enqueueBackfillTask({
          task,
          remainingTasks,
          taskState,
        });
      } else {
        logs.taskFailed(task.type, { task, nextTaskState });
        await runtime.setProcessingState(
          "PROCESSING_FAILED",
          `Task ${task.type} failed and cannot be retried. Check function logs for more information.`,
        );
      }
    }
  });

exports.performTasksOnInstall = tasks.taskQueue().onDispatch(async () => {
  await performBackfill("INSTALL");
});
exports.performTasksOnUpdate = tasks.taskQueue().onDispatch(async () => {
  await performBackfill("UPDATE");
});
exports.performTasksOnConfigure = tasks.taskQueue().onDispatch(async () => {
  await performBackfill("CONFIGURE");
});

exports.processConfig = processConfig;
