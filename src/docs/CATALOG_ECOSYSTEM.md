# Flow Catalog Ecosystem

Architecture and design decisions for flow distribution, discovery, and community infrastructure.

---

## Positioning: Who Leads the Ecosystem

Three distinct models are active in the market. Each answers the same question differently: **who holds the power in the distribution chain?**

### Platform-led — `marketplace.json` (Claude Code, GitHub Copilot CLI)

The tool vendor defines the format and ships the client. Content lives in developer-owned GitHub repos — there is no submission, no approval queue, no central registry. Users point their tool at any repo; the tool pulls and installs from there.

- **Power:** Tool vendor (controls the format spec and the client UX, not the content)
- **What they extract:** Format lock-in and client stickiness — if the format wins, everyone writes to it
- **Developer's position:** Owner of the repo, but writing to the vendor's format and installed via the vendor's client
- **Scope:** Assets only (skills, agents, hooks, MCP) — no orchestration opinion, no flows concept
- **Lock-in:** Moderate — content is in your repo, but the install path and format are vendor-defined; discovery is per-tool with no cross-tool index

### Index/registry service-led — `npx skills add` (skills.sh, agentskills.io)

A neutral third-party aggregates distribution across tools. Publishers register to the index. Users install via the index's CLI. The index owns the discovery channel and the registry.

- **Power:** Index service operator
- **What they extract:** Registry ownership, the distribution channel, future monetization of the index
- **Developer's position:** Publisher in a third-party registry (like npm but for skills)
- **Scope:** Skills only (SKILL.md) — the shallowest, most portable asset type
- **Lock-in:** Moderate — format is open (SKILL.md is just a file), but the index itself is a dependency

### Developer-led — our way

The harness is checked into the developer's or team's own repository. The catalog is federated and git-native — no single operator owns the registry. The `@flow` runtime is the orchestration layer neither platform providers nor index services have built.

- **Power:** The developer/team — the harness repo is *their* asset, not a submission to someone else's platform
- **What we extract:** Value from the orchestration runtime (`@flow`), not from controlling distribution
- **Developer's position:** Owner, not publisher — they run the catalog entry from their own repo
- **Scope:** Full harness — skills + agents + hooks + flows + orchestration patterns
- **Lock-in:** Minimal — git-native distribution, open formats, federated catalog with no gatekeeper

---

### The analogy

| Model | Infrastructure analogy |
|---|---|
| Platform-led | A file format standard + reference client — like RSS readers: the format is vendor-defined, content is dev-owned, but the client controls the UX |
| Index-led | npm registry — open format, but the registry is a shared dependency |
| Developer-led | self-hosted + federation — you own the repo, the catalog is DNS-like |

The right historical parallel for platform-led is **RSS + Google Reader**: Google didn't own the content or require submission, but whoever owned the dominant reader shaped what users saw and how they discovered feeds. When Google Reader died, the ecosystem fractured — because the discovery and client layer was centralized even though the content wasn't. `marketplace.json` is at the same risk: your content is in your repo, but if Claude Code or Copilot CLI becomes the dominant install path, they shape discovery by what they surface and how.

---

### Why this matters for what we build

The platform-led and index-led approaches are both **static asset distribution systems**. They have no opinion about how skills are orchestrated at runtime — which skill runs first, which passes context to which, how iteration and convergence work across roles. That is the gap `@flow` fills.

Because we fill the orchestration gap, we have a reason to exist *alongside* both the other paths — not instead of them. The `marketplace.json` and `skills.sh.json` manifests in the harness repo are **on-ramps** for users coming from those ecosystems, not replacements for our catalog.

The catalog is the community layer that supports the runtime. It is a **means**, not the product. The product is the orchestration runtime.

---

## Harness Repo Mission: Ecosystem for the Runtime

The harness repo's mission is to build a healthy content ecosystem that drives users toward `@flow` — not to be a neutral multi-tool asset store.

The direction of value flow:

```
Harness repo (skills, agents, flows)
    ↓  feeds
@flow runtime (orchestration, context injection, multi-role execution)
    ↓  creates
Outcomes that generic skills alone cannot produce
```

The `marketplace.json` and `skills.sh` compatibility paths run in the opposite direction: they are **on-ramps**, not destinations. Someone who discovers the harness via `npx skills add` gets useful skill files. Someone who discovers it via `@flow /browse` and runs a staged incident flow gets something qualitatively different — and comes back.

This shapes every design decision in the catalog:

- **Discovery metadata** (`orchestration`, `roles`, `context_required`) exists to help users find flows that are worth running, not just skills worth copying
- **Fork lineage** exists to build a community of flow authors, not just skill authors
- **Team harness co-located with code** exists to make `@flow` indispensable to a specific codebase, not just globally installed
- **Post-run feedback** surfaces after a flow runs — it's a `@flow`-native moment, not a `skills.sh` moment

The `marketplace.json` and `skills.sh.json` manifests are in the repo because they reduce friction for users who haven't yet encountered `@flow`. Once they run a flow, the static-file model feels incomplete by comparison. That's the intended sequence.

**What this means for content strategy:** the harness repo should prioritize publishing flows with rich orchestration (staged, fork-join, iterative) over publishing isolated skills. Skills travel well via `npx skills add`. Flows don't — they need `@flow`. Lean into what only we can deliver.

---

## Where We Could Be Strong: Honest Assessment

Orchestration is the core differentiator — but it only matters if people get there. These are the areas where we could build real strength or real friction on the path to adoption.

### 1. Gist as zero-friction atomic sharing unit — real, but narrow

`marketplace.json` requires a repo with a directory structure. `skills.sh` requires a repo. A Gist is the minimum viable sharing unit: write a flow, paste the URL, someone runs it in 30 seconds.

**Where this is genuinely strong:** standalone flows with no custom agents. A prompt engineer shares a debugging flow in a Slack message. A consultant shares a code review flow with a client. No repo setup, no npm package, no platform approval.

**Where it's marginal:** anything with companions (agents, skills). Multi-file Gists are clunky — no directory structure, naming conventions to infer destination. The more powerful the flow, the less the Gist model helps.

**Verdict:** Real strength for simple shareability, not a platform-level differentiator. Homebrew has taps; we have Gists for the simple case.

---

### 2. Fork-as-customization — underexplored but potentially strong

Neither `marketplace.json` nor `skills.sh` treats forking as a first-class workflow. When you install a plugin or a skill, you get a copy — but there's no concept of "I forked this from X and adapted it for my context," no lineage visible in the catalog, no community norm around sharing adaptations back.

The catalog surfaces fork counts. The installer shows `forked from levinunnink/war-room-triage`. The `@flow register` command points you to fork your source before registering a variant.

**Why this could matter:** flows are prompt-heavy. The same incident triage flow needs different role definitions for a startup vs. an enterprise. Forking is the correct customization model for this. If we establish fork lineage as a visible social signal early, we build a norm that the other platforms don't have.

**Risk:** only matters if there's enough content to fork in the first place. Chicken-and-egg.

---

### 3. Semantic catalog metadata — real, solves a real gap

`marketplace.json` has `keywords` and `category` as flat strings. `skills.sh.json` has `groupings`. Neither has:
- `orchestration: "staged"` vs `"sequence"` vs `"fork-join"`
- `roles: 6`
- `convergence: true`
- `context_required: ["git_history", "error_logs"]`

For someone searching "find me a staged incident flow with 4+ roles that needs git context," our catalog answers that question. The others return keyword matches on "incident."

**This is a real differentiator**, but only surfaces its value once content exists and users develop a search habit. Premature to over-build the metadata schema — start with `orchestration` and `roles`, extend from usage patterns.

---

### 4. Team harness co-located with code — strong for the right audience

Neither `marketplace.json` nor `skills.sh` has a "this harness is for this repo specifically" concept. A team's flow for debugging their payment service should live in the payment service repo, reference its actual file paths and conventions, and be available automatically when anyone opens the repo.

The `.claude/settings.json` `extraKnownMarketplaces` pattern + flows that reference local paths enables this. The harness is contextually aware of the specific codebase — not a generic "debugging flow" but a "debugging *this* service flow."

**This is a genuine differentiator** for team adoption. The other approaches always distribute generic, context-free assets. A flow that knows your repo's conventions, error formats, and file structure is categorically more useful than one that doesn't.

**This is also the clearest commercial lever:** teams will pay for flows that are customized to their codebase. Generic skills are a commodity; contextual flows are not.

---

### 5. Runtime context injection vs. static file copying — strongest long-term, hardest to show early

`skills.sh` copies SKILL.md files to a directory. `marketplace.json` installs a plugin bundle. Both are static at install time. `@flow` is a runtime — it can inject live workspace context (open files, diagnostics, git state, test results) into the prompt construction for each role at execution time.

A skill installed via `skills.sh` says "here are React best practices." A flow via `@flow` says "here are React best practices *applied to the specific component you're editing right now, with its current test failures and the last three commits that touched it.*"

**This is the deepest differentiator**, but it's invisible until you've experienced the difference. Hard to communicate pre-adoption, very sticky post-adoption.

---

### 6. Federated catalog with no gatekeeper — weak differentiator in practice

The federated structure means no single company controls who can register a flow. This is philosophically correct but practically weak as a selling point — most developers don't think about registry governance until it causes them pain (npm left-pad, etc.).

**Don't lead with this.** It's a resilience property, not a feature. It matters when something goes wrong with a centralized registry, not before.

---

### Summary: where to invest

| Strength | Genuine? | Invest now? | Why |
|---|---|---|---|
| Orchestration runtime | Yes — core | Yes | The reason to exist |
| Gist atomic sharing | Real but narrow | Low effort, keep it | Zero-friction on-ramp for simple flows |
| Fork-as-customization lineage | Real potential | Yes, establish the norm early | Hard to retrofit later |
| Semantic catalog metadata | Real, solves a gap | Minimal schema now, extend later | Don't over-build before content exists |
| Team harness co-located with code | Strong, commercial lever | Yes | Best path to paid adoption |
| Runtime context injection | Strongest long-term | Yes, it's already the runtime | The stickiness that justifies the ecosystem |
| Federated governance | Weak selling point | No extra investment | Resilience property, not a feature |

---

## Distribution Units

### Single-file Gist — simplest case

A flow that has no custom agents or skills is a single `.flow.yaml` file. A GitHub Gist is the right distribution unit:

- Zero friction to publish — 30 seconds, no repo setup
- Clean shareable URL (`gist.github.com/user/id`) that fits in a tweet or Discord message
- Stars on the Gist are the rating — no new mechanism needed
- Forks preserve the parent/child relationship; community customization is built in
- Raw content URL (`gist.githubusercontent.com/user/id/raw/flow.yaml`) is directly fetchable
- Comments provide lightweight "worked for me" / "breaks with X" feedback

**Install command:** `@flow install gist:abc123def456`

### Multi-file Gist — flow + custom companions

When a flow uses custom agents, skills, or prompts that are purpose-built for it and travel together as a unit, a multi-file Gist packages everything:

```
war-room-triage.flow.yaml
incident-commander.agent.md
db-specialist.agent.md
incident-triage.skill.md
status-update.prompt.md
README.md
```

One Gist URL, one star, one fork unit. The whole package is rated and distributed together.

**File destination convention** — Gists have no directory structure; the installer infers the destination from the file type:

| File pattern | Installs to |
|---|---|
| `*.flow.yaml` | `.github/flows/` |
| `*.agent.md` | `.github/agents/` |
| `*.skill.md` | `.github/skills/{name}/SKILL.md` |
| `*.prompt.md` | `.github/prompts/` |
| `README.md` | Shown in preview only, not installed |

The flow YAML's `agent:` and `skills:` references act as the implicit manifest — the installer matches them against files in the Gist by name.

**Install manifest** — always shown before writing files, user must confirm:

```
@flow install gist:abc123def456

"War Room Triage Suite" by levinunnink  ★ 47  ·  forked 12×

Will install:
  ├─ .github/flows/war-room-triage.flow.yaml
  ├─ .github/agents/incident-commander.agent.md  (new)
  ├─ .github/agents/db-specialist.agent.md       (new)
  ├─ .github/skills/incident-triage/SKILL.md     (new)
  └─ .github/prompts/status-update.prompt.md     (new)

[Install all]  [Preview agents]  [Cancel]
```

"Preview agents" is recommended — agent files run as system prompts with access to workspace context (see Security below).

### GitHub Repo — flow library with shared components

When multiple flows share the same agent or skill, a Gist per flow duplicates the shared component. A repo is the right unit:

```
my-flow-library/
  flows/
    war-room-triage.flow.yaml
    post-mortem.flow.yaml
  agents/
    incident-commander.agent.md
    db-specialist.agent.md        ← shared by both flows
  skills/
    incident-triage/SKILL.md
  prompts/
    status-update.prompt.md
```

**Install command:** `@flow install github:levinunnink/incident-flows`

Installs the full library. Flow YAMLs reference agents by name; the installer resolves them from the repo's `agents/` directory.

### The tier model

| Complexity | Unit | Command |
|---|---|---|
| Single flow, built-in agents | Single-file Gist | `@flow install gist:abc123` |
| Single flow + custom companions | Multi-file Gist | `@flow install gist:abc123` |
| Multiple flows sharing components | GitHub Repo | `@flow install github:owner/repo` |
| Org-wide library | GitHub Repo (private) | `@flow install github:org/repo` |

The `@flow install` command handles all four cases — the URI scheme determines resolution. Users don't need to know which tier they're in.

---

## URI Schemes

Two schemes in `@flow install`, `@flow register`, and flow YAML `source:` fields:

| Scheme | Format | Example |
|---|---|---|
| `gist:` | `gist:{gist_id}` | `gist:abc123def456` |
| `github:` | `github:{owner}/{repo}` or `github:{owner}/{repo}/{path}` | `github:levinunnink/flows/war-room-triage.flow.yaml` |

Both schemes are resolved through a common interface in the extension — swapping the backend later is a resolver concern, not an extension concern.

---

## The Catalog

### Why a catalog is needed

Gist search is notoriously poor. GitHub repo search is not filterable by content type. Without a catalog, the only discovery mechanism is someone sharing a URL directly. The catalog is the discoverability layer on top of Gist/repo distribution.

### Federated structure

The catalog repo (`feima/flows-catalog`) holds per-provider `catalog.json` files in a `catalogs/` directory tree. Each provider owns their namespace — no merge conflicts:

```
feima/flows-catalog
  index.json                     ← auto-generated, extension fetches ONLY this
  catalogs/
    _official/
      catalog.json               ← feima-curated, maintainer-only PRs
    community/
      levinunnink/
        catalog.json
      acme-corp/
        devops/
          catalog.json           ← org can sub-divide by domain
        frontend/
          catalog.json
      sre-tools/
        catalog.json
```

### Per-provider `catalog.json` format

Both `gist:` and `github:` sources in the same file:

```json
{
  "provider": "levinunnink",
  "flows": [
    {
      "id": "war-room-triage",
      "name": "War Room Triage",
      "description": "Multi-role incident triage: Commander, Recent Changes, App, Infra, Data layers",
      "source": "gist:abc123def456",
      "tags": ["incident", "devops", "staged", "sre"],
      "category": "operations",
      "orchestration": "staged",
      "roles": 6
    },
    {
      "id": "post-mortem-suite",
      "name": "Post-Mortem Suite",
      "description": "Retrospective incident analysis with five-whys framing",
      "source": "github:levinunnink/incident-flows",
      "tags": ["incident", "retrospective"],
      "category": "operations",
      "orchestration": "sequence",
      "roles": 4
    }
  ]
}
```

Canonical flow address: `provider/flow-id` — `levinunnink/war-room-triage`. No collisions possible across providers.

### The `index.json` — performance solution

Fetching every `catalog.json` in the tree on every `/browse` call would be 500 HTTP requests at scale. Instead, a GitHub Actions workflow merges all catalog files into a single `index.json` at the repo root on every catalog change:

```yaml
# .github/workflows/build-index.yml
on:
  push:
    paths: ['catalogs/**']
jobs:
  build:
    steps:
      - run: node scripts/build-index.js  # merges catalogs/, fetches star counts, writes index.json
      - run: git commit -am "rebuild index" && git push
```

The Action fetches live star counts from the GitHub/Gist APIs using the repo's `GITHUB_TOKEN` — no rate limit anxiety. Star counts in `index.json` are always fresh after each catalog change.

The extension fetches `index.json` once. Federated structure is the **authoring model**; `index.json` is the **query model**.

### Trust tiers

The directory path encodes the trust level — no separate metadata field needed:

| Path | Badge | Who can PR |
|---|---|---|
| `catalogs/_official/` | `[official]` | Repo maintainers only |
| `catalogs/community/{username}/` | `[community]` | Anyone — bot auto-validates |

```
@flow browse incident

[official]   feima/war-room-triage          ★ 184
[official]   feima/post-mortem              ★ 91
[community]  levinunnink/triage-v2          ★ 47
[community]  sre-tools/incident-runbook     ★ 23
```

---

## Registration

### `@flow register` command

```
@flow register gist:abc123def456

Fetching... ✓
Validated schema ✓
No injection patterns detected ✓

"War Room Triage" — staged, 6 roles
Auto-detected tags: staged, incident, devops, sre

Target: catalogs/community/levinunnink/catalog.json
(file doesn't exist yet — will create it)

[Open registration PR]  [Edit metadata]  [Cancel]
```

"Open registration PR" navigates to `github.com/feima/flows-catalog/new` with the JSON entry pre-filled in a PR template. Author only touches their own namespace file — no conflicts with other authors.

### GitHub Actions validation bot

Runs on every PR to `catalogs/**`:

1. Validates `catalog.json` schema
2. Fetches each `source:` URL and validates the flow YAML is parseable
3. Checks for prompt injection patterns in referenced agent/flow prompts
4. Verifies provider namespace matches directory (`catalogs/community/levinunnink/` must have `"provider": "levinunnink"`)
5. Auto-approves `community/` tier PRs that pass all checks
6. Flags for manual review if any check fails

---

## Team / Private Catalogs

Small teams can copy the catalog repo structure into a private GitHub repo. The same GitHub Action builds their `index.json`. GitHub repo permissions handle access control — no additional auth system needed.

### The per-repo config friction problem

The `additionalCatalogs` extension setting lives in workspace settings. A team with 15 repos would need to add it to 15 `settings.json` files. This kills adoption.

### Solution: `.github/copilot-ai-flow.json`

A config file committed to the workspace root, picked up automatically by the extension:

```json
{
  "catalogs": [
    {
      "name": "Acme Internal Flows",
      "source": "github:acme-corp/flow-library/index.json",
      "trust": "team"
    }
  ]
}
```

Every developer who opens the repo gets the team catalog with zero personal configuration. Commit once, team-wide effect.

### Team catalog scale assessment

| Team size | Self-hosted feasibility | Notes |
|---|---|---|
| 1–3 (indie) | Low — setup overhead exceeds value | Better to use public catalog |
| 5–20 (small team) | High — GitHub native, familiar tooling | Best fit |
| 20–100 (mid-size) | High with `.github/copilot-ai-flow.json` | Multiple teams can use sub-folders |
| 100+ (enterprise) | Requires SSO, audit logs, policy enforcement | Out of scope for git-based model |

---

## Security

Agent files (`*.agent.md`) run as system prompts with access to the user's workspace context. A malicious flow is a prompt injection vector — it could instruct the model to exfiltrate file contents or send data to external URLs.

**Mitigations:**

- The install manifest shows all files before writing — user can see what they're installing
- "Preview agents" prompt before confirming multi-file installs
- The registration validation bot checks for known injection patterns (external URL references in prompts, data exfiltration instructions, base64 encoding tricks)
- `_official/` tier flows are manually reviewed by maintainers
- Community tier flows are bot-validated; manual escalation on flag

**Rule:** Never auto-install an agent file without showing the user what it contains first.

---

## Social Signals: Does Per-Item Rating Actually Matter?

Both `marketplace.json` (Claude Code / Copilot CLI) and `npx skills add` (skills.sh) operate at **repo level** — the social signal is GitHub stars on the repo, not on individual skills. The previous design proposed per-flow Gist stars as fine-grained ratings. Is that actually better?

### What "fine-grained rating" would require

Per-item social signals for a multi-skill/multi-flow repo requires one of:
- A separate Gist per item (free but fragments the package)
- A backend to store votes (auth, storage, GDPR surface, infra cost)
- Per-item GitHub Discussions (high friction for voters)

GitHub stars on a repo are free, familiar, and zero-friction. Per-item stars require either fragmentation or infrastructure.

### The signals that actually drive quality discovery

| Signal | Granularity | Infrastructure | Reliability |
|---|---|---|---|
| Publisher trust tier (`_official/` vs `community/`) | Repo level | None (directory path) | High — audited |
| Description match | Item level | None (metadata quality) | Correlates with author care |
| Recency (last commit / updated field) | Item level | None (git timestamp) | High |
| Repo stars | Repo level | None (GitHub native) | Moderate — measures popularity, not quality |
| Per-item stars | Item level | Fragmentation or backend | Low ROI — high cost |
| Local run history | Item level | Local only (no infra) | High — actual usage data |

The discovery question is usually "which skill should I use for X?" — answered by description match and publisher trust, not by star deltas between similar items in the same package. Nobody picks `react-best-practices` over `react-native-guidelines` based on stars; they pick based on whether it matches their situation.

### Where repo-level social IS the right unit

The unit of viral sharing is the package, not the item:
- "Use Vercel's agent skills" — 27k stars on the repo, shared as a URL
- "Use feima's incident harness" — one star, one link, one trust decision

A team evaluating whether to adopt a harness is making one trust decision about the publisher, not 12 separate trust decisions about each skill. Repo-level stars are the right signal for that decision.

### Where per-item granularity does matter — and the right mechanism

There is one case where item-level signal matters: **within a repo with many skills, which ones are actually worth using?** But the right mechanism for this is not social stars — it's **local usage telemetry**:

- Local `👍` flags written to the installed item's manifest: "you've run this flow 8 times, marked helpful 6 times"
- Opt-in aggregate telemetry: "3,400 teams have run `incident-triage` this month" — surfaced in `/browse` results as an install count, not a rating
- Recency: items last updated 2 years ago are de-ranked automatically

Local run history is per-item, requires no social infrastructure, and captures actual quality (did it work for the person running it) rather than pre-install sentiment.

### Verdict

**Repo-level social (GitHub stars) is sufficient for trust and discovery. Per-item local run history is the right quality signal — no social infrastructure needed.**

The Gist-per-flow model still works for simple standalone flows because each Gist is naturally starable and forkable at the item level — that's a distribution property of Gists, not a thing we need to build. For multi-item packages, don't fight the grain.

---

## Post-Run Feedback

After a flow completes, the stream footer renders feedback affordances:

```
---
Was this flow useful?  ⭐ Star on GitHub  ·  💬 Comment  ·  🔀 Fork & customize
```

- **⭐ Star** — opens the Gist or repo page for starring; this IS the rating signal
- **💬 Comment** — opens the flow's `discussions_url` from the catalog entry (GitHub Discussions or pinned issue)
- **🔀 Fork** — opens the Gist/repo fork page; community customization entry point

Local `👍` flags are written to the installed flow's manifest entry — "you've run this flow 8 times and marked it helpful 6 times" is surfaceable in future `/browse` results.

---

## Commercial Progression

The free tier proves value and seeds community. The paid tier addresses gaps that emerge once teams adopt.

```
Free                                Paid (future, open question)
  │                                   │
  ├─ Public catalog (official + community) ├─ Flow Insights (usage analytics per team)
  ├─ Self-hosted team catalog         ├─ Managed catalog hosting (no GitHub repo setup)
  ├─ .github/copilot-ai-flow.json     ├─ Verified publisher badge in public catalog
  └─ Gist + repo distribution         └─ Enterprise: SSO, audit logs, policy enforcement
```

The analytics gap is the first commercial trigger: team leads will ask "which flows is my team actually using?" within the first month of adoption. The extension already fires analytics events (opt-in); the Insights product is the aggregation and visualization layer on top.

Enterprise index solution is an open question — held for when the free tier has proven the market.

---

## Acquisition Flows and Author Tooling

### Two acquisition paths, two different entry points

The ecosystem has two distinct motion patterns. They target different people and need different tools.

#### Path A — User-side: skills install → flow execution

A user already has skills installed (via `marketplace.json` or `npx skills add`). They discover `@flow` and want to use those skills inside a flow. The extension needs to find the installed skills automatically.

##### `installed.json` — VS Code's own plugin registry, designed for external tools

VS Code Insiders (and VS Code) maintains an `installed.json` file in the `agent-plugins` directory of the user profile:

```
Windows:  C:\Users\<user>\.vscode-insiders\agent-plugins\installed.json
Linux:    ~/.config/Code - Insiders/agent-plugins/installed.json
macOS:    ~/Library/Application Support/Code - Insiders/agent-plugins/installed.json
```

The VS Code source code comment in `fileBackedInstalledPluginsStore.ts` says explicitly:

> *"This makes the installed-plugin manifest discoverable by external tools (CLIs, other editors, etc.) without depending on VS Code internals."*

This is **intentional design** — not a private internal detail. The on-disk format is stable and documented:

```json
{
  "version": 1,
  "installed": [
    {
      "pluginUri": "file:///C:/Users/user/.vscode-insiders/agent-plugins/levinunnink.incident-harness/",
      "marketplace": "copilot",
      "name": "incident-harness"
    }
  ]
}
```

Each `pluginUri` points to the installed plugin directory. Those directories follow the standard plugin layout — `skills/`, `agents/`, `hooks/`, etc. — parseable without VS Code internals.

##### The four scan paths for ambient skill discovery

Combining `installed.json` with the other standard installation directories gives `@flow` a complete picture of every skill already on the user's machine, regardless of how it was installed:

| Install channel | Scan path | What it contains |
|---|---|---|
| VS Code plugin marketplace | `<agent-plugins-dir>/installed.json` → each `pluginUri` | Full plugins: skills, agents, hooks, MCP |
| Copilot CLI | `~/.copilot/installed-plugins/<marketplace>/<plugin>/` | Same plugin layout — CLI-installed |
| Claude Code | `~/.claude/plugins/cache/<marketplace>/<plugin>/` | Same plugin layout — Claude-installed |
| `npx skills add` | `~/.claude/skills/<name>/SKILL.md` | Skills only — flat directory |

All four paths are readable by `@flow` using `vscode.workspace.fs` — no special permissions, no internal VS Code API needed.

##### What ambient skill discovery enables

**At flow execution time:** when a flow says `skills: [react-best-practices]`, `@flow` resolves the name against the ambient skill registry. If `react-best-practices` was installed via any channel, it resolves without requiring the user to re-install or configure anything. Skills installed via the VS Code plugin marketplace, Copilot CLI, or `npx skills add` are all automatically usable in flows.

**In skill name autocompletion:** flow YAML editing can suggest skill names from the ambient registry — the user doesn't need to know exact names from memory.

**In `@flow /browse`:** catalog entries can show `[installed]` badges for items already on the machine — actionable like a package manager, not just a search result. The delta between "installed" and "in-catalog" is the upgrade path.

```
@flow /browse incident --skills

  [installed] levinunnink/incident-triage     skill   used in 4 flows
  [installed] vercel/typescript-guidelines    skill   used in 2 flows
              sre-tools/runbook-executor      skill   0 flows yet  ← not installed
```

**Path from install → flow:** a user who has installed skills via VS Code UI and opens `@flow /browse` sees their existing skills flagged as available. The path to composing them into a flow — via `harness wrap` or a catalog flow that uses them — is one step away, not a reinstall.

**What needs building in the extension:**

```typescript
// src/flow/skillRegistry.ts  (new)
export class AmbientSkillRegistry {
  // 1. Reads installed.json → resolves pluginUris → scans skills/ dirs
  // 2. Scans ~/.copilot/installed-plugins/**/ for CLI-installed plugins
  // 3. Scans ~/.claude/plugins/cache/**/ for Claude Code plugins
  // 4. Scans ~/.claude/skills/ for npx-skills-add installs
  // Returns: Map<skillName, { uri: vscode.Uri, source: InstallChannel }>
  async buildRegistry(context: vscode.ExtensionContext): Promise<SkillMap>
}
```

The path to `installed.json` is derivable from `context.globalStorageUri`: walking up from `<userDataDir>/User/globalStorage/<extensionId>/` three levels reaches `<userDataDir>/`, then appending `agent-plugins/installed.json` gives the file. The Copilot CLI and Claude paths are home-directory-relative and stable across platforms.

This is the "skills travel free, flows need `@flow`" path: the user already has the ingredients from however they installed them, `@flow` provides the recipe and knows which ingredients are in the cupboard.

#### Path B — Author-side: existing skill repo → Gist → harness catalog → runtime

An existing skill repo owner wants to become a flow author. Their current content is already useful to users via `skills.sh` or `marketplace.json`. The question is: **how do they cross the gap into the orchestration ecosystem with the least friction?**

The barrier today:
1. They know their skill — they don't know how to write a `.flow.yaml` that uses it well
2. They don't know the Gist publishing convention
3. They don't know how to register in the catalog

The intended author journey:
```
existing skills repo
    ↓  wrap: generate a .flow.yaml that demonstrates the skill in orchestration
Gist (flow + companions bundled)
    ↓  publish: push to GitHub Gist API, get a shareable URL
@flow install gist:abc123 (users can install it)
    ↓  register: open a PR to feima/flows-catalog with metadata pre-filled
@flow /browse shows it, users find it, adoption happens
```

Each step is currently manual. That's the friction we need to eliminate.

---

### The `harness` publisher CLI

A single CLI tool covers the full author journey. The happy path is one command.

**Install:**
```bash
npm install -g @feima/harness
# or without installing:
npx @feima/harness <command>
```

**Core commands:**

```bash
harness wrap   <skill-source>        # generate a .flow.yaml from an existing skill
harness publish <flow-file>          # bundle + push to GitHub Gist
harness register <gist-id|url>       # open a pre-filled PR to the catalog
harness publish <flow-file> --register  # publish + register in one command
```

**The one-liner for an existing skill repo owner:**
```bash
npx harness publish ./flows/react-review.flow.yaml --register
```

That's the target UX. Everything else is detail.

---

### `harness wrap` — the hardest step made easy

The biggest barrier for existing skill authors is the blank `.flow.yaml`. They know their skill content but haven't thought about how to orchestrate it. `harness wrap` generates a starting-point flow that demonstrates the skill in a multi-role context:

```bash
harness wrap skills/react-best-practices/SKILL.md --output flows/react-review.flow.yaml
```

Reads the SKILL.md, infers a useful orchestration pattern, writes:

```yaml
name: React Code Review
description: Multi-stage review using React best practices (wrapped from react-best-practices skill)
stages:
  - name: Review
    iterations: 1
    roles:
      - name: reviewer
        skills: [react-best-practices]
        prompt: "Review the provided code against React best practices. Identify issues in hooks usage, component composition, and performance patterns."
  - name: Remediation
    iterations: 2
    roles:
      - name: fixer
        skills: [react-best-practices]
        prompt: "Apply the fixes identified in the review. Explain each change."
```

The generated flow isn't a final product — it's a starting point that the author customizes. But it demonstrates the orchestration value immediately: the skill alone is a static instruction file; the flow applies it in two stages with iteration.

The wrap step can also pull from a remote skill:

```bash
harness wrap github:vercel/agent-skills/react-best-practices --name "React Review Flow" --output flows/react-review.flow.yaml
harness wrap gist:abc123def456 --output flows/wrapped.flow.yaml
```

---

### `harness publish` — bundle + Gist in one command

```bash
harness publish ./flows/react-review.flow.yaml
```

What it does:
1. Reads the `.flow.yaml`
2. Resolves all `agent:` and `skills:` references to local files
3. Bundles them as Gist files with the naming convention (`.flow.yaml`, `.agent.md`, `.skill.md`)
4. Creates or updates a GitHub Gist via the API (requires `GITHUB_TOKEN` or `gh` CLI auth)
5. Prints the result:

```
✓ Published "React Code Review Flow"

  Gist: https://gist.github.com/levinunnink/abc123def456
  Install: @flow install gist:abc123def456

Files published:
  react-review.flow.yaml
  react-best-practices.skill.md

Run with --register to open a catalog PR.
```

Updating an existing flow re-uses the same Gist (stored in a local `.harness-state.json` or in the flow YAML's `source:` field after first publish):

```bash
harness publish ./flows/react-review.flow.yaml  # updates in place if Gist already exists
```

**Auth:** uses `gh auth token` if `gh` CLI is installed, otherwise prompts for `GITHUB_TOKEN`. No new auth surface.

---

### `harness register` — open catalog PR with metadata pre-filled

```bash
harness register gist:abc123def456
# or after publish:
harness register  # reads source: from the flow YAML
```

What it does:
1. Fetches the flow from the Gist
2. Validates the schema
3. Checks for injection patterns (same checks the GitHub Actions bot runs)
4. Extracts metadata: name, description, roles count, orchestration type, context hints
5. Auto-suggests tags from skill names and prompt content
6. Shows a preview:

```
"React Code Review Flow" by levinunnink

  orchestration: staged
  roles: 2 (reviewer, fixer)
  auto-tags: react, code-review, staged, frontend

  catalog target: catalogs/community/levinunnink/catalog.json
  (file doesn't exist yet — will create it)

[Open PR]  [Edit metadata]  [Cancel]
```

7. `[Open PR]` navigates to `github.com/feima/flows-catalog/new` with the JSON pre-filled, or uses `gh pr create` if the author has `gh` installed and has forked the catalog repo

**For authors with `gh` installed (fast path):**
```bash
harness register --auto  # no prompts, opens PR immediately
```

---

### The full one-command journey from scratch

```bash
# Author has an existing SKILL.md they want to flow-enable:

harness wrap skills/my-skill/SKILL.md --output flows/my-flow.flow.yaml
# Edit flows/my-flow.flow.yaml to customize the prompts

harness publish flows/my-flow.flow.yaml --register
# ↑ bundles, pushes to Gist, opens catalog PR — done
```

For an author with an existing skill repo (like Vercel's `agent-skills`), the full onboarding to the `@flow` ecosystem is:

```bash
cd agent-skills
npx @feima/harness wrap skills/react-best-practices/SKILL.md --output flows/react-review.flow.yaml
# customize the generated flow
npx @feima/harness publish flows/react-review.flow.yaml --register
```

Three commands (including the customization step). One outcome: their skill is now in the harness catalog as a flow, discoverable via `@flow /browse`, installable via `@flow install gist:abc123`.

---

### What the CLI changes about the ecosystem dynamics

Without this tool, the author journey requires: knowing the Gist file naming convention, knowing the GitHub API or Gist UI, knowing the catalog JSON schema, knowing how to fork the catalog repo and open a PR. Each step is a dropout point.

With the tool, the steps collapse to:
1. Write or generate a `.flow.yaml`
2. Run `npx harness publish --register`

The more skill repo owners complete step 2, the richer the catalog gets, the more users encounter `@flow` via `/browse`, the more the runtime adoption grows. The CLI is the flywheel accelerant.

---

### Implementation: `@feima/harness` CLI

A standalone Node.js package (`packages/harness-cli/` in the monorepo, or its own repo):

| Module | Responsibility |
|---|---|
| `wrap.ts` | Parse SKILL.md, generate `.flow.yaml` template |
| `bundle.ts` | Resolve local companion files, prepare Gist file map |
| `gistApi.ts` | Create/update Gists via GitHub REST API |
| `catalog.ts` | Generate catalog entry JSON from flow metadata |
| `register.ts` | Fork check, PR creation via `gh` CLI or browser fallback |
| `state.ts` | Read/write `.harness-state.json` (local publish state) |
| `auth.ts` | `gh auth token` → `GITHUB_TOKEN` env → interactive prompt |

**External dependencies:** `@octokit/rest` (Gist + PR API), `js-yaml` (flow parsing), `chalk` (terminal output). No runtime dependency on the VS Code extension.

**Relationship to `@flow register` in the extension:** the extension's `@flow register` command is the in-editor path to the same catalog PR workflow. The CLI is for authors who work outside VS Code, want CI integration, or prefer shell tooling. Same outcome, two surfaces.

| Addition to extension implementation table | Priority |
|---|---|
| Skill resolution from `~/.claude/skills/` and plugin cache | P1 — enables Path A (user-side acquisition) |
| `harness wrap` CLI | P1 — removes the blank-flow barrier for skill authors |
| `harness publish` CLI | P1 — automates Gist bundling |
| `harness register` CLI | P2 — automates catalog PR (same logic as `@flow register`) |
| `.harness-state.json` local state (tracks Gist IDs per flow) | P2 |

---

### GitHub Action: Automated Gist Publish + Catalog Sync

**Evaluation:** worth building — and the architecture decision it forces improves the catalog design.

#### What `gist-repo-sync` does vs. what we need

`gist-repo-sync` is a flat file sync: you point it at a `source_path`, it copies all files in that directory to a pre-created Gist. It requires you to create the Gist first and hardcode its ID. No metadata extraction, no bundling awareness, no schema knowledge. It's a deployment tool for a single Gist you already manage.

What we need is categorically different:
- Detect all `.flow.yaml` files in the repo (not just one path)
- For each flow, resolve and bundle its companion files (the agents and skills it references)
- Create Gists automatically (no pre-created ID), store the ID for future updates
- Extract flow metadata and write a `catalog.json`
- Keep Gists and catalog in sync on every push

This is not a wrapper around `gist-repo-sync`. It's a new action.

#### The key architectural insight: repo-owned `catalog.json`

The existing catalog design has authors PR their catalog entry to `feima/flows-catalog/catalogs/community/{author}/catalog.json`. That requires a one-time PR per flow (or per update). An Action that auto-PRs to an external repo on every push is noisy, creates security review surface, and requires write access across repo boundaries.

The better model: **each skill repo owns a `catalog.json` at its root**. The harness index builder fetches from all registered repos' catalog endpoints. Authors maintain their own catalog; the harness aggregates.

```
levinunnink/incident-flows/
  catalog.json              ← Action writes this, author owns it
  flows/
    war-room-triage.flow.yaml
  skills/
    incident-triage/SKILL.md
```

The `feima/flows-catalog` repo holds a `sources.json` — the list of repos that have a `catalog.json` to fetch:

```json
{
  "sources": [
    "github:vercel/agent-skills/catalog.json",
    "github:levinunnink/incident-flows/catalog.json",
    "github:acme-corp/devops-harness/catalog.json"
  ]
}
```

The `build-index.yml` Action fetches all listed `catalog.json` files, merges them into `index.json`. **Adding a new repo to the ecosystem is now a one-time PR to add one line to `sources.json`** — not a PR per flow.

This is the RSS model applied: each repo is a feed endpoint; the index builder is the feed aggregator. Authors control their entries; the aggregator doesn't require write permission into author repos.

#### The Action UX — install cost for existing skill repo owners

Add one workflow file, set one secret. That's it.

```yaml
# .github/workflows/harness-publish.yml
name: Publish to Harness Index

on:
  push:
    branches: [main]
    paths: ['skills/**', 'flows/**', '*.flow.yaml', 'marketplace.json']
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: feima/harness-publish-action@v1
        with:
          gist_token: ${{ secrets.GIST_TOKEN }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

Two inputs:
- `GIST_TOKEN`: PAT with `gist` scope — one-time setup, author creates in GitHub settings
- `GITHUB_TOKEN`: built-in, no setup needed (used to commit the updated `catalog.json` back to the repo)

The Action detects structure automatically from the repo — no configuration of paths needed.

#### What the Action does for existing `marketplace.json` repos

Existing skill repos typically have:
```
vercel/agent-skills/
  marketplace.json          ← already exists
  skills/
    react-best-practices/SKILL.md
    typescript-guidelines/SKILL.md
    testing-patterns/SKILL.md
```

The Action, on first run:
1. Reads `marketplace.json` to understand the repo structure (skills list, existing plugin definitions)
2. For each skill folder: creates a single-file Gist (`react-best-practices.skill.md`)
3. For each `.flow.yaml` it finds: bundles with companion files, creates a multi-file Gist
4. Writes `catalog.json` to the repo root:
   ```json
   {
     "provider": "vercel",
     "updated": "2026-05-29T00:00:00Z",
     "skills": [
       { "id": "react-best-practices", "name": "React Best Practices", "source": "gist:abc123", "tags": ["react", "frontend"] },
       { "id": "typescript-guidelines", "name": "TypeScript Guidelines", "source": "gist:def456", "tags": ["typescript"] }
     ],
     "flows": []
   }
   ```
5. Commits the `catalog.json` back to the repo
6. Outputs a summary:
   ```
   Published 3 skills as Gists
   Published 0 flows (no .flow.yaml files found)
   
   catalog.json written to repo root.
   
   Next step: add your repo to the harness index
     → PR to feima/flows-catalog: add "github:vercel/agent-skills/catalog.json" to sources.json
     → Or run: npx @feima/harness register-source
   
   💡 Your skills have no associated flows. Run `harness wrap` locally to create orchestration
      patterns that make your skills more powerful:
        npx @feima/harness wrap skills/react-best-practices/SKILL.md
   ```

On subsequent runs: detects changed skills/flows, updates the affected Gists only, updates `catalog.json`.

#### What the Action does and doesn't do for skill-only repos

**Does:**
- Publishes each skill as a standalone, installable Gist
- Gets the skills into the harness index so `@flow /browse` surfaces them
- Keeps Gists in sync on every push — authors don't think about it
- Surfaces the "you have skills but no flows" prompt as a step-function nudge

**Doesn't:**
- Generate flows automatically (auto-generated low-quality flows are worse than none)
- Force the author to write a flow as a condition of being in the index (skills are valid catalog entries)
- PR to the external catalog repo on every push (that's the `sources.json` one-time registration)

Skills in the index without associated flows are valid and useful — `@flow /browse react` returns them, users can reference them in custom flows. The presence in the catalog creates the ecosystem feedback pressure. The `harness wrap` nudge in the Action output is the path to the upgrade.

#### Full component type system: skills, prompts, flows, and harnesses

Skills and prompts are valid first-class catalog entries — not just tolerated entries pending promotion to flows, but **discoverable building blocks for flow crafting**. The distinction matters for the browse UX: they are framed as components, not products.

The catalog schema supports four `type` values:

| Type | File type | What it is | Discoverable as |
|---|---|---|---|
| `skill` | `*.skill.md` / `SKILL.md` | Reusable knowledge/instruction file — the "what to do" | Component |
| `prompt` | `*.agent.md` / `*.prompt.md` | Reusable role/agent definition — the "who does it" | Component |
| `flow` | `*.flow.yaml` | Complete orchestration pattern — references skills and prompts | Product |
| `harness` | full package | Multiple flows + skills + prompts as a cohesive unit | Product |

```json
{ "id": "react-best-practices", "type": "skill",  "source": "gist:abc123", "used_in_flows": 4, "tags": ["react", "frontend"] }
{ "id": "senior-react-reviewer","type": "prompt", "source": "gist:bcd234", "used_in_flows": 2, "tags": ["react", "code-review"] }
{ "id": "react-review-flow",    "type": "flow",   "source": "gist:def456", "orchestration": "staged", "roles": 2,
  "uses_skills": ["react-best-practices"], "uses_prompts": ["senior-react-reviewer"] }
```

`used_in_flows` is the primary quality signal for components — it requires no social infrastructure and captures actual reuse value. The `build-index.js` Action computes it by scanning all `flow` entries for `uses_skills` and `uses_prompts` references and back-populating the count. A skill used in 12 flows is more battle-tested than one used in 1. This is a better quality signal than stars for components specifically.

**Why prompts deserve their own type (not just "agent files"):**

A prompt like "senior React reviewer: approach code review with an emphasis on performance and hook correctness, be terse and direct" is reusable across a code-review flow, a PR-review flow, and a refactoring flow. An author who crafts a good role definition should be able to publish it independently and have other flow authors reference it. The current `agent:` field in `.flow.yaml` names a local file — a catalog `prompt` entry makes that file findable across repos.

**Browse UX — components default-off, opt-in:**

```
@flow /browse react
  → returns flows tagged "react" (type: flow is default)

@flow /browse react --skills
  → returns skills tagged "react"
  → each entry shows: "used in 4 flows  ·  install: @flow install gist:abc123"

@flow /browse react --prompts
  → returns prompt/agent definitions tagged "react"

@flow /browse react --all
  → returns all types, grouped: Flows (2)  Skills (3)  Prompts (1)
```

A skill entry in browse shows its `used_in_flows` count prominently and links to the flows that use it — a user browsing skills can follow the link to the flow and decide to install the whole package. This is the component-to-flow discovery path: user finds the ingredient → discovers the recipe.

**What standalone discovery does for the mission:**

Skills and prompts in the catalog without associated flows create ecosystem pressure in both directions:
- **Author side:** the `harness wrap` nudge and the "0 flows using this skill" signal in browse gives authors a visible reason to create orchestration patterns
- **User side:** a user who finds a useful skill via `@flow /browse --skills` and installs it is now one `harness wrap` away from having a flow — and they're in the `@flow` ecosystem already

The catalog is a **component library for flow composition**, not just a flow gallery. Treating it that way makes the ecosystem richer from day one without waiting for flow-wrapping adoption.

#### Security: repo-owned `catalog.json`

Since the Action writes `catalog.json` to the author's own repo and the harness index builder ingests from it, the risk surface is: malicious content in a community-contributed `catalog.json` getting into the index.

Mitigations:
- The `build-index.yml` runs a sanitization pass on all ingested catalog entries: strip HTML, validate URL formats, enforce schema
- `source:` URLs in ingested entries must resolve to the same GitHub account as the `sources.json` entry (no hijacking another repo's Gist)
- `_official/` entries still require manual review (existing model)
- Community entries that fail sanitization are logged and skipped with a warning — they don't block the build

#### Relationship between four publishing surfaces

All four surfaces operate on the same underlying operations — they differ only in trigger and user context:

| Surface | Trigger | Best for |
|---|---|---|
| `harness-publish-action` (GitHub Action) | Push to main | Existing repos, always-on sync, zero ongoing effort |
| `harness publish` (CLI) | Manual command | One-shot publishing, pre-commit, custom CI |
| `harness wrap` (CLI) | Manual command | Skill → flow conversion, requires author judgment |
| `@flow register` (VS Code) | In-editor command | Flow authors working in VS Code |

The Action is the zero-friction always-on path. The CLI handles cases that need author control (wrapping, custom bundling, manual registration). They share the same `gistApi.ts`, `bundle.ts`, and `catalog.ts` modules from the `@feima/harness` package.

#### Revised implementation additions

| Feature | Location | Priority |
|---|---|---|
| `feima/harness-publish-action` GitHub Action | New repo | P1 — lowest-friction path for existing skill repos |
| `sources.json` in `feima/flows-catalog` + fetch logic in `build-index.js` | Catalog repo | P1 — enables repo-owned catalog.json model |
| `type: "skill" \| "prompt" \| "flow" \| "harness"` in catalog schema | `catalog.json` schema + `index.json` | P1 — needed to surface all component types |
| Sanitization pass in `build-index.js` | Catalog repo | P1 — security requirement for remote catalog ingest |
| `register-source` command in `@feima/harness` CLI | CLI package | P2 — one-line PR to add repo to `sources.json` |
| `harness wrap` nudge output in Action | Action | P2 — the flywheel nudge for skills-only repos |

---

## Author Incentives: Getting Skill Authors to Publish and Transition to Flow Authoring

The skill author population is the most valuable acquisition target — they already have proven content, an existing audience, and distribution via `marketplace.json` or `skills.sh`. The challenge is twofold: getting them to publish into the harness index, and then getting a subset of them to become flow authors. Both require the right incentives, and incentives done wrong (gamification badges, point systems) are dismissed instantly by experienced open source authors.

The honest framing: skill authors are already respected in their communities without us. What we can uniquely offer is **visibility into downstream compositional reuse** — something neither `skills.sh` nor `marketplace.json` provides at all.

### What we uniquely offer vs. the existing ecosystem

| Signal | skills.sh | marketplace.json | Harness catalog |
|---|---|---|---|
| Someone installed your skill | ✗ no signal | Repo stars (coarse) | Opt-in install count |
| Someone built a flow using your skill | ✗ | ✗ | `used_in_flows` count |
| Someone forked a flow built on your skill | ✗ | ✗ | Fork lineage, visible in catalog |
| Your skill is credited in a live flow run | ✗ | ✗ | Attribution footer in `@flow` output |
| Which flows use your skill | ✗ | ✗ | Back-links in catalog entry |

Stars measure pre-install sentiment. `used_in_flows` measures actual compositional reuse — someone built something real on top of your work. That's a meaningfully different form of recognition, and it's one we can surface without any backend infrastructure (it's computed by `build-index.js` from the catalog graph).

### Acknowledgment mechanisms — no backend required

These all operate from catalog data and the `@flow` extension runtime:

**1. Attribution in flow run output**

When `@flow` executes a role that loads a skill or agent from the catalog, the run footer includes the attribution:

```
✓ Completed in 3 turns

  Powered by: levinunnink/react-best-practices · vercel/typescript-guidelines
  ⭐ Star · 🙏 Thank the authors · 🔀 Fork this flow
```

"Thank the authors" deep-links to the skill repo, not the flow repo. The skill author gets a GitHub visit and potentially a star — from a user who ran a flow they didn't write and may never have found the skill repo otherwise. **This is incremental reach that doesn't exist in any other model.**

**2. Back-links from flows to component authors**

Every flow entry in the catalog lists its component dependencies explicitly:

```
@flow /browse --flow react-review-flow

  React Code Review Flow  by levinunnink  ★ 47
  staged · 2 roles · context: active editor

  Uses:
    skill  react-best-practices  by levinunnink   (same author)
    prompt senior-react-reviewer  by vercel        ← vercel gets credited here
```

A flow author who builds on someone else's skill is advertising that skill author's work in their catalog entry. Every install of the flow is exposure for the skill author, with a direct link.

**3. Author profile view**

```
@flow /browse --author levinunnink

  levinunnink's contributions:

  Skills (3)          used in 12 flows total
  Prompts (1)         used in 4 flows
  Flows (2)           installed 340× (opt-in)

  react-best-practices    skill   used in 8 flows
  incident-triage         skill   used in 3 flows
  sql-query-optimizer     skill   used in 1 flow
  senior-react-reviewer   prompt  used in 4 flows
  react-review-flow       flow    ★ 47
  post-mortem             flow    ★ 23
```

This is a portfolio view — findable by other authors and users, linkable, shareable. For an active open source contributor, this is a meaningful artifact: it shows their work's footprint in the ecosystem, not just the star count on one repo.

**4. "Your skill powers this flow" notification (GitHub-native)**

When `build-index.js` detects that a new catalog entry references a skill for the first time — i.e., a new flow was published that depends on your skill — the CI job opens a GitHub Discussion or posts to a GitHub issue in the catalog repo tagged with the skill author's handle:

```
🎉 A new flow was published using your skill!

  "Incident War Room Triage" by @sre-tools/incident-triage
  uses: levinunnink/react-best-practices

  View: @flow install gist:abc123
```

No backend, no email system — GitHub notifications do the delivery. Opt-in (authors who don't want noise can ignore it). But for authors who care, this is a signal that their work propagated into something new.

### The skill-to-flow transition incentive

The most important transition moment: when a skill author sees that *someone else* wrapped their skill into a popular flow, the natural reaction is "I should have published the official version first." The catalog makes this visible. The friction to act on it is low (one `harness wrap` command). The combination is a natural pull — no manufactured incentive needed.

Two specific mechanisms accelerate this:

**The "unofficial flows using your skill" prompt in the GitHub Action:**

After each `build-index.js` run, if any flows by *other authors* reference your skill, the Action output includes:

```
📣 Your skill is being used by other flow authors:
   incident-war-room (by sre-tools)  ★ 34
   post-mortem-flow  (by acme-corp)  ★ 12

Your skills have no official flows yet.
Want to publish an authoritative version?
  npx @feima/harness wrap skills/react-best-practices/SKILL.md
```

This is shown in the author's own CI job — it's contextually relevant and non-spammy. It appears once per new flow that uses their skill, not repeatedly.

**"Claimed vs. unclaimed" skill flows:**

In browse results, a flow built on a skill by someone other than the skill author gets a subtle marker:

```
[community]  sre-tools/incident-triage    ★ 34   uses: levinunnink/react-best-practices
             ↑ no official flow from levinunnink yet
```

When the skill author publishes their own flow using their own skill, their entry displays instead:

```
[community]  levinunnink/react-review     ★ 47   uses: levinunnink/react-best-practices ✓ official
```

The `✓ official` mark is simply: flow author == skill author. No approval required, computed from catalog metadata. It's a small signal but meaningful — users will prefer the authoritative version, and skill authors know it.

### The co-authorship norm

Flows should normalize listing their skill dependencies in catalog entries — not as fine print but as prominent attribution. The `harness-publish-action` writes `uses_skills` and `uses_prompts` into `catalog.json` automatically from the flow YAML. This makes co-authorship credit automatic and visible: every flow author who uses your skill is effectively promoting you in their catalog entry.

This is the npm `dependencies` graph made social. It's not a new concept — but it's one neither `skills.sh` nor `marketplace.json` has implemented.

### What to avoid

- **Point systems / badges:** experienced open source authors find these condescending. `used_in_flows` is a real signal; "Gold Contributor Badge" is theater.
- **Email marketing disguised as "digest":** opt-in only, GitHub-native notifications only. No email list required to participate.
- **Gatekeeping as prestige:** don't create an `_official/` tier that requires approval and then use approval as the prestige mechanism. The catalog is open; prestige comes from actual usage.
- **Promising monetization before earning trust:** commercial progression should emerge from demonstrated value, not be promised upfront to attract publishers.

### The data layer gap: what git/Gist cannot provide

Before summarising, it is worth being explicit about which signals are genuinely catalog-computable and which ones we have been papering over with "no backend required" language.

| Signal | Can git/Gist provide it? | Why / why not |
|---|---|---|
| `used_in_flows` | **Yes** — catalog-computable | `build-index.js` scans all flow entries for `uses_skills` / `uses_prompts` and back-fills the count. The catalog graph contains all the information. |
| `✓ official` marker | **Yes** — catalog-computable | `flow.author == skill.author` is derivable from catalog metadata. No external data needed. |
| Fork lineage (forked from X) | **Yes** — GitHub API | Gist fork relationships are a public GitHub API call. `build-index.js` fetches them at index build time. |
| "Your skill powers a new flow" notification | **Yes** — CI-native | Catalog diff in `build-index.js` detects new `uses_skills` entries; GitHub Actions can post to a Discussion. |
| Gist star count | **Partial** — owner only | GitHub API returns Gist star counts only to the Gist owner, not publicly. We can fetch them from the author's own Action but cannot aggregate them centrally. |
| Install counts | **No** | Each `@flow install` is a client-side operation. No server observes it. Git/Gist have no install hook. |
| Run counts ("ran this flow 340×") | **No** | Flow execution is fully local in the VS Code extension. There is no server to record it. |
| Cross-repo back-link recency (real-time) | **Partial** | The catalog graph is only as fresh as the last `build-index.js` run. A flow published an hour ago won't appear in back-links until the next rebuild. Acceptable latency for most purposes. |

**The two genuine gaps are install counts and run counts.** Everything else — `used_in_flows`, `✓ official`, fork lineage, catalog notifications — is computable from data we already have or can fetch from public APIs.

#### Option A: accept proxy signals, no new infrastructure

Instead of install counts, surface the signals that are available:
- Gist fork count (public, from GitHub API) — a rough proxy for "people who engaged seriously enough to fork"
- `used_in_flows` — the strongest signal we have, and the most meaningful one for component authors
- Gist star count in the author's own catalog (the Action can fetch it and embed it at publish time)

**Verdict:** acceptable for Phase 1. The most important signal — `used_in_flows` — is real and available. Install counts are vanity unless you can act on them.

#### Option B: thin edge function for opt-in install telemetry

A Cloudflare Worker (or Vercel Edge Function) that accepts a `POST /install` ping from the extension when a user installs a flow/skill, keyed by catalog entry ID. Stores counts in Cloudflare KV or Vercel KV. The `build-index.js` job fetches counts and embeds them in `index.json` at rebuild time.

```
@flow install gist:abc123
  → extension installs files
  → if opt-in telemetry: POST https://telemetry.feima.dev/install { id: "levinunnink/war-room-triage" }
  → Cloudflare Worker increments KV counter
  → next index rebuild: build-index.js fetches counts, embeds in index.json
```

**Cost:** one Cloudflare Worker, one KV namespace. Effectively zero at low volume; ~$0.50/month at moderate volume. No database, no auth, no PII — just an ID and an increment.

**Privacy surface:** the ping carries the catalog entry ID only — no user identifier, no workspace info. Opt-in, consistent with the extension's existing telemetry model. GDPR-safe: no personal data, no IP logging.

**Verdict:** worth building in Phase 2 once the catalog has content. Not a prerequisite for launch.

#### Option C: use GitHub's own infrastructure as the data layer

Instead of a custom counter service, use GitHub Discussions on the catalog repo as the aggregation point. When a user installs a flow, the extension (opt-in) posts a "I installed this" reaction to a pinned Discussion thread for that entry. Discussion reaction counts are public, no backend needed.

**Problem:** this creates noise in the Discussion, requires GitHub authentication from the user for a side-effect of an install, and reaction counts aren't easily queryable by the index builder. Not recommended.

#### Decision: Option A for launch, Option B as a deliberate Phase 2 commitment

The incentive mechanisms that matter most in Phase 1 — `used_in_flows`, attribution, author profiles, fork lineage — are all catalog-computable and real. Install counts are a vanity metric until you have enough volume to act on them. Build the catalog graph first; add the thin telemetry layer when you have an audience.

When Option B is added, it should be surfaced as "installed N× (opt-in)" in browse, not as a star-equivalent ranking signal. It informs, it doesn't sort.

---

### Incentive summary (honest version)

| Mechanism | Author benefit | Infrastructure needed | Available in Phase 1? |
|---|---|---|---|
| `used_in_flows` count | Visible reuse signal, portfolio evidence | None — catalog graph | ✓ Yes |
| Attribution footer in `@flow` run output | Incremental reach beyond the skill repo | Extension change only | ✓ Yes |
| Author profile view (`--author`) | Linkable portfolio in the ecosystem | Extension + catalog schema | ✓ Yes |
| Back-links: flows → skill authors | Advertising effect for skill authors | Catalog schema only | ✓ Yes |
| Fork lineage in catalog | Community customization story | GitHub API at build time | ✓ Yes |
| `✓ official` marker | Status signal, user preference | Catalog metadata only | ✓ Yes |
| "Your skill powers a new flow" notification | Awareness of downstream adoption | `build-index.js` + GitHub Discussion | ✓ Yes |
| "Unofficial flows using your skill" prompt | Pull toward flow authoring | Action output change | ✓ Yes |
| Gist star count (via author's Action) | Familiar vanity metric | GitHub API from author's Action | ✓ Partial (owner-only fetch) |
| Install counts | Volume signal | Thin edge function (Cloudflare Worker) | ✗ Phase 2 |
| Run counts | Usage depth signal | Extension opt-in telemetry pipeline | ✗ Phase 2 |

---

## Extension Implementation: What Needs Building

| Feature | Location | Priority |
|---|---|---|
| `gist:` URI resolver | new `gistClient.ts` | P1 — needed for any Gist install |
| `github:` URI resolver | extend `flowLibrary.ts` | P1 — needed for repo install |
| Multi-file Gist installer with manifest | `flowLibrary.ts` | P1 |
| `index.json` fetch + cache in `/browse` | `flowLibrary.ts` | P1 |
| Trust tier badge in `/browse` output | `flowParticipant.ts` | P1 |
| `@flow register` command | `flowParticipant.ts` + `gistClient.ts` | P2 |
| Post-run feedback footer | `flowParticipant.ts` | P2 |
| `.github/copilot-ai-flow.json` config resolution | `flowService.ts` | P2 |
| Prompt injection heuristic in register | `flowService.ts` | P2 |
| `additionalCatalogs` user setting | `package.json` + `flowLibrary.ts` | P3 |

**Catalog repo:**

| Artifact | Notes |
|---|---|
| `catalogs/` directory structure | Reserve now, document convention |
| `scripts/build-index.js` | Merges catalog files, fetches star counts |
| `.github/workflows/build-index.yml` | Triggers on `catalogs/**` changes |
| `catalog.json` JSON Schema | For validation bot and author tooling |
| Registration PR template | Pre-fills new catalog entry |

---

## The Marketplace Lens: Industry Convergence and Strategic Positioning

### What Claude Code and GitHub Copilot CLI just told us

As of 2025–2026, both major AI CLI tools have converged on the same distribution format:

| Platform | Marketplace file | Default directory | Also supports |
|---|---|---|---|
| Claude Code | `marketplace.json` | `.claude-plugin/` | npm, git-subdir, version channels, `strictKnownMarketplaces` |
| GitHub Copilot CLI | `marketplace.json` | `.github/plugin/` | `.claude-plugin/` (explicit fallback) |

GitHub Copilot explicitly notes that it looks in `.claude-plugin/` as a fallback — the same directory Claude Code uses. This is not a coincidence. `marketplace.json` is the emerging standard for AI harness distribution. **A single repo with `.claude-plugin/marketplace.json` is installable from both platforms today.**

Neither platform has flows. Both have: skills, agents, hooks, MCP servers. Flows are the orchestration layer that neither has built — and that is the gap this project fills.

---

### The fundamental distinction: distribution vs. discovery

The two problems are separate and require separate solutions:

| Layer | Format | Question answered |
|---|---|---|
| **Distribution** | `marketplace.json` | "How do I package and ship this?" |
| **Discovery** | `catalog.json` / `index.json` | "How do I find what exists?" |

The previous design conflated them. `catalog.json` was trying to serve both. The right move: use `marketplace.json` for distribution (ride the ecosystem) and keep `catalog.json` / `index.json` as the search/discovery layer on top.

---

### The harness repo reframe

The repo is not a flow catalog. It is a **harness marketplace** — the full set of components that give an AI model its operational context and capabilities:

```
feima/harness/
  .claude-plugin/
    marketplace.json          ← installable via `claude plugin marketplace add feima/harness`
                                and `copilot plugin marketplace add feima/harness`
  plugins/
    war-room-triage/
      .claude-plugin/
        plugin.json
      flows/
        war-room-triage.flow.yaml   ← @flow reads this; Claude Code/Copilot ignore it
      agents/
        incident-commander.agent.md
      skills/
        incident-triage/
          SKILL.md
    post-mortem-suite/
      .claude-plugin/
        plugin.json
      flows/
        post-mortem.flow.yaml
      agents/
        ...
  catalogs/
    _official/
      catalog.json            ← discovery metadata for @flow /browse
    community/
      ...
  index.json                  ← auto-built, @flow fetches only this
```

The `marketplace.json` at the root makes the entire repo a first-class plugin marketplace for both Claude Code and Copilot CLI. Each plugin directory contains its own `plugin.json` (for those platforms) plus a `.flow.yaml` (for `@flow`). **The `.flow.yaml` is just an extra file in the package — the two platforms don't know about it and don't conflict with it.**

---

### Flows as a plugin component type

Claude Code's `marketplace.json` plugin entry schema allows `commands`, `agents`, `skills`, `hooks`, `mcpServers` — but not `flows`. That's fine: flows travel as files inside the plugin directory, and `@flow` reads them from there after installation.

When a user installs `war-room-triage@feima-harness` via `claude plugin marketplace add`:
1. Claude Code installs the plugin to `~/.claude/plugins/cache/`
2. The agents and skills become available in Claude Code natively
3. `@flow` discovers the `.flow.yaml` in the same cached directory and registers it

The harness is installed once, used by all tools. The flow is the orchestration layer that `@flow` adds on top of the native harness.

For `@flow install gist:abc123`, the Gist path still works for simple single-file flows with no companions. The two distribution paths are complementary:

| Complexity | Distribution unit | Install command |
|---|---|---|
| Single flow, no companions | Single-file Gist | `@flow install gist:abc123` |
| Flow + companions, standalone | Multi-file Gist | `@flow install gist:abc123` |
| Flow + companions, shared components | Plugin in `marketplace.json` repo | `@flow install pkg:feima-harness/war-room-triage` |
| Team harness library | Private `marketplace.json` repo | `@flow install pkg:acme/harness/triage` |

---

### Why not adopt `marketplace.json` directly (without our own catalog layer)?

`marketplace.json` solves distribution, not discovery. Its `keywords` and `category` fields are flat text — no flow-specific metadata like orchestration type, number of roles, staged vs. sequential. The `@flow /browse` experience requires structured search that `marketplace.json` doesn't support.

More importantly: `marketplace.json` has no concept of rating, forking as customization, or community trust tiers. The catalog layer provides all of that.

**The answer is not "adopt plugins pattern OR go our own way." The answer is: be `marketplace.json`-compatible at the distribution layer, and own the discovery/catalog layer.**

---

### Team harness via `.claude/settings.json`

Claude Code already supports `extraKnownMarketplaces` in `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "acme-harness": {
      "source": {
        "source": "github",
        "repo": "acme-corp/ai-harness"
      }
    }
  },
  "enabledPlugins": {
    "incident-triage@acme-harness": true,
    "post-mortem@acme-harness": true
  }
}
```

Commit this to `.claude/settings.json` in a repo and every team member who opens the project gets the harness with zero personal configuration. This supersedes the proposed `.github/copilot-ai-flow.json` config for Claude Code users. For Copilot CLI users, the equivalent is the same file pattern.

The `@flow` extension should read `extraKnownMarketplaces` from `.claude/settings.json` alongside (or instead of) `.github/copilot-ai-flow.json`, so the team harness config is unified in one file.

---

### The third path: universal CLI via `npx skills` / `skills.sh`

A third distribution pattern has emerged alongside the two platform-native marketplaces: **`skills.sh`** (also `agentskills.io`) — a universal installer that deploys to every AI tool at once from a single command.

```bash
npx skills add vercel-labs/agent-skills
npx skills add vercel-labs/agent-skills --skill react-best-practices
```

Vercel's official skills repo has 27k+ stars and just shipped `skills.sh.json` support. The pattern is gaining fast adoption as the **cross-platform skills layer**.

**How it works:**

- `npx skills add owner/repo` reads the repo's `skills.sh.json` manifest, then copies the relevant `SKILL.md` files to every AI tool the user has installed
- Claude Code target: `~/.claude/skills/{name}/SKILL.md`
- Other tools: their equivalent skills directories
- **One command, all tools** — zero per-tool configuration

**`skills.sh.json` manifest** — lives at repo root, used for discovery and grouping on `skills.sh`:

```json
{
  "$schema": "https://skills.sh/schemas/skills.sh.schema.json",
  "groupings": [
    {
      "title": "Incident Response",
      "description": "Skills for triaging and resolving production incidents.",
      "skills": ["incident-triage", "post-mortem", "runbook-executor"]
    }
  ]
}
```

**Scope:** `skills.sh` handles only `SKILL.md` files — no agents, no hooks, no MCP servers, no flows. It is the universal path for knowledge/instruction assets only.

---

### The three-path landscape

| Path | Install command | Scope | Discovery | Cross-tool? |
|---|---|---|---|---|
| **Platform-native** (`marketplace.json`) | `claude plugin marketplace add owner/repo` | skills, agents, hooks, MCP, LSP | Per-tool | No (tool-specific) |
| **Universal CLI** (`skills.sh`) | `npx skills add owner/repo` | skills only (SKILL.md) | `skills.sh` website | Yes — all AI tools |
| **Custom catalog** (`catalog.json`) | `@flow install gist:` / `pkg:` | flows + full harness | `index.json` + `@flow /browse` | Via `@flow` |

The three paths are complementary, not competing. A well-structured harness repo should be all three at once.

---

### The harness repo as a multi-distribution-path package

```
feima/harness/
  .claude-plugin/
    marketplace.json          ← Path 1: platform-native install for Claude Code + Copilot CLI
  skills.sh.json              ← Path 2: universal `npx skills add feima/harness`
  skills/
    incident-triage/
      SKILL.md                ← Lives here, shared by all three paths
    post-mortem/
      SKILL.md
  plugins/
    war-room-triage/
      .claude-plugin/
        plugin.json           ← Registers agents + hooks + skills for Path 1
      flows/
        war-room-triage.flow.yaml  ← Path 3 only: @flow reads this
      agents/
        incident-commander.agent.md
  catalogs/
    _official/
      catalog.json            ← Path 3: discovery metadata for @flow /browse
  index.json                  ← Path 3: auto-built, @flow fetches only this
```

`marketplace.json` points skill entries at `skills/incident-triage/` — the same directory `npx skills add` installs from. The skills are defined once and served by all three paths. The flow YAML and agent files are extras that only Path 3 (`@flow`) knows about.

**What this means for adoption:** the `marketplace.json` and `skills.sh.json` compatibility are **acquisition channels** — they lower the barrier for users coming from those ecosystems to encounter the harness. But the destination is `@flow`. A team that only uses `npx skills add` is getting commodity skill files. The harness repo exists to build an ecosystem *around* the orchestration runtime, not the other way around.

---

### What changes in the implementation plan

| Previous assumption | Revised |
|---|---|
| Catalog repo holds `catalog.json` files indexed into `index.json` | Still true — but repo also ships `marketplace.json` + `skills.sh.json` at root |
| `gist:` and `github:` are the only URI schemes | Add `pkg:` scheme: `pkg:{marketplace}/{plugin}` for installed plugins |
| Distribution unit is a Gist or raw repo | Distribution unit is a multi-path package (all three formats) |
| Custom `index.json` is the only install path | `marketplace.json` and `skills.sh` paths added alongside |
| `.github/copilot-ai-flow.json` for team config | Defer to `.claude/settings.json` `extraKnownMarketplaces` where possible |
| Skills defined inside plugin directories | Skills live at top-level `skills/` shared across all paths |

**Implementation additions:**

| Feature | Location | Priority |
|---|---|---|
| `marketplace.json` reader for installed plugins | `flowLibrary.ts` | P1 — unlocks ecosystem compatibility |
| `pkg:` URI resolver (reads from `~/.claude/plugins/cache/`) | `flowLibrary.ts` | P1 |
| Harness repo structure + `marketplace.json` + `skills.sh.json` templates | new `harness-repo/` scaffold | P1 |
| `skills.sh.json` generator (auto-built alongside `index.json`) | `scripts/build-index.js` | P2 |
| `.claude/settings.json` `extraKnownMarketplaces` reader | `flowService.ts` | P2 |
| Flow component type in `plugin.json` (proposal to Claude Code) | External engagement | P3 |
