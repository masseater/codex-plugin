---
name: ops-harbor:use-ops-harbor
description: Use Ops Harbor's read-only MCP tools to inspect cached work items, alerts, and activity before taking action.
---

# Use Ops Harbor

Ops Harbor is a local dashboard and MCP bridge for operational work items.

## When to use

- The user asks about current CI failures, review events, merge conflicts, or base drift.
- The user wants a quick summary of active work items without re-querying GitHub manually.
- The user wants the AI to inspect `ops_harbor_*` MCP tools before deciding what to do next.

## Workflow

1. Prefer `ops_harbor_list_alerts` for urgent blockers.
2. Use `ops_harbor_list_work_items` to narrow down the relevant work item.
3. Use `ops_harbor_get_work_item` for the detailed checks/reviews/merge state.
4. Use `ops_harbor_list_activity` for recent context before recommending follow-up actions.

## Notes

- Ops Harbor MCP is intentionally read-only in v1.
- Dashboard launch is outside the plugin scope; the user is expected to run the local app ahead of time.
