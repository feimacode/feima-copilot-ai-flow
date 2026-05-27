# Flow Catalog Ecosystem

Architecture and design decisions for flow distribution, discovery, and community infrastructure.

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
