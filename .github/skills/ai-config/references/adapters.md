# Adapter Reference

Per-tool file format rules, locations, sentinel syntax, and extraction hints for the `ai-config` skill.

---

## Sentinel Format

Generated content is always wrapped in sentinels so future syncs know what is safe to overwrite. Use the format appropriate to the file type.

### Markdown files (all tools except Cursor `.mdc`)

```markdown
<!-- ai-config:generated:<section-name> -->
...generated content...
<!-- ai-config:end -->
```

### Cursor `.mdc` files

```yaml
# ai-config:generated:<section-name>
...generated content...
# ai-config:end
```

### Suppression markers (user-written, never remove)

```markdown
<!-- ai-config:suppress <id> -->
```

---

## AGENTS.md — Shared / Generic

| Property | Value |
|----------|-------|
| File name | `AGENTS.md` |
| Location | Repo root |
| Frontmatter | No |
| Read by | Claude Code, GitHub Copilot (agent mode), Windsurf, OpenAI Codex |
| Sub-directory scoping | Create `AGENTS.md` in subdirectory for path-scoped rules |

### Format

Plain Markdown. No required structure, but the following sections are conventional and should be used when generating:

```markdown
# Agent Instructions

## Stack
- Runtime: ...
- Package manager: ...
- Linter: ...
- Formatter: ...
- Test runner: ...

## Conventions
- ...

## Shell
- Preferred shell: ...

## Commits
- Style: ...

## Workflow
- Confirmation: ...
- Extra: ...
```

### Extraction hints

When reading `AGENTS.md` to extract preferences, look for:
- Lines matching `- Runtime:`, `- Linter:`, `- Formatter:`, `- Test runner:` under a `## Stack` heading
- Lines under `## Conventions` as free-text rules
- Lines matching `- Preferred shell:` under `## Shell`
- Lines matching `- Style:` under `## Commits`

---

## CLAUDE.md — Claude Code

| Property | Value |
|----------|-------|
| File name | `CLAUDE.md` |
| Location | Repo root; optionally sub-directories for path-scoped rules |
| Frontmatter | No |
| Read by | Claude Code |
| Sub-directory scoping | Yes — place `CLAUDE.md` in any directory; Claude reads the closest ancestor |

### Format

Plain Markdown. Claude Code has no required schema but conventionally uses:

```markdown
# Claude Instructions

## Stack
- Runtime: ...
- Linter: ...
- Test runner: ...

## Conventions
- ...

## Allowed / Restricted Tools
- ...

## Workflow
- ...
```

### Format notes
- Can include `# Allowed tools` or `# Restricted tools` sections that Claude Code respects natively.
- Sub-directory `CLAUDE.md` files are merged with the root file; sub-directory rules take precedence for files in that path.

### Extraction hints
Same as `AGENTS.md`. Additionally look for `# Allowed tools` / `# Restricted tools` sections.

---

## copilot-instructions.md — GitHub Copilot

| Property | Value |
|----------|-------|
| File name | `copilot-instructions.md` |
| Location | `.github/` |
| Frontmatter | No |
| Read by | GitHub Copilot (agent mode) |
| Sub-directory scoping | Via separate `.instructions.md` files with `applyTo` |

### Format

Plain Markdown. No required schema. Copilot reads the full file as always-on context.

```markdown
# Copilot Instructions

## Stack
- Runtime: ...
- Linter: ...
- Test runner: ...

## Conventions
- ...

## Workflow
- ...
```

### File-scoped instructions (`.github/instructions/*.instructions.md`)

For path-scoped rules, create separate files with YAML frontmatter:

```markdown
---
applyTo: "src/tests/**"
---
# Test File Conventions
- Always use AAA structure
- ...
```

Only generate these when the user has explicit file-scoped rules to add. Do not create them automatically during `init`.

### Extraction hints
Same as `AGENTS.md`.

---

## Cursor — `.cursor/rules/*.mdc`

| Property | Value |
|----------|-------|
| File name | `<rule-name>.mdc` (e.g. `conventions.mdc`, `tests.mdc`) |
| Location | `.cursor/rules/` |
| Frontmatter | Yes — YAML between `---` markers |
| Read by | Cursor |
| Sub-directory scoping | Via `globs` in frontmatter |

### Format

```yaml
---
description: General coding conventions for this project
globs:
  - "**/*.ts"
  - "**/*.tsx"
alwaysApply: false
---
# Conventions

## Stack
- Runtime: ...
- Linter: ...

## Conventions
- ...
```

### Format notes
- `alwaysApply: true` means the rule is injected into every chat context.
- `alwaysApply: false` with a `description` means Cursor decides contextually when to apply it.
- `globs` scopes the rule to specific file patterns.
- Generate one rule file per logical concern (e.g. `conventions.mdc`, `testing.mdc`). Do not create a single monolithic rules file.
- Legacy `.cursorrules` (repo root, no frontmatter) is still supported but deprecated — if found, migrate to `.cursor/rules/` on request.

### Sentinel syntax
Use `# ai-config:generated:<section>` / `# ai-config:end` (YAML comment style) inside `.mdc` files.

### Extraction hints
Look for lines under `## Stack`, `## Conventions`, `## Workflow` in each `.mdc` file body. Also check `globs` frontmatter to understand scope.

---

## GEMINI.md — Gemini CLI

| Property | Value |
|----------|-------|
| File name | `GEMINI.md` |
| Location | Repo root |
| Frontmatter | No |
| Read by | Gemini CLI |
| Sub-directory scoping | No |

### Format

Plain Markdown. No required schema. Follow the same conventions as `AGENTS.md`.

### Extraction hints
Same as `AGENTS.md`.

---

## .clinerules — Cline

| Property | Value |
|----------|-------|
| File name | `.clinerules` |
| Location | Repo root |
| Frontmatter | No |
| Read by | Cline VS Code extension |
| Sub-directory scoping | No |

### Format

Plain Markdown or plain text. Treat as Markdown and use the same section headings as `AGENTS.md`.

### Extraction hints
Same as `AGENTS.md`. Note the file has no extension — treat as Markdown when reading.

---

## .windsurfrules — Windsurf

| Property | Value |
|----------|-------|
| File name | `.windsurfrules` |
| Location | Repo root |
| Frontmatter | No |
| Read by | Windsurf (Codeium) |
| Sub-directory scoping | No |
| Also reads | `AGENTS.md` natively |

### Format

Plain Markdown. Same conventions as `AGENTS.md`. Because Windsurf also reads `AGENTS.md`, `.windsurfrules` should only contain Windsurf-specific overrides or additions — not a duplicate of the shared config.

### Extraction hints
Same as `AGENTS.md`. When comparing with other configs, treat `AGENTS.md` + `.windsurfrules` as the combined Windsurf config.

---

## Extraction Dimensions (Cross-tool)

When reading any config file to extract preferences for `check` or `drift` mode, look for these dimensions:

| Dimension | What to look for |
|-----------|-----------------|
| Runtime / language | "Node.js", "Python", "Go", "Rust", "Java", ".NET", version numbers |
| Package manager | "npm", "yarn", "pnpm", "bun", "uv", "poetry", "pip", "cargo", "maven", "gradle" |
| Linter | "ESLint", "Biome", "Ruff", "Flake8", "Pylint", "golangci-lint", "Checkstyle", "Roslyn" |
| Formatter | "Prettier", "Biome", "Black", "gofmt", "rustfmt", "google-java-format" |
| Test runner | "Vitest", "Jest", "pytest", "testing (built-in)", "JUnit", "xUnit", "Testify", "go test" |
| Shell | "bash", "zsh", "fish", "PowerShell" |
| Commit style | "conventional commits", "gitmoji", "semantic commits" |
| Methodology | "TDD", "BDD", "SDD", "spec-driven", "test-first" |
| Restricted actions | "never", "always ask", "do not", "must not" patterns |

Use simple substring/pattern matching, not semantic reasoning, to keep extraction fast and deterministic.
