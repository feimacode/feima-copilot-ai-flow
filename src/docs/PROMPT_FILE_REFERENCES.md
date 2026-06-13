# Prompt File References

## Overview

Flow roles can now reference prompt files in three different formats:

1. **Inline string** - Traditional embedded prompt text
2. **URI reference** - Absolute path or file URI to a prompt file
3. **Filename reference** - Name searched in default Copilot prompt folders

## Supported Formats

### 1. Inline String (Traditional)

```yaml
roles:
  - name: Code Reviewer
    prompt: |
      You are a senior code reviewer. Focus on:
      - Code quality and maintainability
      - Best practices adherence
```

### 2. URI Reference

Absolute file path or URI to a prompt file:

```yaml
roles:
  - name: Custom Reviewer
    prompt:
      uri: /path/to/custom-review.prompt.md
```

Or with a file:// URI:

```yaml
roles:
  - name: Custom Reviewer
    prompt:
      uri: file:///absolute/path/to/custom-review.prompt.md
```

Relative paths are resolved from the flow file location:

```yaml
roles:
  - name: Custom Reviewer
    prompt:
      uri: ../shared-prompts/review.prompt.md
```

### 3. Filename Reference

Searches for the prompt file in default Copilot prompt folders:

```yaml
roles:
  - name: Security Reviewer
    prompt:
      name: security-review
```

The `.prompt.md` extension is optional. The system will search for:
- `security-review.prompt.md`
- `security-review` (without extension)

## Search Paths

For filename references, the following folders are searched in order:

1. `.github/prompts/` (workspace)
2. `.vscode/prompts/` (workspace)
3. `~/.copilot/prompts/` (user home)

## YAML Frontmatter Handling

Prompt files may contain YAML frontmatter (like `.prompt.md` files). The system automatically strips frontmatter before using the content:

```markdown
---
description: Security-focused code review
applyTo: "*.ts"
---

You are a security reviewer. Focus on:
- Authentication and authorization
- Input validation
- Data sanitization
```

Only the body content (after the frontmatter) is used as the role's prompt.

## Combining with Agent References

Prompt and agent references can be combined. When both are provided, the prompt content is prepended to the agent instructions:

```yaml
roles:
  - name: Expert Reviewer
    prompt:
      name: code-quality-checks
    agent: senior-developer
```

The resulting prompt will be:
1. Prompt file content
2. Separator: `---`
3. Agent file content (with `$ARGUMENTS` substituted)

## Example Flow

See `examples/prompt-file-demo.flow.yaml` for a complete example demonstrating all three formats.

## Benefits

- **Reusability**: Share prompt files across multiple flows
- **Modularity**: Keep prompts in separate files for easier maintenance
- **Discovery**: Use filename references to leverage existing Copilot prompt infrastructure
- **Flexibility**: Combine inline, file-based, and agent-based prompts