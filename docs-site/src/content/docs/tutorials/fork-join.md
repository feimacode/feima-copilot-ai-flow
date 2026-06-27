---
title: Fork-Join
description: Run independent perspectives in parallel and synthesise their outputs with a join role
---

## What You'll Build

A fork-join flow: **Technical** and **Business** analysts evaluate independently and simultaneously, then a **Synthesiser** combines both into one recommendation.

```
[Technical Analyst] ──┐
                      ├──→ [Synthesiser]
[Business Analyst] ───┘
```

## Step 1: Install and Open

```
@flow /install 03-fork-join-perspectives
```

Open `.github/flows/03-fork-join-perspectives.flow.yaml`. Notice the different structure:

<a href="vscode://feima.copilot-ai-flow/open?flow=03-fork-join-perspectives">🔧 Open in Editor</a>
<a href="vscode-insiders://feima.copilot-ai-flow/open?flow=03-fork-join-perspectives">🔧 Open in Insiders</a>

```yaml
groups:
  - name: "Technical Perspective"
    roles:
      - name: "Technical Analyst"
  - name: "Business Perspective"
    roles:
      - name: "Business Analyst"
join:
  name: "Synthesiser"
```

- **`groups:`** — two or more groups that run in **parallel**
- **`join:`** — a single role that reads ALL group outputs and synthesises them
- Each group can have multiple roles in a pipeline

## When Fork-Join Shines

Fork-join is ideal when perspectives are **truly independent**:

| Use Case | Groups |
|----------|--------|
| Technology decision | Technical eval + Business case + Security review |
| Incident response | App layer + Infrastructure + Data layer investigation |
| Design review | UX + Architecture + Accessibility |
| Bake-off | Approach A implementation + Approach B implementation → Compare |

**Don't use fork-join when** groups share dependencies. If Group B needs Group A's output to start, that's a pipeline.

## Step 2: Run in Parallel

```
@flow #file:.github/flows/03-fork-join-perspectives.flow.yaml

Should we rewrite our billing service in Go?
Current stack: Python/Django, 50k invoices/month, 3-person team
```

<a href="vscode://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F03-fork-join-perspectives.flow.yaml%0A%0AShould%20we%20rewrite%20our%20billing%20service%20in%20Go%3F%0ACurrent%20stack%3A%20Python%2FDjango%2C%2050k%20invoices%2Fmonth%2C%203-person%20team">🚀 Run in Copilot</a>
<a href="vscode-insiders://github.copilot-chat/chat?prompt=%40flow%20%23file%3A.github%2Fflows%2F03-fork-join-perspectives.flow.yaml%0A%0AShould%20we%20rewrite%20our%20billing%20service%20in%20Go%3F%0ACurrent%20stack%3A%20Python%2FDjango%2C%2050k%20invoices%2Fmonth%2C%203-person%20team">🚀 Run in Insiders</a>

<small>Or copy: `@flow #file:.github/flows/03-fork-join-perspectives.flow.yaml`</small>

<a href="../../assets/screenshots/fork-join.png" target="_blank" title="Click to enlarge"><img src="../../assets/screenshots/fork-join.png" alt="Fork-join execution with parallel groups and Synthesiser join" /></a>

Watch what happens:

1. **Technical Analyst** and **Business Analyst** run **simultaneously** — neither waits for the other
2. Both produce structured assessments with ratings and recommendations
3. **Synthesiser** reads both outputs, identifies agreements and conflicts, produces a unified go/no-go recommendation

## Decision Tree

```
Can roles start without each other's output?
  ├── Yes → Fork-Join (groups: + join:)
  └── No → Pipeline (roles:)
```

## What You Got

- Two independent analyses running in parallel
- A unified recommendation that reconciles conflicting perspectives
- Understanding of when fork-join is faster than pipeline

## Next Steps

Learn [context files](/tutorials/context-files/) — inject project documentation into your flows.
