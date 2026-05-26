# Flow Library Backlog

Ranked by: killer demo potential × daily usage frequency × gap vs single-prompt × audience breadth × build simplicity.

---

## P1 — Build First

These are the flows that will drive adoption. High frequency, large gap over single-prompt, broad audience, demonstrable in a short video.

### 1. Code Review
**Roles (sequence):** Reviewer — Logic & Correctness → Reviewer — Style & Security → Verdict  
**Gap:** A generalist model doing code review conflates style with correctness and rarely escalates security findings separately. Three focused lenses produce a cleaner, actionable review.  
**Audience:** Every developer, every day.  
**Demo hook:** Run it on a real PR diff. The security reviewer catches something the other two miss.

### 2. Scrum Story Estimation
**Roles (sequence):** Complexity Analyst → Risk & Unknowns Identifier → Dependency Mapper → Estimator + Splitter  
**Gap:** Single-prompt estimation is anchoring-prone and skips unknowns. The Dependency Mapper role is the differentiator — it surfaces blockers that nobody asks about explicitly.  
**Audience:** Any team running sprints.  
**Demo hook:** Feed it a vague story. The Dependency Mapper asks questions that reveal it should be two stories.

### 3. Backlog Ranking
**Roles (sequence):** Business Value Analyst → Technical Risk & Debt Analyst → Dependency Mapper → Effort/Impact Ranker → Synthesizer  
**Gap:** Single-prompt ranking collapses everything into one dimension (usually "most impactful") and systematically underweights dependencies and technical debt. The Dependency Mapper role is the differentiator — a boring infrastructure story that unblocks three others ranks higher than a high-value story that can't start yet. The Synthesizer produces a numbered list with a one-line rationale per item, which is the artifact that makes grooming meetings shorter.  
**Pairs with:** Story Estimation (P1-2). Estimation sizes individual items; Ranking orders the set. The two flows together cover the full sprint planning loop.  
**Audience:** Any team running sprints.  
**Demo hook:** Feed it a mixed backlog of 8 stories. The Dependency Mapper reorders the obvious top pick to #4 because three prerequisite tasks were buried in the list.

### 4. War-Room Triage
**Roles (staged):** Stage 1 — Incident Commander, Recent Changes Analyst, Application Layer, Infrastructure Layer, Data Layer → Stage 2 — Customer Communication  
**Gap:** In real incidents the HiPPO effect dominates; everyone investigates the most senior person's hypothesis. Independent parallel analysis produces a ranked differential diagnosis before the arguing starts. The Recent Changes Analyst role is the standout — nobody does this systematically under pressure.  
**Audience:** Any team running production services. High-stakes, high-sharability.  
**Demo hook:** Paste an ambiguous alert + logs. The Recent Changes Analyst identifies a deployment from 3 hours ago that the other roles then confirm as the cause.  
**Design note:** Role prompts must explicitly ask for the right evidence (slow query log, change log, pod restarts) — this doubles as an incident checklist.

### 5. PR Description Generator
**Roles (sequence):** Code Historian (what changed and why) → Impact Assessor (what can break, who's affected) → PR Writer (composes the description)  
**Gap:** Developers write PR descriptions under time pressure and omit context that reviewers need. The Code Historian role reads the diff with intent-first framing, not change-first.  
**Audience:** Every developer, every PR.  
**Demo hook:** Feed it a large refactor diff. The Impact Assessor flags a subtle breaking change the author missed.

### 6. Test Writing
**Roles (sequence):** Test Designer (identifies cases, edge cases, failure modes) → Test Writer (implements) → Edge Case Hunter (challenges coverage, proposes adversarial inputs)  
**Gap:** Single-prompt test generation produces happy-path tests with one or two edge cases. The Edge Case Hunter as a separate adversarial role consistently produces tests the first pass misses.  
**Audience:** Every developer.  
**Demo hook:** Feed it a function with subtle null-handling. Edge Case Hunter finds the case that crashes it.

---

## P2 — High Value, Build After P1

Strong use cases with slightly narrower audience or higher build complexity.

### 7. API Design Review
**Roles (sequence):** Consumer Perspective (usability, naming, discoverability) → Implementer Perspective (feasibility, constraints, edge cases) → Security & Contracts (auth, input validation, versioning)  
**Gap:** API design reviews done by single-prompt tend to be optimistic. The Consumer and Implementer perspectives actively disagree with each other, which surfaces tradeoffs explicitly.  
**Audience:** Backend developers, API platform teams.

### 8. Root Cause Analysis / Debugging
**Roles (sequence):** Symptoms Analyst (what do the logs/errors actually say) → Code Path Tracer (follows the execution path to the fault) → Hypothesis Ranker (orders hypotheses by evidence weight, proposes the minimum reproduction)  
**Gap:** Debugging with a single prompt produces one hypothesis. Hypothesis Ranker as a distinct role produces a ranked list with evidence for each — much closer to how a good debugger actually thinks.  
**Audience:** All developers. Note: partially overlaps with War-Room Triage for production issues.

### 9. ADR Writer
**Roles (sequence):** Context Researcher (current state, why a decision is needed) → Options Proposer (3 alternatives with tradeoffs) → Consequences Analyst (what each option locks in or forecloses) → Decision Recorder (synthesizes into ADR format)  
**Gap:** ADRs written by one person tend to under-represent the alternatives that were rejected. The Options Proposer role is forced to generate real alternatives, not strawmen.  
**Audience:** Tech leads, architects, teams that write ADRs.

### 10. Incident Post-Mortem
**Roles (sequence):** Timeline Reconstructor → Impact Assessor → Contributing Factors Analyst (not root causes — systemic factors) → Action Item Generator  
**Gap from War-Room Triage:** War-Room is live triage under pressure. Post-Mortem is retrospective — the Contributing Factors role explicitly avoids single root cause framing (five-whys done properly), which single-prompt post-mortems almost never do.  
**Audience:** SRE, platform, any team with an incident culture.

### 11. Refactoring Planning
**Roles (sequence):** Current State Documenter (what does this code actually do, what invariants does it maintain) → Problem Identifier (why it's problematic: coupling, duplication, unclear intent) → Refactoring Proposer (specific steps, preserving behavior) → Risk Assessor (what can go wrong, what tests are needed)  
**Gap:** Single-prompt refactoring plans skip the "what does this code actually do" step and propose changes that violate hidden invariants.  
**Audience:** Developers working in legacy or complex codebases.

### 12. Documentation Writer
**Roles (sequence):** Audience Analyst (who reads this, what do they need to know first) → Structure Designer (outline, information hierarchy) → Content Writer → Accuracy Reviewer (challenges assumptions, identifies gaps)  
**Gap:** Single-prompt documentation writes for the author, not the reader. The Audience Analyst role inverts that.  
**Audience:** All developers, technical writers.

---

## P3 — Narrower Audience or Complex Implementation

Build after P1 and P2 are proven.

### 13. Config Review
**Roles (sequence):** Security Lens (secrets, exposed ports, permissions) → Correctness Lens (type mismatches, missing required fields, defaults that will cause issues) → Environment Parity Lens (does staging match production)  
**Audience:** DevOps, platform, security-focused teams. More org-specific than other flows.

### 14. Stakeholder Challenge Panel
**Roles (sequence):** Technical Skeptic → Business Skeptic → End User Advocate → Synthesizer  
**Gap:** Strongest for proposals/pitches that need stress-testing before they're presented. The "Synthesizer" role that reconciles the objections is the differentiator.  
**Audience:** Broad but use case is episodic (before a proposal). Excellent for executive-facing demos; lower daily frequency for individual developers.

### 15. Parallel UI Prototyping
**Roles (CLI/parallel):** Component Designer A (variant 1) → Component Designer B (variant 2) → Reviewer (compares tradeoffs)  
**Requires:** CLI orchestration mode for true parallelism. Sequencing two variants through the LM API is still useful but loses the independent-generation property.  
**Audience:** Frontend developers. Build after CLI mode is polished.

---

## Build Order Summary

| Priority | Flow | Mode | Roles |
|---|---|---|---|
| P1-1 | Code Review | sequence | 3 |
| P1-2 | Story Estimation | sequence | 4 |
| P1-3 | Backlog Ranking | sequence | 5 |
| P1-4 | War-Room Triage | staged | 5+1 |
| P1-5 | PR Description Generator | sequence | 3 |
| P1-6 | Test Writing | sequence | 3 |
| P2-7 | API Design Review | sequence | 3 |
| P2-8 | Root Cause Analysis | sequence | 3 |
| P2-9 | ADR Writer | sequence | 4 |
| P2-10 | Incident Post-Mortem | sequence | 4 |
| P2-11 | Refactoring Planning | sequence | 4 |
| P2-12 | Documentation Writer | sequence | 4 |
| P3-13 | Config Review | sequence | 3 |
| P3-14 | Stakeholder Challenge Panel | sequence | 4 |
| P3-15 | Parallel UI Prototyping | CLI/parallel | 3 |
