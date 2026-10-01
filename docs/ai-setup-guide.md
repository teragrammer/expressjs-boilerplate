### Windows

- Install WSL or Docker provided

```
$ wsl --install
```

### Cursor (optional)

- [Cursor](https://cursor.com)

### OpenCode Setup (Preferred)

- [Open Code Docs](https://opencode.ai/v2/docs)

- Installation

```
$ curl -fsSL https://opencode.ai/v2/install | bash
```

- Staring using OpenCode

```
$ cd <project>
$ opencode
```

- Commands

```
# open pallets or command list
# CTRL + p
```

- Starting

```
# generates AGENTS.md in repo root (for initial setup)
$ /init
```

### Claude Code Setup

- [Claude Code Docs](https://code.claude.com/docs/en/overview)

- macOS, Linux, WSL

```
$ curl -fsSL https://claude.ai/install.sh | bash
```

- Start using Claude code

```
$ cd <project>
$ claude
```

### What is Skills

[Skills Docs](https://opencode.ai/v2/docs/skills)

**What makes Skills different?**

- **Persistence:** Prompts are temporary and ad-hoc; Skills are reusable, saved workflows that stay in your environment.
- **Smart Loading (Context Efficiency):** Prompts bloat your context window because they are always active. Skills use
  progressive disclosure—the agent only loads them when specifically needed.
- **Automatic Discovery:** You have to manually remember and paste prompts. Agents automatically detect your intent and
  invoke the right Skill.
- **Standardization:** Skills act as shared team runbooks (embedded right in your repo) to ensure consistent code
  standards, rather than scattered copy-paste notes.

**File & Directory Structure**

```
.opencode/skills/my-skill-name/   (or .claude/skills/my-skill-name/)
├── SKILL.md                      # Required: Frontmatter + core steps
└── references/                   # Optional: Deep-dive files loaded on-demand
    └── guidelines.md
```

**OpenCode (Preferred Format)**
OpenCode requires lowercase alphanumeric naming separated by hyphens (matching the directory name) and specific YAML
frontmatter.

```
---
name: git-release
description: Create consistent releases and changelogs. Use when preparing a tagged repository release.
license: MIT
metadata:
  audience: maintainers
---

## What I do
- Draft release notes from merged pull requests.
- Propose a semantic version bump.

## When to use me
Use this skill whenever the user asks to push a release, bump versions, or draft a changelog.
```

**Claude Code Format**

```
---
name: review-pull-request
description: Review a pull request for security issues, style violations, and missing tests.
disable-model-invocation: false
allowed-tools: ["bash", "grep"]
---

# Pull Request Review Guide

## Instructions
1. Check git diff for uncommitted changes or active branch status.
2. Scan code changes against security best practices.
3. Verify that new unit tests accompany bug fixes or features.
```

### What is Custom Commands

[Commands](https://opencode.ai/v2/docs/commands)

In OpenCode, custom commands let you create quick shortcuts (like /review) to run predefined prompts.

- How to make: Add a Markdown file in .opencode/commands/ (e.g., review.md).
- Format: Use YAML frontmatter for the description, then write your prompt body.
- Pro Features: Use $ARGUMENTS to accept user input, !cmd to inject live shell output, and @file to include specific
  files.

**Methods**

You can define custom commands either as Markdown files (recommended) or inside your JSON configuration file.

**Method 1: Markdown Files (Recommended)**

Create a .md file inside your project's command directory (.opencode/commands/) or globally (~
/.config/opencode/commands/). The filename dictates the command name.

```
---
description: Review code for bugs and missing tests
agent: general
---
Review $ARGUMENTS for potential bugs, edge cases, and missing unit tests. Report critical issues first.
```

- How to run it in the TUI: Type /review src/auth.ts.
- \$ARGUMENTS automatically captures whatever text you type after the command. You can also use positional arguments
  like \$1, \$2, etc.

**Method 2: JSON Configuration (opencode.jsonc)**

Alternatively, you can define them directly inside your configuration file using a command or commands block:

```
{
  "commands": {
    "test": {
      "description": "Run the full test suite with coverage",
      "template": "Run the test suite, analyze any failures, and suggest fixes."
    }
  }
}
```

**Advanced Features in OpenCode Commands**

- **Shell Injection (!):** You can inject live terminal command outputs directly into your prompt template by wrapping a
  shell command in backticks with an exclamation point:

```
---
description: Analyze recent changes
---
Here is the recent git diff:
!` git diff`

Review these changes for style issues.
```

- **File References (@):** You can pin file contents straight into the prompt template by referencing them with an @
  symbol (e.g., @README.md).

### Resources

- [AGENTS.md: A simple, open format for guiding coding agents](https://agents.md)