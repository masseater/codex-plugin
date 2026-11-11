#!/usr/bin/env bun
/**
 * Scaffold a new skill directory with SKILL.md template and optional subdirectories.
 *
 * Usage: scaffold.ts --plugin-dir <dir> --skill-name <name> [--scripts] [--references]
 *
 * Creates:
 *   <plugin-dir>/skills/<skill-name>/SKILL.md
 *   <plugin-dir>/skills/<skill-name>/scripts/    (if --scripts)
 *   <plugin-dir>/skills/<skill-name>/references/  (if --references)
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { pathIn } from "../../../hooks/lib/path-in.js";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "plugin-dir": { type: "string" },
    "skill-name": { type: "string" },
    scripts: { type: "boolean", default: false },
    references: { type: "boolean", default: false },
  },
  strict: true,
});

const pluginDir = values["plugin-dir"];
const skillName = values["skill-name"];

if (!pluginDir || !skillName) {
  process.stderr.write(
    "Missing required option: --plugin-dir and --skill-name are required\n" +
      "Usage: scaffold.ts --plugin-dir <dir> --skill-name <name> [--scripts] [--references]\n",
  );
  process.exit(1);
}

const SKILL_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
if (!SKILL_NAME_RE.test(skillName)) {
  process.stderr.write(
    `Error: skill-name must be kebab-case (lowercase letters, digits, hyphens), got: ${skillName}\n`,
  );
  process.exit(1);
}

const skillDir = pathIn(pluginDir, "skills", skillName);

if (existsSync(skillDir)) {
  process.stderr.write(`Error: directory already exists: ${skillDir}\n`);
  process.exit(1);
}

mkdirSync(skillDir, { recursive: true });

if (values.scripts) {
  mkdirSync(pathIn(skillDir, "scripts"), { recursive: true });
}
if (values.references) {
  mkdirSync(pathIn(skillDir, "references"), { recursive: true });
}

const template = `---
name: ${skillName}
description: "TODO: What the skill does, then when to use it."
---

# ${skillName}

TODO: Describe the skill purpose.

## Workflow

TODO: Define the workflow steps.
`;

writeFileSync(pathIn(skillDir, "SKILL.md"), template);

process.stdout.write(
  JSON.stringify({
    created: skillDir,
    files: ["SKILL.md"],
    dirs: [...(values.scripts ? ["scripts/"] : []), ...(values.references ? ["references/"] : [])],
  }),
);
