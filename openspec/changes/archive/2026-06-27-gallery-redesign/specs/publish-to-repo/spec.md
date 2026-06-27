# Publish Flow to Own Repository

## Purpose

Enable users to publish their customized flows to their own GitHub repository or Gist, so they can version-control, share, and get their flows indexed in the harness catalog.

## Scenarios

### S1: User wants to publish a workspace flow

**Given**: A user has created or modified a flow in `.github/flows/`
**When**: They click "Publish to GitHub" in the flow editor or gallery
**Then**: They are guided through:
1. Creating a new gist or selecting an existing repo
2. Pushing the `.flow.yaml` file + any companion files (skills, prompts)
3. Generating a catalog entry JSON (id, name, description, tags, source URI)
4. Option to submit to the harness catalog for indexing

### S2: Catalog re-indexing

**Given**: A user has published a flow to a public gist/repo
**When**: The catalog GitHub action runs (periodic or on-demand)
**Then**: The new flow appears in the catalog index with:
- Source pointing to the user's gist/repo
- Author set to the GitHub username
- Star count from the gist/repo

### S3: User updates a published flow

**Given**: A user has already published a flow
**When**: They make changes and click "Publish update"
**Then**: The flow is pushed to the same gist/repo
**And**: The catalog index is updated on next re-index

## Requirements

### R1: GitHub authentication

- Use VS Code's built-in GitHub authentication provider
- No custom OAuth flow needed
- Request `gist` and `repo` scopes as needed

### R2: Publish options

- **Gist**: Quick publish, automatic versioning via revisions
- **Repository**: Full version control, pull requests, collaboration
- **Catalog submission**: Optional — submits the catalog entry JSON to the harness catalog repo

### R3: Companion file bundling

When publishing, include all referenced files:
- `.flow.yaml` (main file)
- Skills referenced in `usesSkills`
- Prompts referenced in `usesPrompts`
- Generate a `catalog.json` entry file

### R4: Catalog entry format

```json
{
  "id": "my-custom-flow",
  "name": "My Custom Flow",
  "description": "...",
  "tags": ["devops", "deployment"],
  "category": "operations",
  "difficulty": "intermediate",
  "source": "gist:abc123def456",
  "orchestration": "sequence",
  "roles": 3,
  "author": "github-username"
}
```

## Out of Scope

This is a **future roadmap item**, not part of the current gallery-redesign implementation:
- Requires GitHub auth integration
- Requires catalog submission workflow
- Requires companion file resolution and bundling
- Can be built as a separate change after gallery redesign is complete

## Related

- `edit-workspace-safety` spec — workspace-first editing philosophy
- `flow-star-link` spec — source URL handling for published flows