# Drift Signals Reference

Source-of-truth files the `ai-config` skill scans during `drift` mode, and how to extract named tools from each.

---

## What Counts as Drift

Drift is flagged when:
1. An AI config **explicitly names** a tool, AND
2. That tool **no longer appears** in any stack signal file, OR a signal file names a **different tool** in the same category
3. AND the signal file was **modified more recently** than the AI config

Omissions are never drift. A config that doesn't mention the linter is not wrong.

---

## Signal Files

### Node.js / TypeScript

| File | What to extract |
|------|----------------|
| `package.json` | `dependencies`, `devDependencies` key names for: test runners (vitest, jest, @jest/core, mocha), linters (eslint, @biomejs/biome), formatters (prettier, biome), runtimes (node version in `engines`), package managers (check `packageManager` field) |
| `.nvmrc` | Node.js version |
| `.node-version` | Node.js version |
| `package.json#packageManager` | `npm`, `yarn`, `pnpm`, `bun` with version |
| `biome.json` / `biome.jsonc` | Presence confirms Biome as linter+formatter |
| `.eslintrc*` / `eslint.config.*` | Presence confirms ESLint; check `extends` for plugin names |
| `prettier.config.*` / `.prettierrc*` | Presence confirms Prettier |
| `vitest.config.*` | Presence confirms Vitest |
| `jest.config.*` | Presence confirms Jest |

### Python

| File | What to extract |
|------|----------------|
| `pyproject.toml` | `[tool.ruff]` → Ruff linter; `[tool.black]` → Black formatter; `[tool.pytest.ini_options]` → pytest; `[tool.flake8]` → Flake8; `requires-python` → Python version; `[project]` `build-backend` → uv/poetry/hatch |
| `setup.cfg` | `[flake8]` → Flake8; `[tool:pytest]` → pytest |
| `.python-version` | Python version |
| `ruff.toml` | Presence confirms Ruff |
| `uv.lock` | Presence confirms uv as package manager |
| `poetry.lock` | Presence confirms Poetry |
| `requirements.txt` | Scan for: `pytest`, `ruff`, `flake8`, `black`, `mypy` |

### Go

| File | What to extract |
|------|----------------|
| `go.mod` | `module` line (module name), `go` directive (Go version) |
| `.golangci.yml` / `.golangci.yaml` / `.golangci.toml` | Presence confirms golangci-lint; `linters.enable` list for specific linters |
| `Makefile` | Scan for: `go test`, `golangci-lint run`, `gofmt` invocations |

### Rust

| File | What to extract |
|------|----------------|
| `Cargo.toml` | `[package]` `edition`, `rust-version`; `[dev-dependencies]` for test crates |
| `rust-toolchain.toml` / `rust-toolchain` | Rust toolchain channel and version |
| `.cargo/config.toml` | Build targets, custom test runners |

### Java / JVM

| File | What to extract |
|------|----------------|
| `pom.xml` | `<groupId>` patterns for: junit (JUnit 5), testng (TestNG), checkstyle-plugin, spotbugs-plugin; `<java.version>` or `<maven.compiler.source>` |
| `build.gradle` / `build.gradle.kts` | `dependencies` block for: junit, testng, checkstyle; `java { sourceCompatibility }` |
| `.mvn/wrapper/maven-wrapper.properties` | Maven version |
| `gradle/wrapper/gradle-wrapper.properties` | Gradle version |

### .NET

| File | What to extract |
|------|----------------|
| `*.csproj` | `<TargetFramework>` (e.g. `net9.0`); `<PackageReference>` for: xunit, nunit, mstest, coverlet |
| `global.json` | .NET SDK version |
| `.editorconfig` | Scan for `dotnet_diagnostic` rules → Roslyn analyzers |
| `stylecop.json` | Presence confirms StyleCop |

### Docker / Container

| File | What to extract |
|------|----------------|
| `Dockerfile` | `FROM` base image and tag → runtime and version |
| `docker-compose.yml` / `docker-compose.yaml` | Service `image` fields → runtimes and databases |
| `.dockerignore` | No extraction needed |

### Infrastructure / Cloud

| File | What to extract |
|------|----------------|
| `terraform.tf` / `*.tf` | `provider` blocks → cloud provider |
| `cdk.json` | Presence confirms AWS CDK; `app` field for runtime |
| `serverless.yml` | `provider.name` → cloud; `runtime` → Lambda runtime |
| `Chart.yaml` | Presence confirms Helm/Kubernetes |
| `bicep` files | Presence confirms Azure Bicep |

### Multi-runtime

| File | What to extract |
|------|----------------|
| `.tool-versions` | All `asdf` managed tools and versions (runtime, node, python, etc.) |
| `.mise.toml` | Same as `.tool-versions` for mise/rtx |

---

## Extraction Rules

1. **Prefer package manager lock files and config files** over `package.json` `dependencies` for confirmation — a config file for a tool is definitive proof it is in use.
2. **Presence of a config file > presence in dependencies** (e.g. `biome.json` exists → Biome is the linter, even if `eslint` is still in `devDependencies` as a transitive dep).
3. **Version extraction**: capture major.minor only (e.g. `Node.js 22`, `Python 3.13`, `Go 1.23`). Do not compare patch versions — minor bumps are not drift.
4. **Tool category mapping**: only flag drift within the same category. ESLint → Biome is a linter change (flag). ESLint still present + Biome added = both linters (ask user which is authoritative before flagging).

---

## Git Recency Check

For each signal file that shows a potential drift, run:

```bash
git log -1 --format="%ar %H" -- <signal-file>
```

And compare against the AI config file:

```bash
git log -1 --format="%ar %H" -- <ai-config-file>
```

Only flag drift when the signal file commit is **newer** than the AI config commit. If the AI config is newer, it may have already been updated manually — do not flag.

---

## Drift Severity Levels

| Level | Condition | Action |
|-------|-----------|--------|
| **High** | Config names Tool A; signal file names Tool B in same category; signal file is newer | Always surface |
| **Medium** | Config names Tool A; Tool A config file no longer exists in repo; signal file is newer | Surface |
| **Low** | Config names a version (e.g. Node 20); signal file shows different version (e.g. Node 22) | Surface as informational only, not a blocking fix |
| **Suppress** | User previously suppressed via `<!-- ai-config:suppress <id> -->` | Never surface again |

Show High and Medium by default. Ask the user if they want to see Low/informational drift separately.

---

## Structure Drift

Structure drift covers two distinct checks. Both are separate from tool drift and are always run as a second pass after the tooling checks.

### Check 1 — Stale path mentions

Extract all path-like strings from each AI config using this pattern:

```
# Matches: `src/`, ./src, src/foo/bar, packages/my-service
# Pattern: a word character sequence containing at least one /
# (backtick-quoted or unquoted, preceded by whitespace or line start)
regex: [`"]?([\w.-]+(?:/[\w.-]+)+/?)[`"]?
```

For each extracted path:
1. Strip any leading `./`
2. Check whether the path exists in the repo (`stat` or `ls`)
3. Flag if the path **does not exist** and the AI config was not updated after the path disappeared

Skip paths that look like URLs (`http`, `github.com/...`) or glob patterns (`**/*.ts`). Skip paths inside code fences that are clearly examples.

Report format:
```
Stale path in AGENTS.md:
  `packages/legacy-api/` — directory no longer exists
→ Remove or update this reference? [Update / Remove / Suppress]
```

### Check 2 — Undocumented significant directories

Scan the repo for significant top-level and second-level directories. A directory is **significant** if it:
- Is not a tooling/hidden directory (skip: `.git`, `node_modules`, `.venv`, `__pycache__`, `.cache`, `dist`, `build`, `coverage`, `.next`, `.turbo`, `target`, `bin`, `obj`)
- Contains source files (has at least one non-config file at any depth)
- Was added more recently than the oldest AI config file

For each significant directory found:
1. Search all AI configs for any mention of the directory name (simple substring match)
2. Flag if **no config mentions it at all**

For monorepos (detected by presence of `packages/`, `apps/`, `libs/`, `services/`, workspace config): scan **second-level** directories (e.g. `packages/my-service`) as the significant unit, not just top-level.

Report format (Low severity — informational):
```
Undocumented directory: packages/payments-service/
  Added 5 days ago. No AI config mentions it.
→ Add a brief description to AGENTS.md? [Yes / No / Suppress]
```

If the user says Yes: prompt them for one sentence describing the directory's purpose, then insert it into the appropriate AI config under a `## Project Structure` section (inside a sentinel block).

### Structure section template

When adding or updating structure documentation in a generated sentinel block, use:

```markdown
<!-- ai-config:generated:structure -->
## Project Structure
- `src/` — application source code
- `src/__tests__/` — unit and integration tests
- `packages/payments-service/` — payment processing microservice
<!-- ai-config:end -->
```

### What NOT to do

- Do not attempt to extract path descriptions from prose ("the frontend lives in the web directory") — prose extraction is unreliable
- Do not flag missing documentation for tooling directories, hidden directories, or generated output directories
- Do not auto-generate structure descriptions without user input — always ask for the one-sentence description
- Do not flag a directory that was added before all AI configs (it was likely already intentionally undocumented)
