# Startup-Visible Files Audit

Date: 2026-05-23

Scope: workspace files that can become startup-visible agent context, plus the
runtime gates that decide which sessions receive them.

## Runtime Source Of Truth

- `src/agents/workspace.ts` owns the recognized bootstrap basenames and the root
  workspace load order: `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`,
  `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md`, and optional `MEMORY.md`.
- `src/agents/bootstrap-files.ts` owns run-specific filtering after files are
  loaded: stale root `BOOTSTRAP.md` removal after setup, subagent and cron
  allowlists, lightweight heartbeat/cron context, heartbeat suppression when
  default-agent heartbeat guidance is disabled, hook result sanitization, and
  path dedupe.
- `src/hooks/bundled/bootstrap-extra-files/handler.ts` is the supported way to
  add more startup-visible workspace files by path or glob. It intentionally
  re-applies `filterBootstrapFilesForSession(...)` after extras are added.
- `src/agents/pi-embedded-runner/run/attempt.ts` preloads bootstrap files before
  workspace bootstrap routing, builds context files, remaps them into the
  effective workspace, and keeps `BOOTSTRAP.md` out of normal non-bootstrap
  turns.
- `src/agents/pi-hooks/compaction-safeguard.ts` separately extracts only
  selected `AGENTS.md` sections (`Session Startup` and `Red Lines`, with legacy
  fallbacks) for compaction summaries.

## Current Visibility Matrix

- Main/default full context: root bootstrap files may be visible, subject to
  stale `BOOTSTRAP.md`, heartbeat, truncation, and harness-specific gates.
- Subagent sessions: `AGENTS.md` and `TOOLS.md` only.
- Cron sessions in full context: `AGENTS.md`, `SOUL.md`, `TOOLS.md`,
  `IDENTITY.md`, and `USER.md`.
- Cron/default lightweight context: empty by design.
- Heartbeat lightweight context: `HEARTBEAT.md` only.
- Native Codex harness: `AGENTS.md` is expected to come through Codex
  project-doc discovery; `SOUL.md`, `IDENTITY.md`, `TOOLS.md`, and `USER.md`
  are forwarded as developer instructions; `HEARTBEAT.md` is referenced by a
  heartbeat note instead of injected; active `BOOTSTRAP.md` and `MEMORY.md`
  keep the normal turn-context path.

## Audit Findings

1. The runtime enforcement path is more centralized than the documentation
   implies. `workspace.ts` and `bootstrap-files.ts` are the canonical code path;
   docs and templates repeat the file list in several places and do not always
   mention the same run-kind gates.
2. `docs/reference/templates/AGENTS.md` gives a partial startup-context list
   (`AGENTS.md`, `SOUL.md`, `USER.md`, recent daily memory, and `MEMORY.md` in
   main sessions). It omits some standard bootstrap files and can make agents
   think manual rereads are needed when runtime context already handled them.
3. `docs/automation/standing-orders.md` describes all bootstrap files as
   automatically injected every session. That is too broad for subagents, cron,
   heartbeat lightweight context, and native Codex harness routing.
4. `docs/concepts/agent-workspace.md` and `docs/concepts/system-prompt.md` are
   the closest user-facing descriptions, but they split the canonical file map
   from the run-kind visibility rules. Operators looking for "what always
   loads?" have to stitch the answer together.
5. `bootstrap-extra-files` only loads recognized basenames. A future shared
   customization registry with an arbitrary filename will not become
   startup-visible unless it is named as a recognized bootstrap file, referenced
   from a loaded file, or the recognized-name contract is deliberately expanded.
6. Compaction preservation is narrower than startup visibility. Critical rules
   outside the extracted `AGENTS.md` sections can be visible at startup but not
   explicitly reinserted into compaction summaries.
7. Skipped extra-bootstrap candidates are logged at debug level only. That keeps
   normal runs quiet, but it means misnamed or unsafe customization files can
   silently fail from the operator's point of view unless diagnostics are
   inspected.

## Existing Checks

- `src/agents/workspace.test.ts` covers root load order, `MEMORY.md` exact-name
  handling, and subagent/cron filtering.
- `src/agents/bootstrap-files.test.ts` covers stale `BOOTSTRAP.md`, hook
  sanitization/dedupe, heartbeat filtering, lightweight context, and
  subagent/cron session filters.
- `src/hooks/bundled/bootstrap-extra-files/handler.test.ts` now covers
  customization sentinel files across main, cron, and subagent sessions.

## Recommended Follow-Ups

- Treat `src/agents/workspace.ts` plus `src/agents/bootstrap-files.ts` as the
  canonical source for startup visibility. New docs should link back to that
  behavior instead of restating an unconditional list.
- Tighten `docs/reference/templates/AGENTS.md` and
  `docs/automation/standing-orders.md` so they describe conditional visibility,
  especially subagent, cron, heartbeat, Codex harness, and `MEMORY.md` gates.
- If a shared customization registry is introduced, decide whether it should be
  a recognized bootstrap basename, an `AGENTS.md`/`TOOLS.md` convention, or a
  first-class config surface. Do not rely on arbitrary filenames becoming
  startup-visible through `bootstrap-extra-files`.
- If critical startup rules must survive compaction, either keep them in the
  extracted `AGENTS.md` sections or extend the compaction safeguard to use an
  explicit critical-rule source rather than ad hoc section names.
