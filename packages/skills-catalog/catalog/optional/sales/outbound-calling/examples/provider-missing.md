# Example: voice provider missing

## Input

The CEO asks an agent to call a list, but the agent's effective tools contain no telephony or voice action.

## Application

The agent validates the business objective and list but does not claim to have called anyone. It researches compatible tool connections, creates a setup task describing the required provider, secret references, caller identity, estimated cost, policy review, and smoke test, then marks the campaign blocked on that dependency.

## Output

The CEO receives a concise blocker report and an approval-ready setup task. Once a provider is connected, the agent resumes the original issue using the saved plan and context instead of restarting the conversation.
