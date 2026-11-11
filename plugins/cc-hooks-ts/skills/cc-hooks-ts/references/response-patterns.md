---
description: Complete context.json() response structures for all hook events — PreToolUse, PostToolUse, UserPromptSubmit, PermissionRequest, Stop, and more
---

# Response Patterns Reference

Complete reference for `context.json()` response structures by event type.

## Common Output Fields

All events share these optional fields:

- `continue` — `boolean`
  - Default: `true`
  - Description: Whether to continue processing
- `stopReason` — `string`
  - Default: —
  - Description: Reason for stopping (shown to user, not Claude)
- `suppressOutput` — `boolean`
  - Default: `false`
  - Description: Hide stdout from user
- `systemMessage` — `string`
  - Default: —
  - Description: Warning message displayed to user

## PreToolUse

Control tool execution before it runs.

```typescript
return context.json({
  event: "PreToolUse",
  output: {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow" | "ask" | "deny",
      permissionDecisionReason: "Reason shown to user",
      updatedInput: {
        /* modified tool input */
      },
      additionalContext: "Context added for Claude",
    },
  },
});
```

- `permissionDecision` — `"allow"` = auto-approve, `"ask"` = prompt user, `"deny"` = block
- `permissionDecisionReason` — Shown to user (not fed to Claude when `"allow"`)
- `updatedInput` — Replace tool input before execution
- `additionalContext` — Extra context injected into Claude's conversation

## PostToolUse

React to tool output after execution.

```typescript
return context.json({
  event: "PostToolUse",
  output: {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "Analysis of tool output for Claude",
      updatedMCPToolOutput: {
        /* replace MCP tool output */
      },
    },
    suppressOutput: true,
  },
});
```

- `additionalContext` — Message injected into Claude's context
- `updatedMCPToolOutput` — Replace MCP tool response content
- `suppressOutput` — Hide original tool output from user

## PostToolUseFailure

Handle tool execution failures.

```typescript
return context.json({
  event: "PostToolUseFailure",
  output: {
    hookSpecificOutput: {
      hookEventName: "PostToolUseFailure",
      additionalContext: "Guidance for Claude on how to recover",
    },
  },
});
```

## UserPromptSubmit

Intercept or augment user prompts.

```typescript
return context.json({
  event: "UserPromptSubmit",
  output: {
    decision: "approve" | "block",
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "Extra context for this prompt",
    },
  },
});
```

- `decision` — `"block"` prevents the prompt from being processed
- `additionalContext` — Added to context if not blocked

## PermissionRequest

Programmatically approve or deny permission requests.

```typescript
// Auto-approve
return context.json({
  event: "PermissionRequest",
  output: {
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: {
        behavior: "allow",
        updatedInput: {
          /* optional input modifications */
        },
        updatedPermissions: [
          {
            type: "addRules",
            behavior: "allow",
            destination: "projectSettings",
            rules: [{ toolName: "Bash", ruleContent: "npm test" }],
          },
        ],
      },
    },
  },
});

// Deny
return context.json({
  event: "PermissionRequest",
  output: {
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: {
        behavior: "deny",
        interrupt: true,
        message: "This operation is not allowed",
      },
    },
  },
});
```

## Stop / SubagentStop

Control whether Claude stops processing.

```typescript
return context.json({
  event: "Stop",
  output: {
    decision: "block", // Prevent Claude from stopping
    hookSpecificOutput: {
      hookEventName: "Stop",
      additionalContext: "Continue with remaining tasks",
    },
  },
});
```

## SessionStart / Notification / PreCompact

Add context at session lifecycle events.

```typescript
return context.json({
  event: "SessionStart",
  output: {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: "Environment info or session-level instructions",
    },
  },
});
```

## Exit Codes Summary

- 0 — Success
  - Method: `context.success()`, `context.json()`, `context.defer()`
- 1 — Non-blocking error (warn and continue)
  - Method: `context.nonBlockingError()`
- 2 — Blocking error (stop execution)
  - Method: `context.blockingError()`
