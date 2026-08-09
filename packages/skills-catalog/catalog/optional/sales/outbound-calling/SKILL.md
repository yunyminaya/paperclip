---
name: outbound-calling
description: >
  Runs governed outbound call campaigns from an approved contact list through a connected voice tool. Use for sales or follow-up, not unapproved or unlawful outreach.
key: paperclipai/optional/sales/outbound-calling
recommendedForRoles:
  - cmo
  - sales
tags:
  - calling
  - sales
  - telephony
---

# Outbound calling

Turn a CEO-approved calling objective and contact list into a measured campaign. This skill is provider-agnostic: use a voice or telephony tool already connected to the company rather than assuming a specific vendor.

## When to use

- Sales qualification, customer follow-up, appointment reminders, or research calls.
- The source issue identifies the list, purpose, caller identity, allowed regions and hours, success criteria, and budget.

## When not to use

- Emergency services, impersonation, harassment, or calls without a valid legal and company-policy basis.
- When no approved voice tool is connected. Report the missing capability and create a setup task; never fabricate a completed call.
- For contacts on suppression or do-not-contact lists.

## Procedure

1. Inspect the issue, contact-list artifact, company policy, effective tool profile, available secrets, and remaining budget. Never place credentials or unnecessary personal data in prompts or comments.
2. Validate that the list has a recorded source, permitted purpose, region, time window, and suppression status. If eligibility is uncertain, request review instead of guessing.
3. Write a short plan before parallel work: objective, script, batches, cost ceiling, stop conditions, result schema, and approval gates. Deduplicate contacts and estimate total tool and model cost.
4. Discover an allowed telephony action. If it is unavailable, research the required connector or create a reusable company skill when authorized, then leave the campaign blocked until the connection and credentials are approved.
5. Run a small canary batch. Confirm caller identity, audio quality, script behavior, consent handling, webhook/result delivery, and real cost before scaling.
6. Execute only inside approved hours and rate limits. Honor opt-outs immediately. Do not repeatedly retry unanswered contacts beyond company policy.
7. Record a structured result per contact: contact reference, timestamp, disposition, next action, tool request reference, cost, and opt-out state. Store transcripts only when policy and consent allow it.
8. Stop on budget, policy, approval, provider, or abnormal rejection thresholds. Escalate payments, binding commitments, regulated claims, or other governed actions.
9. Publish an aggregate outcome: attempted, connected, qualified, converted, opted out, failed, total cost, cost per useful outcome, script/version, provider, agent, model lane, and lessons.
10. Reuse the same task session and approved context for follow-up batches. Recommend the best-performing script, time window, agent, skill, tool, and model lane only after enough comparable outcomes exist.

## Completion criteria

- Every attempted call has an auditable tool request and structured disposition.
- Opt-outs and suppression updates are persisted.
- Spend stays within the issue and company budget.
- The issue contains a concise result and next-action list, including any blocked contacts or approvals.
