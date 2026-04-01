---
name: dev-command
description: 'This skill should be used when the user asks to "generate design feedback", "create QA checklist", "scaffold screen map", "update screen map", "run ui-dev check", or needs manual utility commands for UI implementation workflows.'
argument-hint: "[subcommand]"
---

# UI Dev Utility Commands

A collection of utility commands for manual human execution.

## Subcommand List

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `design-feedback`   | Generate feedback for designers               |
| `qa-checklist`      | Generate manual QA checklist                  |
| `update-screen-map` | Update the screen map                         |
| `update-context`    | Update config.json reviewPrompts              |
| `check`             | lint + format check                           |
| `typecheck`         | Type check                                    |
| `scaffold`          | Generate screen map skeleton from a Figma URL |
| `install`           | Install dependencies                          |

## design-feedback

Generate feedback to communicate design issues discovered during implementation to designers.

Guide: @./design-feedback-guide.md

## qa-checklist

Generate a QA checklist for manual human verification based on the screen map.

Guide: @./qa-checklist-guide.md

## update-screen-map

Update a specific section of the screen map. Reflects spec gaps or changes discovered during implementation.
Always add an entry to the "Change Log" section when updating.

## update-context

Update `reviewPrompts` or `contextFiles` in config.json.
Use when review criteria become clearer through implementation.

## scaffold

Auto-generate a screen map skeleton from a Figma URL.

```bash
../../scripts/figma-scaffold.ts \
  --url "https://figma.com/design/ABC123/MyApp" \
  --page "Registration" \
  --output .agents/ui-dev/registration/screen-map.md
```

## check / typecheck / install

```bash
cd plugins/ui-dev
bun run check        # lint + format
bun run typecheck    # type check
bun install          # install dependencies
```
