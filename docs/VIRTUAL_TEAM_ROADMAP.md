# Virtual Team — Roadmap Concept

Status: **Early roadmap** — not yet in backlog. Architecture assessed, direction validated.  
Prerequisite: Flow library P1 flows shipped and in active use.

---

## The Concept

Extend the product from "run a flow" to "work with your virtual team." Users define a persistent
team — mission, members, tech stack, conventions — and that context is automatically available
in every flow run without re-explaining it each time.

The "one human + many virtual agents" model that is emerging in indie development and small teams
is the target use case. The indie dev building alone now has a DBA, a security reviewer, and an
incident commander available at zero latency. The 5-person startup team has coverage beyond their
headcount.

---

## Why It's a Natural Extension (Not Scope Creep)

Every primitive the virtual team concept requires already exists in the codebase:

| Team concept | Current primitive | Gap |
|---|---|---|
| Virtual team member | `.agent.md` file | None — already implemented |
| Member's expertise | `skills:` in flow | None — already implemented |
| Shared team context | `sharedContext:` / `contexts:` | Exists but is manually repeated in every flow |
| Persistent org knowledge | `contexts:` pointing to a file | Works but requires per-flow wiring |
| Team membership grouping | None | `team.yaml` needed |
| Org-level shared context | None | `org.yaml` needed |

The team layer adds **automatic context injection and membership grouping** — not a new execution
model. Flows remain the execution primitive. Teams provide the persistent context that flows
consume. The boundary must be maintained: the team layer has no execution logic and makes no
LLM calls.

---

## New File Structure

Everything lives in `.github/` alongside existing agents and flows:

```
.github/
  org.yaml                        ← org-level context, shared by all teams
  team/
    platform.team.yaml            ← team definition
    product.team.yaml
  agents/                         ← virtual team members (already exists)
    alex.agent.md
    sam.agent.md
    jordan.agent.md
  flows/                          ← team workflows (already exists)
    infrastructure-review.flow.yaml
    incident-triage.flow.yaml
  copilot-ai-flow.json            ← workspace config (catalog + team pointers)
```

### `org.yaml`

```yaml
name: Acme Corp
stack: [TypeScript, React, Node.js, PostgreSQL, AWS EKS]
conventions:
  - Conventional commits
  - Trunk-based development
  - Feature flags for all user-facing changes
teams: [platform, product, security]
```

### `team.yaml`

```yaml
name: Platform Engineering
mission: |
  We maintain CI/CD pipelines, Kubernetes infrastructure, and internal
  developer tooling. We optimize for reliability, DX, and cost efficiency.
stack: [Kubernetes, GitHub Actions, Terraform, Datadog]
members:
  - agent: alex           # .github/agents/alex.agent.md
  - agent: sam
  - agent: jordan
flows:
  - infrastructure-review
  - incident-triage
  - runbook-writer
```

---

## How It Changes Flow Behavior

### Before (today)

Every flow must manually declare context:

```yaml
name: infrastructure-review
sharedContext: |
  We use Kubernetes on GKE, GitHub Actions for CI, Terraform for infra.
  We follow trunk-based development and conventional commits.
roles:
  - name: Architect
    agent: alex
  - name: Security
    agent: jordan
```

### After (with team layer)

The flow is shorter; org and team context are injected automatically:

```yaml
name: infrastructure-review
team: platform              # resolves members and injects org + team context
roles:
  - name: Architect
    team_role: senior-engineer    # resolved from team membership
  - name: Security
    team_role: security-engineer  # resolved from team membership
```

Flows that reference a team adapt to whoever is in that team's membership. The same
`infrastructure-review` flow installed from the catalog works with different agents on
different teams' installations.

---

## Org Hierarchy

```
Org (org.yaml)
  ├─ Team: Platform Engineering
  │    ├─ Member: Alex  (senior-platform-engineer)
  │    ├─ Member: Sam   (devops-engineer)
  │    ├─ Member: Jordan (security-engineer)
  │    └─ Flows: infrastructure-review, incident-triage
  │
  ├─ Team: Product
  │    ├─ Member: Morgan (product-manager)
  │    └─ Flows: story-estimation, backlog-ranking, stakeholder-panel
  │
  └─ Team: Security
       ├─ Member: Casey  (security-engineer)
       └─ Flows: config-review, threat-model
```

For an indie developer, the whole org is one person with multiple teams representing
different domains of their work — "the DBA brain", "the product brain", "the security brain."
Each team knows the stack and mission without re-explanation.

---

## Onboarding Experience

`@flow setup-team` is the guided wizard that introduces the virtual team concept:

```
@flow setup-team

What is your team's mission?
> Platform engineering — CI/CD, Kubernetes, internal developer tooling

Setting up 4 virtual team members:

  Alex   — Senior Platform Engineer  (architecture, cost optimization)
  Sam    — DevOps Engineer           (pipelines, automation)
  Jordan — Security Engineer         (cloud security, compliance)
  Riley  — Developer Experience      (tooling, internal APIs)

Creating:
  .github/team/platform.team.yaml
  .github/agents/alex.agent.md
  .github/agents/sam.agent.md
  .github/agents/jordan.agent.md
  .github/agents/riley.agent.md

Suggested flows for platform teams:
  [Install: infrastructure-review]  [Install: incident-triage]  [Install: runbook-writer]
```

The suggested flows at the end close the loop — team setup leads directly to flow installation.
The two concepts are introduced together, reinforcing that teams do things through flows.

---

## Product Story

| Before | After |
|---|---|
| "Run a multi-role flow" | "Work with your virtual team" |
| Cold context on every run | Team knows your stack and conventions persistently |
| Flows are one-off tools | Team members accumulate configuration over time |
| Discovery is "find a flow" | Onboarding is "set up your team, flows follow" |
| You repeat your stack in every flow | Org and team context are injected automatically |

---

## Executive Selling Points

**The talent scarcity argument:** Senior engineers are expensive, scarce, and leave. A virtual
team member codifies their judgment once and scales it to 10 junior developers indefinitely.
Agent files are version-controlled institutional knowledge.

**The consistency argument:** Human reviewers vary by day of week and energy level. Virtual
team members apply the same standard at 2am on Saturday as at 10am on Tuesday. In regulated
industries this is a compliance property.

**The decision latency argument:** Getting the right expert "in the room" has a coordination
cost that compounds across every sprint. Virtual team members have zero availability latency.

**The moat argument:** The longer a team uses the product, the more their agent files reflect
their specific stack, conventions, and decisions. Institutional knowledge accumulates in files
that don't transfer to a competing tool. Switching cost grows over time.

---

## Commercial Progression

```
Free                              Paid (future)
  │                                 │
  ├─ 1 org, 1 team, up to 5 members ├─ Pro: multiple teams, org context, analytics
  ├─ Public catalog flows           ├─ Enterprise: SSO, agent policy, audit logs
  └─ .github/copilot-ai-flow.json   └─ Managed hosting (no self-setup required)
```

"Your virtual team" is a more natural pricing story than "catalog hosting." People understand
paying for their team; they resist paying for infrastructure.

---

## The Boundary to Protect

The team layer must remain **metadata and context** — it must never grow execution logic.

**Safe:** team.yaml injects org/team context into flows, resolves `team_role:` references to
specific agent files, suggests relevant flows.

**Dangerous:** `@team ask a question` that bypasses flows and calls agents directly (creates a
competing execution model), team state that mutates during flow runs, team management UI that
lives outside the file system.

Signal to watch: if team management needs features that flows don't need, they are diverging
into a separate product.

---

## Naming Evolution Path

Today `@flow` handles both execution and setup. As the team concept matures, the participant
should split:

| Phase | Surface | When |
|---|---|---|
| Now | `@flow setup-team`, `@flow run` — one participant | Ship with current `@flow` |
| Growth | `@team setup`, `@team add-member` — dedicated participant, `@flow` stays execution-only | When team management commands exceed ~4 |

The split is a surface refactor, not an architecture change. The underlying primitives — agent
files, context injection, flow YAML — remain shared across both participants.

---

## High-Level Implementation Areas

Not yet broken into tasks. These are the areas that need design and implementation when this
moves to the backlog:

- `org.yaml` and `team.yaml` schema definition
- Workspace config resolution — detect and parse org/team files on startup
- Automatic context injection — inject org + team context into every flow run without manual
  `contexts:` wiring in each flow
- `team_role:` resolution in flow YAML — map generic role names to specific agent files via
  team membership
- `@flow setup-team` wizard — guided agent + team file creation + flow suggestion
- `@flow team status` command — show current team structure and associated flows
- Catalog integration — flows in the catalog can declare `suggested_for:` team roles, enabling
  the setup wizard to recommend them automatically
