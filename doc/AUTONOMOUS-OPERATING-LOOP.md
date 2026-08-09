# Autonomous Operating Loop (first vertical)

Paperclip can represent active goals as measurable operating objectives with a KPI key, numeric target, comparison direction, start date, and due date. Metric observations are append-only, company-scoped, attributed to the reporting agent when applicable, and recorded in the activity log.

`GET /api/companies/:companyId/operating-loop/scorecard` evaluates active measurable goals as `achieved`, `on_track`, `off_track`, or `missing_data`. For `at_least` targets with a due date, the first version compares progress from a zero baseline with elapsed time. This is deliberately conservative and should later support explicit baselines and metric-specific forecasting.

`POST /api/companies/:companyId/operating-loop/run` creates one idempotent daily operating-review issue for the enabled CEO agent. The issue asks the CEO to identify the highest-return action, choose continue/change/stop, delegate governed child work, require independent verification, and report expected return and cost. Existing approval, budget, tool-access, and audit controls still apply.

The dashboard exposes the current scorecard. Goal creation supports the KPI key, target, and target date. Observations can be submitted through `POST /api/goals/:id/observations` by an authorized board or same-company agent.

## Known limits

- The daily run endpoint is ready for a routine or external scheduler, but this slice does not silently activate automation for existing companies.
- Revenue, cash, margin, conversion, and churn become scorecard metrics when connectors or agents submit observations; banking, CRM, accounting, telephony, and tax filing still require real provider integrations and credentials.
- Automatic strategy/model/skill changes remain governed recommendations until evaluation evidence and rollback policies are implemented.
