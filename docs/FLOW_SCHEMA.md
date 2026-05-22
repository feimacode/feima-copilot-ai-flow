# Flow File Format Specification

## Overview

Flow files (`.flow.yaml`) define multi-perspective AI discussions with configurable expert roles. This document describes the complete YAML schema and provides examples for different use cases.

## File Structure

```yaml
# Required metadata
name: Flow Name
orchestration: sequence | cli
roles:
  - name: Role Name
    prompt: |
      Role instructions

# Optional shared context (rawBody — appended after YAML)
```

## YAML Schema

### Required Properties

#### `name` (string)
Display name for the flow.

```yaml
name: "Code Review Discussion"
```

#### `orchestration` (string)
How roles should interact. Two modes:
- `sequence`: Sequential execution via language model API
- `cli`: SDK/CLI delegation with background agent support

```yaml
orchestration: sequence
```

#### `roles` (array)
Array of role definitions. Minimum 2 roles, maximum 10.

> **Note**: `roles` is for simple flat flows. For multi-stage workflows with iteration, use `stages` instead (see below). A flow must have either `stages` or at least 2 top-level `roles` — not both.

```yaml
roles:
  - name: "Senior Developer"
    prompt: |
      You are an experienced senior developer...
  - name: "Security Expert"
    prompt: |
      You are a security specialist...
```

Each role has:
- `name` (string, required): Display name
- `prompt` (string, required): Instructions defining the role's perspective
- `model` (string, optional): Override flow-level model for this specific role
- `skills` (array, optional): Skills injected into this role's system prompt (see `skills` section)

#### `stages` (array)
Stage-based execution. Each stage runs its sub-flow for up to `iterations` rounds before the next stage starts. Cross-stage context accumulates automatically — later stages see all prior output.

```yaml
stages:
  - name: "Requirements Gathering"
    subFlow: research-edit-review
    iterations: 3
    skills:
      - domain-knowledge       # skill name — resolved via platform or workspace
    roles:
      - name: "Researcher"
        prompt: |
          You are a researcher. Gather and summarise relevant context.
      - name: "Editor"
        prompt: |
          You are an editor. Refine and structure the researcher's output.
      - name: "Critic"
        prompt: |
          You are a critic. Evaluate quality and completeness.
          When satisfied, append exactly: <!-- flow:done -->

  - name: "Architecture Design"
    subFlow: sequence
    iterations: 1
    roles:
      - name: "Architect"
        prompt: |
          Design the system based on requirements gathered above.
      - name: "Reviewer"
        prompt: |
          Review the architecture for gaps and risks.
```

Each stage has:
- `name` (string, required): Display name shown in the chat stream
- `subFlow` (string, required): Execution pattern — `sequence`, `research-edit-review`, or `plan-execute-test-fix`
- `iterations` (number, required): Maximum number of iterations (≥ 1). Exits early when last role emits `<!-- flow:done -->`
- `roles` (array, required): Roles that participate (minimum 1)
- `skills` (array, optional): Skills merged with flow-level skills and injected into every role in this stage

##### Sub-flow patterns

| Pattern | Intended role order | Convergence signal |
|---------|--------------------|-----------------------|
| `sequence` | Any order, no iteration semantics | N/A |
| `research-edit-review` | Researcher → Editor → Critic | Critic emits `<!-- flow:done -->` |
| `plan-execute-test-fix` | Planner → Executor → Tester (→ Fixer) | Tester emits `<!-- flow:done -->` |

The sub-flow pattern is a **convention** — it does not constrain role names. The system only checks whether the last role's output contains `<!-- flow:done -->` to decide whether to iterate again.

##### Convergence sentinel

When `iterations > 1`, the last role in the sub-flow should emit `<!-- flow:done -->` (an HTML comment, invisible in rendered markdown) to signal that further iterations are unnecessary:

```
After reviewing all criteria, the output meets the required standard.
<!-- flow:done -->
```

Without the sentinel, the stage always runs for the full `iterations` count.

### Optional Metadata

#### `description` (string)
Brief description of the flow's purpose.

```yaml
description: "Multi-perspective code review focusing on security, performance, and maintainability"
```

#### `category` (string)
Grouping for library organization.

```yaml
category: "software-development"
```

Common categories:
- `software-development`
- `business`
- `creative`
- `education`
- `design`
- `operations`

#### `subcategory` (string)
Further categorization within a category.

```yaml
subcategory: "code-quality"
```

#### `tags` (array of strings)
Keywords for searching and filtering.

```yaml
tags: ["code-review", "quality", "security", "performance"]
```

#### `difficulty` (string)
Complexity level: `beginner`, `intermediate`, or `advanced`.

```yaml
difficulty: intermediate
```

#### `version` (string)
Semantic version of the flow definition.

```yaml
version: "1.0.0"
```

#### `author` (string)
Creator attribution.

```yaml
author: "IX"
```

### Tool Configuration

#### `tools` (array of strings)
Global tools available to all roles (sequence mode only).

```yaml
tools:
  - copilot_readFile
  - copilot_listDirectory
  - copilot_createFile
  - copilot_replaceString
```

Use wildcard `['*']` to include all available tools:

```yaml
tools: ['*']
```

#### `skills` (array)
Skills to inject into role system prompts. Skills are resolved at execution time and their content is appended to the system prompt under an **Applicable Skills** heading.

Skills can be declared at three levels and are merged together:
1. **Flow level** — applied to every role in every stage
2. **Stage level** — applied to every role in that stage
3. **Role level** — applied only to that role

```yaml
# Flow-level: affects all roles
skills:
  - typescript-conventions      # bare name: resolved via platform API or workspace paths
  - path: .agents/skills/my-skill/SKILL.md  # explicit path relative to this flow file

stages:
  - name: "Security Review"
    skills:
      - owasp-top10             # stage-level: merged with flow-level
    roles:
      - name: "Reviewer"
        skills:
          - secure-coding       # role-level: merged with flow + stage skills
        prompt: |
          Review for vulnerabilities.
```

##### Skill resolution order (for bare names)

1. `vscode.chat.getSkills()` — platform API (workspace, user, extension-provided)
2. `{workspaceRoot}/.agents/skills/{name}/SKILL.md`
3. `{workspaceRoot}/.github/skills/{name}/SKILL.md`

Unresolved skills emit a warning and are silently skipped — they do not cause errors.

> **IntelliSense**: When editing `*.flow.yaml` files, type `- ` under a `skills:` key to get completion suggestions populated from `vscode.chat.getSkills()`.

### CLI-Specific Properties

These properties are **only valid** when `orchestration: cli`:

#### `isolation` (string)
Where changes are applied:
- `workspace`: Direct changes to active workspace (default)
- `worktree`: Isolated Git worktree for safe experimentation

```yaml
orchestration: cli
isolation: worktree
```

#### `cliMode` (string)
Permission and interaction mode:
- `supervised`: Interactive approval for tool calls (default)
- `autonomous`: Auto-execute with minimal confirmation

```yaml
orchestration: cli
cliMode: supervised
```

#### `model` (string)
Flow-level model selection. Available models:
- `claude-sonnet-4.5` (default)
- `claude-haiku-4.5`
- `claude-opus-4.5`
- `gpt-5`
- `gpt-5.1`

```yaml
orchestration: cli
model: "claude-sonnet-4.5"
```

#### `customAgent` (string)
Agent identifier for specialized behavior.

```yaml
orchestration: cli
customAgent: "code-review"
```

Built-in agents:
- `___vscode_default___`: Default agent
- `code-review`: Code review specialist
- `test-writer`: Test generation specialist

## Complete Examples

### Example 1: Sequential Code Review (API Mode)

```yaml
name: "Code Review Discussion"
description: "Multi-perspective code review with security, performance, and maintainability focus"
category: "software-development"
orchestration: sequence
difficulty: intermediate
tags: ["code-review", "quality", "security", "performance"]
tools:
  - copilot_readFile
  - copilot_findTextInFiles
roles:
  - name: "Senior Developer"
    prompt: |
      You are an experienced senior developer with 10+ years of experience.
      Review code for:
      - Overall architecture and design patterns
      - Code organization and modularity
      - Best practices and idioms
      - Readability and maintainability
  - name: "Security Reviewer"
    prompt: |
      You are a security expert specializing in application security.
      Review code for:
      - Common vulnerabilities (OWASP Top 10)
      - Input validation and sanitization
      - Authentication and authorization
      - Data protection and encryption
  - name: "Performance Engineer"
    prompt: |
      You are a performance optimization specialist.
      Review code for:
      - Algorithmic complexity
      - Memory usage and leaks
      - Database query optimization
      - Caching strategies

---
# rawBody (shared context, appended below the YAML)

# Code Review Guidelines

## Review Process
1. Analyze the provided code snippet or file
2. Identify specific issues with line numbers
3. Suggest concrete improvements
4. Prioritize findings by severity

## Output Format
- **Critical**: Must be fixed before merging
- **Important**: Should be addressed soon
- **Minor**: Nice-to-have improvements
```

### Example 2: CLI Background Agent (Supervised Mode)

```yaml
name: "Unit Test Generator"
description: "Autonomous test generation with worktree isolation"
category: "software-development"
orchestration: cli
isolation: worktree
cliMode: supervised
model: "claude-sonnet-4.5"
customAgent: "test-writer"
tags: ["testing", "automation", "tdd"]
difficulty: beginner
roles:
  - name: "Test Engineer"
    prompt: |
      You are a test automation engineer.
      Generate comprehensive unit tests for the provided code.
      
      Requirements:
      - Use the project's testing framework
      - Cover happy paths and edge cases
      - Include test descriptions and assertions
      - Follow AAA pattern (Arrange, Act, Assert)
  - name: "Code Coverage Analyst"
    prompt: |
      You are a code coverage specialist.
      Analyze the generated tests and ensure:
      - All public methods are tested
      - Branch coverage is maximized
      - Edge cases are covered
      - Suggest additional test cases if needed

---
# rawBody

# Test Generation Guidelines

## Testing Principles
- Write tests that are readable and maintainable
- Each test should test one thing
- Use descriptive test names
- Mock external dependencies

## Coverage Goals
- Aim for 80%+ line coverage
- 70%+ branch coverage
- 100% coverage for critical paths
```

### Example 3: CLI Autonomous Mode with Workspace Isolation

```yaml
name: "Documentation Generator"
description: "Automatically generate API documentation"
category: "software-development"
orchestration: cli
isolation: workspace
cliMode: autonomous
model: "claude-haiku-4.5"
tags: ["documentation", "api", "automation"]
difficulty: beginner
roles:
  - name: "Technical Writer"
    prompt: |
      You are a technical writer specializing in API documentation.
      Generate clear, comprehensive documentation for code files.

      Include:
      - Function/method signatures
      - Parameter descriptions
      - Return value descriptions
      - Usage examples
      - Edge cases and error handling

---
# rawBody

# Documentation Standards

## Format
- Use JSDoc/TypeDoc format for TypeScript
- Use docstrings for Python
- Include @example tags with code snippets

## Style Guide
- Write in present tense
- Be concise but complete
- Include type information
- Link to related functions
```

### Example 4: Stage-Based Workflow with Skills and Iteration

```yaml
name: "Requirements to Architecture"
description: "Two-stage workflow: gather requirements then design architecture"
category: "software-development"
orchestration: sequence
difficulty: advanced
tags: ["sdd", "requirements", "architecture", "iterative"]
skills:
  - typescript-conventions    # injected into all roles in all stages
stages:
  - name: "Requirements Gathering"
    subFlow: research-edit-review
    iterations: 3
    roles:
      - name: "Researcher"
        prompt: |
          You are a requirements researcher. Analyse the user's idea and gather
          relevant context. Produce a structured list of functional requirements.
      - name: "Editor"
        prompt: |
          You are a requirements editor. Refine the researcher's output into
          precise, testable requirement statements.
      - name: "Critic"
        prompt: |
          You are a requirements critic. Evaluate completeness and clarity.
          If all requirements are clear and complete, output your review then
          append exactly: <!-- flow:done -->
          Otherwise provide specific improvement feedback.

  - name: "Architecture Design"
    subFlow: sequence
    iterations: 1
    skills:
      - system-design-patterns  # added only for this stage
    roles:
      - name: "Architect"
        prompt: |
          Design a system architecture based on the requirements above.
      - name: "Security Reviewer"
        skills:
          - owasp-top10           # added only for this role
        prompt: |
          Review the architecture for security gaps.

---
# rawBody (shared context)

Focus on TypeScript/Node.js target stack.
```

```

Legacy `*.prompt.md` files with `useCli: true` are automatically mapped:

**Old format:**
```yaml
orchestration: all-respond
maxRounds: 1
useCli: true
```

**New format:**
```yaml
orchestration: cli
isolation: workspace  # default
cliMode: supervised   # default
```

**Backward compatibility:**
- `sequential` → `sequence`
- `all-respond` → `cli`
- `round-robin` → Not supported (use `sequence` instead)

## Validation Rules

**Stage-based flows** (`stages` present):
- At least one stage required
- Each stage must have at least one role
- Stage and role names must be non-empty
- Role system prompts must be non-empty
- Cannot combine top-level `roles` with `stages`

**Flat flows** (`roles` only):
- Minimum 2 roles, maximum 10
- Role names must be unique and non-empty
- Role system prompts must be non-empty

**Both modes**:
- CLI properties only valid when `orchestration: cli`
- `isolation` must be `workspace` or `worktree`
- `cliMode` must be `supervised` or `autonomous`

## Best Practices

### Choosing Orchestration Mode

**Use `sequence` when:**
- You want roles to build upon each other's responses
- Tool execution is needed during role responses
- You need fine-grained control over execution order
- Running in environments without GitHub Copilot CLI

**Use `cli` when:**
- You want persistent session history
- File editing and workspace modifications are needed
- You want isolated experimentation (worktree mode)
- Long-running autonomous tasks
- Background execution without blocking VS Code

### Isolation Mode Selection

**Use `workspace` when:**
- Simple refactoring tasks
- Documentation updates
- Quick bug fixes
- No risk of conflicts with active work

**Use `worktree` when:**
- Large feature implementations
- Experimental changes
- Multiple parallel tasks
- User actively editing same files
- Want to review changes before applying

### CLI Mode Selection

**Use `supervised` when:**
- Making critical changes
- Want to review each action
- Learning how the agent works
- High-stakes modifications

**Use `autonomous` when:**
- Repetitive tasks
- Well-defined requirements
- Trust the agent's capabilities
- Want minimal interruption

## See Also

- [Implementation Status](../IMPLEMENTATION_STATUS.md)
- [Examples Directory](../examples/)
- [VS Code AI Flow Extension](../README.md)
