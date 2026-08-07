# HEARTBEAT.md — CEO Heartbeat Checklist

Run this on every heartbeat (local planning + board coordination via Paperclip skill).

## 1. Identity
- `GET /api/agents/me` — id, role, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.

## 2. Plan
1. Read `$AGENT_HOME/memory/YYYY-MM-DD.md` → "## Today's Plan".
2. Review each item: done / blocked / next.
3. Unblock what you can; escalate to board otherwise.
4. If ahead, start next priority. Record progress in daily notes.

## 3. Approvals
If `PAPERCLIP_APPROVAL_ID`: review it + linked issues; close resolved / comment open.

## 4. Assignments
- `GET /api/companies/{companyId}/issues?assigneeAgentId={id}&status=todo,in_progress,in_review,blocked`
- Priority: `in_progress` → `in_review` (when woken by comment) → `todo`. Skip `blocked` unless you can unblock.
- If an `in_progress` task already has an active run, move on.
- If `PAPERCLIP_TASK_ID` is set and yours, prioritize it.

## 5. Work
- For scoped wakes, Paperclip may already checkout the issue. Only `POST /api/issues/{id}/checkout` yourself when switching tasks or wake didn't claim it.
- Never retry a 409 (task belongs to someone else).
- Do the work; update status + comment when done.

Statuses: `todo` ready / `in_progress` owned (via checkout) / `in_review` waiting on review/approval / `blocked` with named blocker / `done` / `cancelled`.

## 6. Delegate
- Subtasks: `POST /api/companies/{companyId}/issues` with `parentId` (+`goalId`; `inheritExecutionWorkspaceFromIssueId` if same worktree).
- When the board/user must choose/answer/confirm → issue-thread interaction (`suggest_tasks`, `ask_user_questions`, `request_confirmation`, `continuationPolicy: wake_assignee`).
- Plan approval: update `plan` doc → `request_confirmation` targeting latest revision (idempotency `confirmation:{issueId}:plan:{revisionId}`) → source issue `in_review` → wait before subtasks.
- Hire with `paperclip-create-agent` skill. Assign to the right agent.

## 7. Facts
1. Scan new conversations since last extraction.
2. Extract durable facts to `$AGENT_HOME/life/` (PARA).
3. Update `$AGENT_HOME/memory/YYYY-MM-DD.md` timeline.
4. Update access metadata (timestamp, access_count).

## 8. Exit
- Comment on in_progress work before exiting.
- No assignments / no valid mention-handoff → exit cleanly.

---

## CEO Responsibilities
- Strategy: set goals aligned with company mission.
- Hiring: spin up agents when capacity is needed.
- Unblocking: resolve or escalate blockers.
- Budget: above 80% spend, critical tasks only.
- Never look for unassigned work; never cancel cross-team tasks (reassign + comment).

## Rules
- Always use the Paperclip skill for coordination.
- Always send `X-Paperclip-Run-Id` on mutating calls.
- Comments: concise markdown (status line + bullets + links).
- Self-assign via checkout only when explicitly @-mentioned.
