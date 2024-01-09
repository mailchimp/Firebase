const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getExtensions } = require("firebase-admin/extensions");
const { getFunctions } = require("firebase-admin/functions");
const { config, logs, addUser, syncMemberTags, syncMergeFields } = require("./core");

/**
 * @typedef {('SYNC_AUTH'|'SYNC_FIRESTORE')} BackfillTaskType
 */

/**
 * @typedef {object} BackfillTask
 * @property {BackfillTaskType} type
 * @property {import("../read-config").BackfillConfigSource} sources
 * @property {string} [collectionPath]
 */
/**
 * @typedef {object} BackfillTaskData
 * @property {BackfillTask} task
 * @property {BackfillTask[]} remainingTasks
 * @property {object} taskState
 */

/**
 * @typedef {"PASS"|"FAIL"|"CONTINUE"} TaskResultStatus
 */

/**
 * @typedef {object} TaskResult
 * @property {TaskResultStatus} status
 * @property {object} [continueTaskState]
 */

/**
 *
 * @param {import("./backfill").BackfillTaskData} data
 */
async function enqueueBackfillTask(data) {
  const queue = getFunctions().taskQueue("executeBackfillTask", process.env.EXT_INSTANCE_ID);
  await queue.enqueue(data);
}

/**
 *
 * @param {import("./read-config").BackfillConfig} backfillConfig
 * @returns {BackfillTask[]} tasks
 */
function gatherBackfillTasksToRun(backfillConfig) {
  const configSources = backfillConfig.sources ?? [];

  /** @type {BackfillTask[]} */
  const tasksToRun = [];
  if (configSources.includes("AUTH")) {
    tasksToRun.push({
      type: "SYNC_AUTH",
      sources: ["AUTH"],
    });
  }

  const remainingSourcesToPaths = {
    MERGE_FIELDS: config.mailchimpMergeFieldWatchPath,
    MEMBER_TAGS: config.mailchimpMemberTagsWatchPath,
    MEMBER_EVENTS: config.mailchimpMemberEventsWatchPath,
  };

  const pathToSources = configSources.reduce((allPathsToSources, source) => {
    if (Object.hasOwn(remainingSourcesToPaths, source)) {
      const collectionPath = remainingSourcesToPaths[source];
      if (Object.hasOwn(allPathsToSources, collectionPath)) {
        allPathsToSources[collectionPath].push(source);
      } else {
        // eslint-disable-next-line no-param-reassign
        allPathsToSources[collectionPath] = [source];
      }
    }
    return allPathsToSources;
  }, {});

  Object.entries(pathToSources).forEach(([collectionPath, sources]) => {
    tasksToRun.push({
      type: "SYNC_FIRESTORE",
      sources,
      collectionPath,
    });
  });

  return tasksToRun;
}

/**
 *
 * @param {import("./read-config").BackfillConfigEvent} trigger
 * @returns
 */
async function performBackfill(trigger) {
  const runtime = getExtensions().runtime();
  if (!config.backfillConfig?.events?.includes(trigger)) {
    await runtime.setProcessingState("PROCESSING_COMPLETE", "No processing requested.");
    return;
  }
  const backfillTasks = gatherBackfillTasksToRun(config.backfillConfig);
  if (backfillTasks.length) {
    const firstTask = backfillTasks.shift();
    await enqueueBackfillTask({ task: firstTask, remainingTasks: backfillTasks });
  }
}

/**
 * Synchronise users from Firebase Auth to Mailchimp
 * @param {object} [taskState]
 * @returns {Promise<import("./backfill").TaskResult>} The task result
 */
async function syncAuth(taskState) {
  const { nextPageToken } = taskState;
  const pastSuccessCount = parseInt(taskState.successCount, 10) ?? 0;
  const pastErrorCount = parseInt(taskState.errorCount, 10) ?? 0;

  const res = await getAuth().listUsers(100, nextPageToken);
  const mailchimpPromises = res.users.map(async (user) => {
    try {
      await addUser(user);
    } catch (err) {
      if (err.title === "Member Exists") {
        logs.userAlreadyInAudience(user.uid, config.mailchimpAudienceId);
        // Don't throw error if the member already exists.
      } else {
        logs.errorAddUser(err);
        // For other errors, rethrow them so that we can report
        //  the total number at the end of the lifecycle event.
        throw err;
      }
    }
  });

  const continueTaskState = structuredClone(taskState);
  const results = await Promise.allSettled(mailchimpPromises);
  const fulfilledRequests = results.filter((p) => p.status === "fulfilled").length;
  const rejectedRequests = results.filter((p) => p.status === "rejected").length;
  const errorRate = results.length ? rejectedRequests / results.length : 0;
  continueTaskState.successCount = pastSuccessCount + fulfilledRequests;
  continueTaskState.errorCount = pastErrorCount + rejectedRequests;
  continueTaskState.lastBatchErrorRate = errorRate;

  // TODO: Should this be a configurable rate?
  if (errorRate >= 1) {
    return { status: "FAIL", continueTaskState };
  }

  if (res.pageToken) {
    continueTaskState.nextPageToken = res.pageToken;
    return { status: "CONTINUE", continueTaskState };
  }

  return { status: "PASS", continueTaskState };
}

/**
 *
 * @param {FirebaseFirestore.DocumentData} doc
 * @param {import("./read-config").BackfillConfigSource} sources
 */
async function syncFirestoreDocument(doc, sources) {
  if (sources.includes("MERGE_FIELDS")) {
    await syncMergeFields(doc);
  }
  if (sources.includes("MEMBER_TAGS")) {
    await syncMemberTags(doc);
  }
  // TODO: Events sync process needs to be idempotent
  // if (sources.includes("MEMBER_EVENTS")) {
  //   await syncMemberEvents(doc);
  // }
}

/**
 * Synchronize data between firestore and mailchimp.
 *
 * @param {import("./backfill").BackfillTask} task
 * @param {object} [taskState]
 * @returns {Promise<import("./backfill").TaskResult>} The task result
 */
async function syncFirestore(task, taskState) {
  const { nextPageToken } = taskState;
  const { collectionPath, sources } = task;
  const pastSuccessCount = parseInt(taskState.successCount, 10) ?? 0;
  const pastErrorCount = parseInt(taskState.errorCount, 10) ?? 0;

  let query = getFirestore().collection(collectionPath).limit(100);
  if (nextPageToken) {
    query = query.startAfter({ id: nextPageToken });
  }
  const res = await query.get();

  const mailchimpPromises = res.docs.map(async (doc) => {
    try {
      await syncFirestoreDocument(doc, sources);
    } catch (err) {
      logs.errorSyncFirestore(err);
      // For other errors, rethrow them so that we can report
      //  the total number at the end of the lifecycle event.
      throw err;
    }
  });

  const continueTaskState = structuredClone(taskState);
  const results = await Promise.allSettled(mailchimpPromises);
  const fulfilledRequests = results.filter((p) => p.status === "fulfilled").length;
  const rejectedRequests = results.filter((p) => p.status === "rejected").length;
  const errorRate = results.length ? rejectedRequests / results.length : 0;
  continueTaskState.successCount = pastSuccessCount + fulfilledRequests;
  continueTaskState.errorCount = pastErrorCount + rejectedRequests;
  continueTaskState.lastBatchErrorRate = errorRate;

  // TODO: Should this be a configurable rate?
  if (errorRate >= 1) {
    return { status: "FAIL", continueTaskState };
  }

  if (res.docs.length) {
    continueTaskState.nextPageToken = res.docs.at(-1).id;
    return { status: "CONTINUE", continueTaskState };
  }

  return { status: "PASS", continueTaskState };
}

module.exports = {
  performBackfill,
  syncAuth,
  syncFirestore,
};
