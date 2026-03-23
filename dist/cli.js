#!/usr/bin/env node

// src/cli.ts
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// src/services/jsonc.ts
function stripJsoncComments(content) {
  let result = "";
  let i = 0;
  let inString = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];
    if (!inSingleLineComment && !inMultiLineComment) {
      if (char === '"') {
        let backslashCount = 0;
        let j = i - 1;
        while (j >= 0 && content[j] === "\\") {
          backslashCount++;
          j--;
        }
        if (backslashCount % 2 === 0) {
          inString = !inString;
        }
        result += char;
        i++;
        continue;
      }
    }
    if (inString) {
      result += char;
      i++;
      continue;
    }
    if (!inSingleLineComment && !inMultiLineComment) {
      if (char === "/" && nextChar === "/") {
        inSingleLineComment = true;
        i += 2;
        continue;
      }
      if (char === "/" && nextChar === "*") {
        inMultiLineComment = true;
        i += 2;
        continue;
      }
    }
    if (inSingleLineComment) {
      if (char === `
`) {
        inSingleLineComment = false;
        result += char;
      }
      i++;
      continue;
    }
    if (inMultiLineComment) {
      if (char === "*" && nextChar === "/") {
        inMultiLineComment = false;
        i += 2;
        continue;
      }
      if (char === `
`) {
        result += char;
      }
      i++;
      continue;
    }
    result += char;
    i++;
  }
  return result.replace(/,\s*([}\]])/g, "$1");
}

// src/cli.ts
var OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode");
var OPENCODE_COMMAND_DIR = join(OPENCODE_CONFIG_DIR, "command");
var PLUGIN_NAME = "opencode-memos@latest";
var MEMOS_INIT_COMMAND = `---
description: Initialize mem-os with comprehensive codebase knowledge
---

# Initializing mem-os

You are initializing persistent memory for this codebase using mem-os. This builds context that will make you significantly more effective across all future sessions.

## Understanding Context

You are a **stateful** coding agent. Users expect to work with you over extended periods. Your memory is how you get better over time and maintain continuity.

## What to Remember

### 1. Procedures (Rules & Workflows)
Explicit rules that should always be followed:
- "Never commit directly to main - always use feature branches"
- "Always run lint before tests"
- "Use conventional commits format"

### 2. Preferences (Style & Conventions)
Project and user coding style:
- "Prefer functional components over class components"
- "Use early returns instead of nested conditionals"
- "Always add JSDoc to exported functions"

### 3. Architecture & Context
How the codebase works and why:
- "Auth system was refactored in v2.0 - old patterns deprecated"
- "The monorepo used to have 3 modules before consolidation"
- "This pagination bug was fixed before - similar to PR #234"

## Memory Scopes

**Project-scoped** (\`scope: "project"\`):
- Build/test/lint commands
- Architecture and key directories
- Team conventions specific to this codebase
- Technology stack and framework choices
- Known issues and their solutions

**User-scoped** (\`scope: "user"\`):
- Personal coding preferences across all projects
- Communication style preferences
- General workflow habits

## Research Approach

This is a **deep research** initialization. Take your time and be thorough (~50+ tool calls). The goal is to genuinely understand the project, not just collect surface-level facts.

**What to uncover:**
- Tech stack and dependencies (explicit and implicit)
- Project structure and architecture
- Build/test/deploy commands and workflows
- Contributors & team dynamics (who works on what?)
- Commit conventions and branching strategy
- Code evolution (major refactors, architecture changes)
- Pain points (areas with lots of bug fixes)
- Implicit conventions not documented anywhere

## Research Techniques

### File-based
- README.md, CONTRIBUTING.md, AGENTS.md, CLAUDE.md
- Package manifests (package.json, Cargo.toml, pyproject.toml, go.mod)
- Config files (.eslintrc, tsconfig.json, .prettierrc)
- CI/CD configs (.github/workflows/)

### Git-based
- \`git log --oneline -20\` - Recent history
- \`git branch -a\` - Branching strategy
- \`git log --format="%s" -50\` - Commit conventions
- \`git shortlog -sn --all | head -10\` - Main contributors

### Explore Agent
Fire parallel explore queries for broad understanding:
\`\`\`
Task(explore, "What is the tech stack and key dependencies?")
Task(explore, "What is the project structure? Key directories?")
Task(explore, "How do you build, test, and run this project?")
Task(explore, "What are the main architectural patterns?")
Task(explore, "What conventions or patterns are used?")
\`\`\`

## How to Do Thorough Research

**Don't just collect data - analyze and cross-reference.**

Bad (shallow):
- Run commands, copy output
- List facts without understanding

Good (thorough):
- Cross-reference findings (if inconsistent, dig deeper)
- Resolve ambiguities (don't leave questions unanswered)
- Read actual file content, not just names
- Look for patterns (what do commits tell you about workflow?)
- Think like a new team member - what would you want to know?

## Saving Memories

Use the \`mem-os\` tool for each distinct insight:

\`\`\`
mem-os(mode: "add", content: "...", scope: "project")
\`\`\`

**Scopes:**
- \`project\` - Project-specific knowledge (default)
- \`user\` - User preferences across projects

**Guidelines:**
- Save each distinct insight as a separate memory
- Be concise but include enough context to be useful
- Include the "why" not just the "what" when relevant
- Update memories incrementally as you research (don't wait until the end)

**Good memories:**
- "Uses Bun runtime and package manager. Commands: bun install, bun run dev, bun test"
- "API routes in src/routes/, handlers in src/handlers/. Hono framework."
- "Auth uses Redis sessions, not JWT. Implementation in src/lib/auth.ts"
- "Never use \`any\` type - strict TypeScript. Use \`unknown\` and narrow."
- "Database migrations must be backward compatible - we do rolling deploys"

## Upfront Questions

Before diving in, ask:
1. "Any specific rules I should always follow?"
2. "Preferences for how I communicate? (terse/detailed)"

## Reflection Phase

Before finishing, reflect:
1. **Completeness**: Did you cover commands, architecture, conventions, gotchas?
2. **Quality**: Are memories concise and searchable?
3. **Scope**: Did you correctly separate project vs user knowledge?

Then ask: "I've initialized memory with X insights. Want me to continue refining, or is this good?"

## Your Task

1. Ask upfront questions (research depth, rules, preferences)
2. Check existing memories: \`mem-os(mode: "list", scope: "project")\`
3. Research based on chosen depth
4. Save memories incrementally as you discover insights
5. Reflect and verify completeness
6. Summarize what was learned and ask if user wants refinement
`;
var MEMOS_HELP_COMMAND = `---
description: Get help with mem-os memory plugin
---

# mem-os Help

mem-os provides persistent memory for OpenCode agents.

## Commands

- \`/mem-os-init\` - Initialize memory for a codebase (explores and memorizes project)
- \`/mem-os-help\` - Show this help message

## Tool Usage

The \`mem-os\` tool is available to the agent:

| Mode     | Args                          | Description       |
| -------- | ----------------------------- | ----------------- |
| \`add\`     | \`content\`, \`scope?\`           | Store memory      |
| \`search\`  | \`query\`, \`scope?\`             | Search memories   |
| \`list\`    | \`scope?\`, \`limit?\`             | List memories     |
| \`delete\`  | \`memory_id\`, \`scope?\`         | Delete memory     |

**Scopes:**
- \`project\` - Project-specific knowledge (default)
- \`user\` - User preferences across projects

## Examples

Add a memory:
\`\`\`
mem-os(mode: "add", content: "Uses Bun runtime. Commands: bun install, bun run dev", scope: "project")
\`\`\`

Search memories:
\`\`\`
mem-os(mode: "search", query: "build commands", scope: "project")
\`\`\`

List project memories:
\`\`\`
mem-os(mode: "list", scope: "project", limit: 10)
\`\`\`

## Configuration

Set your Memos API key via environment variable:

\`\`\`bash
export MEMOS_API_KEY="your-api-key"
\`\`\`

Get your API key from your Memos instance settings.
`;
function findOpencodeConfig() {
  const candidates = [
    join(OPENCODE_CONFIG_DIR, "opencode.jsonc"),
    join(OPENCODE_CONFIG_DIR, "opencode.json")
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}
function addPluginToConfig(configPath) {
  try {
    const content = readFileSync(configPath, "utf-8");
    if (content.includes("opencode-memos")) {
      console.log("✓ Plugin already registered in config");
      return true;
    }
    const jsonContent = stripJsoncComments(content);
    let config;
    try {
      config = JSON.parse(jsonContent);
    } catch {
      console.error("✗ Failed to parse config file");
      return false;
    }
    const plugins = config.plugin || [];
    plugins.push(PLUGIN_NAME);
    config.plugin = plugins;
    if (configPath.endsWith(".jsonc")) {
      if (content.includes('"plugin"')) {
        const newContent = content.replace(/("plugin"\s*:\s*\[)([^\]]*?)(\])/, (_match, start, middle, end) => {
          const trimmed = middle.trim();
          if (trimmed === "") {
            return `${start}
    "${PLUGIN_NAME}"
  ${end}`;
          }
          return `${start}${middle.trimEnd()},
    "${PLUGIN_NAME}"
  ${end}`;
        });
        writeFileSync(configPath, newContent);
      } else {
        const newContent = content.replace(/^(\s*\{)/, `$1
  "plugin": ["${PLUGIN_NAME}"],`);
        writeFileSync(configPath, newContent);
      }
    } else {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
    console.log(`✓ Added plugin to ${configPath}`);
    return true;
  } catch (err) {
    console.error("✗ Failed to update config:", err);
    return false;
  }
}
function createNewConfig() {
  const configPath = join(OPENCODE_CONFIG_DIR, "opencode.jsonc");
  mkdirSync(OPENCODE_CONFIG_DIR, { recursive: true });
  const config = `{
  "plugin": ["${PLUGIN_NAME}"]
}
`;
  writeFileSync(configPath, config);
  console.log(`✓ Created ${configPath}`);
  return true;
}
function createCommands() {
  mkdirSync(OPENCODE_COMMAND_DIR, { recursive: true });
  const initPath = join(OPENCODE_COMMAND_DIR, "mem-os-init.md");
  writeFileSync(initPath, MEMOS_INIT_COMMAND);
  console.log(`✓ Created /mem-os-init command`);
  const helpPath = join(OPENCODE_COMMAND_DIR, "mem-os-help.md");
  writeFileSync(helpPath, MEMOS_HELP_COMMAND);
  console.log(`✓ Created /mem-os-help command`);
  return true;
}
async function install() {
  console.log(`
\uD83E\uDDE0 mem-os installer
`);
  console.log("Step 1: Register plugin in OpenCode config");
  const configPath = findOpencodeConfig();
  if (configPath) {
    addPluginToConfig(configPath);
  } else {
    createNewConfig();
  }
  console.log(`
Step 2: Create /mem-os-init and /mem-os-help commands`);
  createCommands();
  console.log(`
` + "─".repeat(50));
  console.log(`
✓ Setup complete! Restart OpenCode to activate.
`);
  console.log("Next steps:");
  console.log("1. Set your Memos API key:");
  console.log('   export MEMOS_API_KEY="your-api-key"');
  console.log(`
2. Get your API key from your Memos instance settings.`);
  console.log(`
3. Run /mem-os-init to initialize memory for your codebase.
`);
  return 0;
}
function logout() {
  console.log("mem-os does not store credentials.");
  console.log("To disconnect, simply unset the MEMOS_API_KEY environment variable.");
  console.log(`You can also remove the plugin from ~/.config/opencode/opencode.jsonc.
`);
  return 0;
}
function printHelp() {
  console.log(`
opencode-memos - Persistent memory for OpenCode agents using Memos

Commands:
  install    Install and configure the plugin
  logout     Show instructions for disconnecting

Examples:
  bunx opencode-memos@latest install
  bunx opencode-memos@latest logout
`);
}
var args = process.argv.slice(2);
if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
  printHelp();
  process.exit(0);
}
if (args[0] === "install") {
  install().then((code) => process.exit(code));
} else if (args[0] === "logout") {
  process.exit(logout());
} else {
  console.error(`Unknown command: ${args[0]}`);
  printHelp();
  process.exit(1);
}
