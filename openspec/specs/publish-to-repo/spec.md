# publish-to-repo Specification

## Purpose
Enable users to publish their customized flows to their own GitHub repository or Gist, for version control, sharing, and catalog indexing.

## Requirements

### Requirement: GitHub authentication
Publishing SHALL use VS Code's built-in GitHub authentication provider. No custom OAuth flow is needed. The `gist` and `repo` scopes SHALL be requested as needed.

### Requirement: Publish options
Users SHALL have the following publish options:
- **Gist**: Quick publish with automatic versioning via revisions
- **Repository**: Full version control with pull requests and collaboration
- **Catalog submission**: Optional — submits the catalog entry JSON to the harness catalog repo

### Requirement: Companion file bundling
When publishing, all referenced files SHALL be included:
- `.flow.yaml` (main file)
- Skills referenced in `usesSkills`
- Prompts referenced in `usesPrompts`
- A generated `catalog.json` entry file

### Requirement: Catalog entry format
The catalog entry SHALL follow the format:

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

### Requirement: Catalog re-indexing
When a user publishes a flow to a public gist/repo and the catalog GitHub action runs (periodic or on-demand), the new flow SHALL appear in the catalog index with:
- Source pointing to the user's gist/repo
- Author set to the GitHub username
- Star count from the gist/repo

### Requirement: Update published flows
Users SHALL be able to update already-published flows. Changes SHALL be pushed to the same gist/repo, and the catalog index SHALL be updated on next re-index.

## Notes
This is a **future roadmap item**, not part of the current gallery-redesign implementation. It requires GitHub auth integration, catalog submission workflow, and companion file resolution and bundling.
