---
name: cc-hooks-ts
description: This skill is the mandatory reference for all Claude Code hook creation. Use cc-hooks-ts for every hook. This skill should be used when the user asks to "create a hook", "add a hook", "write a hook", "implement a hook", "rewrite hooks in TypeScript", "use cc-hooks-ts", or needs to build any Claude Code hook — cc-hooks-ts is always required regardless of whether explicitly mentioned.
---

# Creating Claude Code Hooks with cc-hooks-ts

**cc-hooks-ts is mandatory for all hook development.** Never write raw hook scripts without it.

## Install

```bash
bun add cc-hooks-ts
```

## Basic Hook Structure

Every hook follows this pattern:

```typescript
#!/usr/bin/env bun
import { defineHook } from "cc-hooks-ts";

const hook = defineHook({
  trigger: {
    PostToolUse: {
      Write: true,
      Edit: true,
    },
  },
  // Optional: skip execution conditionally
  shouldRun: () => process.platform === "darwin",
  run: (context) => {
    // Hook logic here
    return context.success({
      messageForUser: "Hook executed successfully",
    });
  },
});

if (import.meta.main) {
  const { runHook } = await import("cc-hooks-ts");
  await runHook(hook);
}
```

Key elements:

- Shebang `#!/usr/bin/env bun` — hooks run as standalone executables
- `defineHook()` — provides full type inference for trigger, input, and response
- `runHook()` via dynamic import — handles stdin parsing, validation, context creation, and output formatting
- `if (import.meta.main)` guard — allows importing the hook definition in tests without side effects

## Supported Events

| Event                | Description               | Use Case                                       |
| -------------------- | ------------------------- | ---------------------------------------------- |
| `SessionStart`       | Session begins            | Environment checks, dependency install         |
| `SessionEnd`         | Session ends              | Cleanup, state persistence                     |
| `PreToolUse`         | Before tool execution     | Block operations, validate input, modify input |
| `PostToolUse`        | After tool execution      | Logging, inject additional context             |
| `PostToolUseFailure` | After tool failure        | Error handling, retry guidance                 |
| `UserPromptSubmit`   | User submits prompt       | Prompt augmentation, blocking                  |
| `Stop`               | Claude stops processing   | Cleanup, notifications                         |
| `SubagentStart`      | Subagent spawns           | Subagent initialization                        |
| `SubagentStop`       | Subagent stops            | Subagent result processing                     |
| `Notification`       | System notification       | Alert handling                                 |
| `PermissionRequest`  | Permission requested      | Auto-approve/deny rules                        |
| `PreCompact`         | Before context compaction | State preservation                             |
| `PostCompact`        | After context compaction  | Post-compaction processing                     |
| `Setup`              | Setup/maintenance trigger | One-time setup tasks                           |

## Tool-Specific Triggers

Filter hooks to specific tools by listing them in the trigger config:

```typescript
const hook = defineHook({
  trigger: {
    PreToolUse: {
      Read: true, // Only triggers for Read tool
      Bash: true, // and Bash tool
    },
  },
  run: (context) => {
    // context.input.tool_name is "Read" | "Bash"
    // context.input.tool_input is typed per tool
    return context.success({});
  },
});
```

## Context API

### Response Methods

| Method                               | Exit Code | Behavior                                                                                              |
| ------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------- |
| `context.success(payload?)`          | 0         | Continue normally. Optional `messageForUser` and `additionalClaudeContext`.                           |
| `context.blockingError(message)`     | 2         | Stop execution. Error message fed to Claude.                                                          |
| `context.nonBlockingError(message?)` | 1         | Show warning to user, continue execution.                                                             |
| `context.json(payload)`              | 0         | Full control over hook output — set `permissionDecision`, `additionalContext`, `suppressOutput`, etc. |
| `context.defer(handler, opts?)`      | 0         | Deferred async processing with optional `timeoutMs`.                                                  |

### context.input

Strongly typed based on trigger configuration:

```typescript
// Base fields (all events)
context.input.cwd; // Current working directory
context.input.session_id; // Session ID
context.input.transcript_path; // Transcript file path
context.input.hook_event_name; // Event name

// Tool events (PreToolUse/PostToolUse)
context.input.tool_name; // Tool name (typed to trigger config)
context.input.tool_input; // Tool input (typed per tool)
context.input.tool_response; // Tool output (PostToolUse only)
```

### shouldRun

Optional conditional execution — boolean or function (sync/async):

```typescript
shouldRun: () => process.env.HOOKS_ENABLED === "true";
shouldRun: false; // Disable hook entirely
```

If it returns `false`, the hook exits with code 0 (skipped silently).

## context.json() Response Structure

Use `context.json()` for advanced control. The structure varies by event — see `references/response-patterns.md` for full details.

**PreToolUse** — control permission and modify input:

```typescript
return context.json({
  event: "PreToolUse",
  output: {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow" | "ask" | "deny",
      permissionDecisionReason: "Auto-approved by policy",
      updatedInput: { file_path: "/corrected/path" },
      additionalContext: "Message for Claude",
    },
  },
});
```

**PostToolUse** — inject context after tool runs:

```typescript
return context.json({
  event: "PostToolUse",
  output: {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "Additional context for Claude",
    },
    suppressOutput: true,
  },
});
```

## plugin.json Configuration

Register hooks in `plugin.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "../../hooks/my-hook.ts"
          }
        ]
      }
    ]
  }
}
```

- Use `../..` for plugin-relative paths
- The `matcher` field filters at event dispatch level; the `trigger` config in `defineHook` filters at code level
- Hook files must have executable permission (`chmod +x`)

## Custom Tool Types

Extend type definitions for MCP or custom tools via declaration merging:

```typescript
declare module "cc-hooks-ts" {
  interface ToolSchema {
    my_custom_tool: {
      input: { query: string };
      response: { result: string };
    };
  }
}
```

Then `context.input.tool_input` is typed as `{ query: string }` when triggered for `my_custom_tool`.

## Stop Hook Recursion Guard (`stop_hook_active`)

When a Stop hook returns `additionalContext` or blocks the stop, Claude may continue processing and eventually stop again — triggering the same Stop hook recursively. To prevent this infinite loop, Claude Code sets `stop_hook_active: true` in the input on the second invocation.

**Always check this flag in Stop hooks:**

```typescript
const hook = defineHook({
  trigger: { Stop: true },
  run: (context) => {
    if (context.input.stop_hook_active) {
      return context.success({}); // Skip — already ran once this turn
    }

    // Your Stop hook logic here
    return context.success({
      additionalClaudeContext: "Remember to push before ending",
    });
  },
});
```

Without this guard, a Stop hook that injects context will cause Claude to resume, stop again, trigger the hook again, and loop indefinitely.

## Best Practices

1. **Use `console.error()` for user-visible output** — stdout is reserved for hook JSON responses
2. **Implement cooldown** for frequently triggered hooks to avoid performance impact
3. **Keep hooks lightweight** — hook execution blocks Claude's processing
4. **Design for idempotency** — same input should produce same result
5. **Wrap with try-catch** — unhandled errors cause hook failures
6. **Guard Stop hooks against recursion** — always check `stop_hook_active` (see above)

## References

- [cc-hooks-ts GitHub](https://github.com/sushichan044/cc-hooks-ts)
- [Claude Code Hooks docs](https://code.claude.com/docs/en/hooks)

## Bundled Resources

<!-- REFERENCES_START — AUTO-GENERATED by inject-references.ts — DO NOT EDIT MANUALLY -->

### References

- **`references/response-patterns.md`** — Complete context.json() response structures for all hook events — PreToolUse, PostToolUse, UserPromptSubmit, PermissionRequest, Stop, and more
<!-- REFERENCES_END -->
