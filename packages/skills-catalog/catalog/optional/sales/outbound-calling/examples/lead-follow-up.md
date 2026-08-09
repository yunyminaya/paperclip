# Example: approved lead follow-up

## Input

The CEO assigns 120 consented webinar leads, a $75 ceiling, weekdays from 10:00–16:00 in each contact's timezone, and the goal of booking a product demo. A connected voice tool and approved caller identity are available.

## Application

The agent deduplicates and checks suppression state, estimates the cost, drafts a short script, and records a plan. It runs five canary calls, verifies disposition webhooks and cost, then processes batches of 25 while stopping on opt-out, budget, or provider-error thresholds.

## Output

The issue records 112 attempted, 41 connected, 13 qualified, 8 demos booked, 3 opt-outs, $48.20 spent, the approved script version, per-contact next actions, and a recommendation to reuse the inexpensive model lane for classification while reserving the capable lane for objections and commitments.
