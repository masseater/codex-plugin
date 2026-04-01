---
name: feedback
description: Send feedback about this plugin repository as a GitHub issue. Use when the user says "feedback", "send feedback", "report issue", "bug report", "feature request", "フィードバック", "バグ報告", "機能リクエスト", or wants to create an issue for the plugin repository.
---

# Send Feedback as GitHub Issue

Create a GitHub issue on the `masseater/codex-plugin` repository based on the current conversation context.

## Workflow

### Step 1: Analyze Conversation Context

Review the conversation history and identify what the user wants to report:

- **Bug**: Something that is broken or not working as expected
- **Feature Request**: A new feature or improvement suggestion
- **Question**: A question about usage or behavior
- **Other**: General feedback

### Step 2: Draft the Issue

Present the draft to the user before creating. The draft must include:

**Title**: A concise, descriptive title in English

**Labels**: Always include `claude` label (triggers Claude Code Action for automated implementation). Additionally choose:

- `bug` for bugs
- `enhancement` for feature requests
- `question` for questions

**Body** (Markdown, in English):

```markdown
## Context

[What the user was doing when the issue arose]

## Description

[Clear description of the issue or request]

## Steps to Reproduce (if bug)

1. [Step 1]
2. [Step 2]

## Expected Behavior (if bug)

[What should happen]

## Actual Behavior (if bug)

[What actually happens]

## Additional Context

- Plugin: [which plugin is affected]
- Relevant files: [file paths if applicable]
```

### Step 3: Confirm with User

Use `AskUserQuestion` to confirm:

- Show the drafted title and body
- Ask if they want to modify anything before creating

### Step 4: Create the Issue

Run:

```bash
gh issue create \
  --repo masseater/codex-plugin \
  --title "<title>" \
  --body "<body>" \
  --label "claude" --label "<additional-label>"
```

### Step 5: Report Result

Show the created issue URL to the user.

## Rules

- Always draft and confirm before creating — never create an issue without user approval
- Write issue title and body in English (repository language)
- Communicate with the user in Japanese (per AGENTS.md)
- Include relevant context from the conversation (plugin name, file paths, error messages)
- Do not include sensitive information (API keys, personal data, internal URLs)
- Strip conversation-specific details that are not relevant to the issue
