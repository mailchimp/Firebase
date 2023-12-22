# Backfill process

## Trigger onInstall|onUpdate|onConfigure

- Check backfill config, and that INSTALL|UPDATE|CONFIGURE event should trigger the process. Exit if not.
- Initialize list of tasks to queue.
  If "AUTH" is in sources, push task details to trigger addExistingUsersToList
  For "MERGE_FIELDS" | "MEMBER_TAGS" | "MEMBER_EVENTS", find the collection paths, and build a task like:
  [{
  sources: ["MERGE_FIELDS", "MEMBER_TAGS"],
  collectionPath: "doc/fields/and/tags"
  }
  {
  sources: ["MEMBER_EVENTS"],
  collectionPath: "doc/events"
  }]

Trigger the first task, passing through the first task state (mostly empty) and the remaining tasks.
The first task should be able to requeue itself as needed for paging, retries etc using its state, and then

Task dependency - if users don't exist in Mailchimp:

1. "AUTH" will work
2. "MERGE_FIELDS" will work
3. "MEMBER_TAGS" won't work
4. "MEMBER_EVENTS" won't work

```mermaid
flowchart LR

    End((End))
    PerformTasksOnInstall["Perform Tasks On Install"]
    PerformTasksOnUpdate["Perform Tasks On Update"]
    PerformTasksOnConfigure["Perform Tasks On Configure"]
    PerformTasksOnInstall-->|Event=#quot;Install#quot;|BackfillControlFlow
    PerformTasksOnUpdate -->|Event=#quot;Update#quot;| BackfillControlFlow
    PerformTasksOnConfigure -->|Event=#quot;Configure#quot;| BackfillControlFlow

    subgraph BackfillControlFlow ["Backfill Control Flow"]
      direction TB
      PerformBackfill["Perform Backfill"]
      CheckBackfillConfig{"Is Event specified\n in Backfill Config"}
      TaskComplete{"Is Task \nCompleted"}
      TaskRetry{"Can Task be \nretried/continued?"}
      TasksRemaining{"Are there any \ntasks remaining?"}
      GatherBackfillTasksToRun["Gather Backfill Tasks To Run"]
      ExecuteBackfillTask["Execute Backfill Task"]
      PerformBackfill --> CheckBackfillConfig
      CheckBackfillConfig -->|Yes| GatherBackfillTasksToRun
      CheckBackfillConfig -->|No| End
      GatherBackfillTasksToRun -->|"Task=Tasks[0],\nRemainingTasks=Tasks[1,n],\n TaskState={}"|ExecuteBackfillTask
      ExecuteBackfillTask -->|Work completed| TaskComplete
      TaskRetry -->|"Yes\nTask=Tasks[i],\nRemainingTasks=Tasks[i+1,n],\n TaskState={Retries++}"| ExecuteBackfillTask
      TaskRetry -->|"No, log failure"| End
      TaskComplete -->|"No"| TaskRetry
      TaskComplete -->|"Yes, log success"| TasksRemaining
      TasksRemaining -->|"Yes\nTask=Tasks[i+1],\nRemainingTasks=Tasks[i+2,n],\n TaskState={}"| ExecuteBackfillTask
      TasksRemaining -->|"No, log success"| End
    end

```
