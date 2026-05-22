---
name: ai-config
description: "Manage AI assistant config files across tools. USE FOR: initializing AI configs for a new repo (AGENTS.md, CLAUDE.md, copilot-instructions.md, .cursorrules, GEMINI.md, etc.); adding a config for a newly adopted AI tool; detecting drift between multiple co-existing AI config files; updating preferences across all active configs; detecting when tooling changes (linter, framework, test runner) are not yet reflected in AI configs. Triggers on: 'set up AI configs', 'add Cursor config', 'my copilot instructions are out of date', 'sync my AI configs', 'check if my AI configs match the stack', 'onboard Claude Code'."
argument-hint: "Optional: pass a mode to skip detection — init | add <tool> | check | edit | drift"
---

# AI Config Skill

## Purpose

Detect, create, sync, and drift-check AI assistant configuration files in a repo. Works with whatever the user already has. Never introduces a skill-owned state file.

## Platform Adaptation

Before starting, load the reference file for the current agent environment and follow its tool guidance:

- [Copilot tool mapping](../repo-init/references/copilot-tools.md)
- [Codex tool mapping](../repo-init/references/codex-tools.md)
- [Gemini CLI tool mapping](../repo-init/references/gemini-tools.md)

---

## Supported Config Files

Load the full adapter details (file names, locations, format rules, sentinel syntax) from:

- [Adapter reference](./references/adapters.md)

Quick reference:

| Tool | File(s) | Location |
|------|---------|----------|
| Shared / generic | `AGENTS.md` | repo root |
| Claude Code | `CLAUDE.md` | repo root (+ sub-dirs) |
| GitHub Copilot | `copilot-instructions.md` | `.github/` |
| Copilot file-scoped | `*.instructions.md` | `.github/instructions/` |
| Cursor | `*.mdc` rules | `.cursor/rules/` |
| Gemini CLI | `GEMINI.md` | repo root |
| Cline | `.clinerules` | repo root |
| Windsurf | `.windsurfrules` | repo root |
| Cursor legacy | `.cursorrules` | repo root |

---

## Startup — Detect Mode

Unless a mode was passed as an argument, always run detection first.

### Step 1 — Scan for existing configs

Scan the repo for all known config files (see table above). Collect every file found.

### Step 2 — Determine mode

| Situation | Mode |
|-----------|------|
| No configs found | `init` |
| Configs found + argument says `add <tool>` | `add` |
| Configs found + argument says `check` or `drift` | `check` or `drift` |
| Configs found + argument says `edit` | `edit` |
| Multiple configs found, no argument | surface sync check first, then ask what user wants to do |
| One config found, no argument | ask: update, add a tool, or check drift? |

### Step 3 — Multi-config sync prompt

When **two or more** config files are found, before doing anything else:

> "I found configs for [list tools]. Let me quickly check if they agree on the key things."

Run a lightweight cross-config comparison (see `check` mode below). Report any divergences immediately. Ask if the user wants to fix them before continuing to their original request.

---

## Modes

### `init` — No configs exist

1. Explain briefly: *"You have no AI assistant config files yet. The most portable starting point is `AGENTS.md` — it's read by Claude Code, GitHub Copilot, Windsurf, and others without any tool-specific setup."*

2. Ask: which AI tools does the team use? (multi-select)
   - `GitHub Copilot` *(default)*
   - `Claude Code`
   - `Cursor`
   - `Gemini CLI`
   - `Cline`
   - `Windsurf`
   - `Other` (free text)

   **If called from `repo-init`** with pre-filled context: skip this question and use the passed tool list.

3. Ask the preference questions (skip any already provided by `repo-init`):
   - **Shell preference** *(default: no preference)*: `bash`, `zsh`, `fish`, `PowerShell`, `No preference`
   - **Commit style** *(default: no preference)*: `Conventional Commits`, `Gitmoji`, `No preference`, `Other`
   - **Confirmation behavior** *(default: ask before destructive actions)*: `Ask before destructive`, `Auto-approve safe / ask for destructive`, `Minimal confirmations`
   - **Extra conventions** (free text, optional): e.g. "never modify test files without asking", "always use named exports"

4. Decide which files to create:
   - Always create `AGENTS.md` as the shared base.
   - For each tool beyond the shared base, create the tool-specific file (see adapter reference for format).
   - Show the file list and confirm before writing anything.

5. Write files. Use sentinel comments to wrap generated sections (see [Adapter reference → Sentinel Format](./references/adapters.md)).

6. Confirm what was created and suggest next steps: add more tools (`add`), or run `check` after future tooling changes.

---

### `add` — Onboard a new tool

1. Ask which tool to add (if not passed as argument). Show only tools that don't already have a config file.

2. Read all existing config files to extract current preferences (tools, conventions, methodology, shell).

3. Generate the new tool's config file using the extracted preferences + the adapter format. Wrap generated sections in sentinels.

4. Show a diff preview and confirm before writing.

---

### `check` — Cross-config sync check

Goal: surface *meaningful* divergences between config files, not formatting noise.

1. For each config file, extract the following dimensions using the [Adapter reference](./references/adapters.md) extraction hints:
   - Named tools / frameworks (linter, test runner, formatter, runtime, package manager)
   - Shell preference
   - Commit style
   - Any explicit methodology (e.g. TDD, SDD, spec-driven)
   - Restricted or disallowed actions

2. Cross-compare all files on each dimension. Flag only where two files **explicitly disagree** (one says X, another says Y). Omissions are not flags — a file that doesn't mention the linter is not wrong.

3. For each divergence, show:
   ```
   Divergence: linter
     CLAUDE.md        → Ruff
     copilot-instructions.md → Flake8
   → Which is current? [Ruff / Flake8 / Both intentional (suppress)]
   ```

4. For each resolved divergence: update all affected files (only within sentinel blocks or by appending if no sentinel exists). Never touch user-written content outside sentinels.

5. If no divergences: confirm *"All configs agree on the key dimensions."*

---

### `edit` — Update a preference across all configs

1. Ask what the user wants to change (free text, e.g. "switch linter to Biome", "add conventional commits rule").

2. Identify which files contain the relevant preference.

3. For each file: locate the relevant line(s) within sentinel blocks. If the preference is inside a sentinel block, update it. If it's in user-written content, highlight it and ask before touching it.

4. Show a preview of all changes across all files. Confirm before writing.

---

### `drift` — Tooling vs config consistency check

Goal: detect when the actual stack has changed but AI configs haven't caught up.

Load the full list of drift signal files and extraction rules from:

- [Drift signals reference](./references/drift-signals.md)

Procedure:

1. Scan for stack signal files: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `*.eslintrc*`, `biome.json`, `ruff.toml`, `.tool-versions`, `.nvmrc`, `Dockerfile`, etc. (full list in drift signals reference).

2. Extract named tools from each signal file (runtime version, linter, formatter, test runner, package manager).

3. For each AI config, extract the same dimensions (reuse `check` mode extraction).

4. Cross-compare: flag where a config mentions a tool that **no longer appears** in any stack signal file, or where a signal file mentions a tool that **no config** mentions.

5. Use git to add recency context:
   ```
   git log -1 --format="%ar" -- <signal-file>
   ```
   Only flag signal files changed more recently than the config that should reflect them.

6. Report findings as actionable items:
   ```
   Drift detected:
     copilot-instructions.md says: Jest
     package.json now has: Vitest (changed 3 days ago)
   → Update copilot-instructions.md? [Yes / No / Suppress]
   ```

7. For each accepted fix: apply via `edit` mode logic. For suppressions: add an inline comment `<!-- ai-config:suppress jest-mention -->` immediately after the flagged line.

8. **Structure drift — second pass** (always run after tooling checks):

   a. **Stale path check** — extract all path-like strings from each AI config (backtick-quoted or inline paths containing `/`). For each path, check whether it still exists in the repo. Flag missing paths at Medium severity.

   ```
   Stale path in AGENTS.md:
     `packages/legacy-api/` — directory no longer exists
   → Remove or update this reference? [Update / Remove / Suppress]
   ```

   b. **Undocumented directory check** — scan top-level and second-level dirs (for monorepos: `packages/*`, `apps/*`, `services/*`). Skip tooling/hidden dirs (`node_modules`, `.git`, `dist`, `build`, etc.). For each significant directory added more recently than the oldest AI config, check if any config mentions it. Surface undocumented ones at Low severity.

   ```
   Undocumented directory: packages/payments-service/
     Added 5 days ago. No AI config mentions it.
   → Add a brief description to AGENTS.md? [Yes / No / Suppress]
   ```

   If the user says Yes: ask for a one-sentence description, then insert it into the target config under a `## Project Structure` sentinel block.

   Full extraction rules, path patterns, skip lists, and the structure section template are in the [Drift signals reference → Structure Drift](./references/drift-signals.md).

---

## Merge Safety Rules

These rules apply to every write operation across all modes:

1. **Sentinel blocks** are the safe zone. Generated content always lives inside:
   ```
   <!-- ai-config:generated:<section-name> -->
   ...content...
   <!-- ai-config:end -->
   ```
   For `.mdc` files (Cursor), use YAML comments: `# ai-config:generated:<section>` / `# ai-config:end`.

2. **Never modify content outside sentinels** unless the user explicitly asks.

3. **First-time writes** (no existing sentinels): wrap the entire generated file in a sentinel block so future syncs know what is safe to touch.

4. **Suppression markers** `<!-- ai-config:suppress <id> -->` are user-written and must never be removed.

5. **Before any write**: show the user a clear before/after diff and get confirmation.

---

## Handoff Interface (from `repo-init`)

When `repo-init` calls this skill, it may pass a context object with pre-filled answers:

```
tools: [copilot, claude]
shell: bash
commit_style: conventional commits
confirmation: ask-before-destructive
extra: ["never modify test files without asking"]
methodology: spec-driven
stack:
  runtime: Node.js
  linter: ESLint + Prettier
  test: Vitest
```

When any of these keys are present, skip the corresponding question and use the provided value. Announce which values were pre-filled: *"Using choices from repo-init: tools (Copilot, Claude Code), shell (bash)."* so the user can correct anything before proceeding.

---

## Guidelines

- **Detect before acting.** Never assume what files exist — always scan first.
- **Prefer `AGENTS.md` for new setups.** It has the broadest native support and avoids vendor lock-in.
- **Surface multi-file divergence immediately.** When multiple configs exist, checking sync is always the first thing to offer.
- **Omission is not drift.** A config that doesn't mention a tool is not wrong. Only flag explicit contradictions or stale mentions.
- **Never overwrite user content.** Sentinel blocks define the safe zone. Everything outside is off limits without explicit user permission.
- **Ask one question at a time.** Even during the init interview, keep each prompt focused on a single decision.
- **Preview before write.** Always show what will be written and get confirmation before touching any file.
- **Suppressions are permanent.** Once a user suppresses a drift signal, never re-raise it in future runs.
- **Be concise in reports.** Show tool name, file, and the conflict — not paragraphs. Keep drift reports scannable.
