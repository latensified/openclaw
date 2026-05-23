# Task Manager Project And Task Capture Definition

Date: 2026-05-23

Scope: define what "project creation" and "task capture" mean for OpenClaw
Task Manager work so new workstreams survive session drift.

## Source Reality

- `docs/automation/tasks.md` defines tasks as the activity ledger for detached
  work. ACP runs, subagents, cron executions, CLI operations, and session-backed
  media jobs create task records. Normal interactive chat and heartbeat turns
  do not.
- `src/tasks/task-registry.types.ts` defines `TaskRecord`. A task has a
  `taskId`, `runtime`, `requesterSessionKey`, `ownerKey`, `scopeKind`, optional
  `childSessionKey`, optional `parentFlowId`, optional `parentTaskId`, optional
  `sourceId`, status, delivery state, notify policy, timestamps, and summaries.
- `docs/automation/taskflow.md` defines Task Flow as durable orchestration above
  tasks. Use it for multi-step work; use plain tasks for single detached jobs.
- `src/tasks/task-flow-registry.types.ts` defines `TaskFlowRecord`. A flow has a
  `flowId`, `syncMode`, `ownerKey`, optional `controllerId`, revision, status,
  notify policy, `goal`, optional current step, optional blocked task details,
  state, wait state, and timestamps.
- There is no first-class `ProjectRecord` in OpenClaw's task registry today.
  "Project" currently means either an external tracker grouping or a project-like
  Task Flow goal, depending on caller context.

## Definitions

- **Project**: a durable planning/workstream grouping with a name, source,
  owner, status, and child task list. OpenClaw core does not currently store this
  as a task-registry entity.
- **Task capture**: creating a durable row for a concrete piece of detached work
  or an external tracker item. Captured means a stable id exists outside the
  agent's conversational memory.
- **Task Flow**: the OpenClaw-native project-like primitive for multi-step
  detached work. A flow coordinates tasks; it is not a general planning project
  tracker.
- **Background task**: an OpenClaw task-registry row for detached runtime work.
  It is evidence that work ran or is running, not evidence that a planning
  project was created.

## Capture Contract

When an agent says a project or task has been captured, one of these must be
true:

1. It has a durable external tracker id and the agent can report that id or a
   direct lookup route.
2. It has an OpenClaw `taskId` because detached work was actually started.
3. It has an OpenClaw `flowId` because Task Flow state was actually created.

If none of those is true, the agent should say it has a proposal, note, or plan,
not a captured task.

## Project Creation Contract

Project creation must be explicit:

- Required fields: project name or goal, owner/scope, source of request, created
  timestamp, initial status, and whether tasks are manually managed, mirrored, or
  managed by Task Flow.
- A new project/workstream must return or store a stable project id, `flowId`, or
  external tracker URL before any agent claims it exists.
- Follow-up tasks should store the project id or `flowId` at creation time.
  Reconstructing a project only from chat history is not durable enough.
- If creation fails, the agent must report the failure and not continue as if the
  project exists.

## Task Capture Contract

Captured task rows should include:

- The concrete task text or goal.
- The source request/session or external source id.
- The owner/scope responsible for visibility and access checks.
- Status and notify policy.
- Parent linkage (`parentFlowId`, `parentTaskId`, or external project id) when
  the task belongs to a larger workstream.
- A terminal summary or blocking reason once completed.

## Session-Drift Rules

- On resume, read durable task/project state before relying on remembered chat
  context.
- Do not infer unfinished project work from old conversational phrasing when no
  task, flow, or tracker row exists.
- Prefer push-based task completion updates over polling loops, matching the
  background task contract in `docs/automation/tasks.md`.
- Heartbeat can notice task completion, but heartbeat itself is not a captured
  task or project.

## Recommended Follow-Ups

- If the external Task Manager is intended to be canonical for projects, add a
  small API/schema contract for project create, task create, status update, and
  lookup-by-project.
- If OpenClaw core should own project-like workstreams, extend Task Flow docs and
  APIs rather than overloading plain task records.
- Add tests only after the chosen project surface exists. Today the source
  already tests task registry and Task Flow persistence, but there is no project
  entity to test.
