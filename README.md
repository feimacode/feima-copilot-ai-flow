# Copilot AI Panel

Multi-perspective AI discussions with configurable expert roles.

## Features

- 🎭 **Multi-Role Discussions**: Simulate conversations between multiple AI experts with distinct perspectives
- 📚 **Prompt Library**: Curated collection of discussion templates organized by category
- 🎯 **Three Orchestration Modes**: Sequential, parallel, or multi-round discussions
- 🔍 **Discoverable**: Browse and search prompts by category, tags, and use case
- ⚙️ **Customizable**: Create your own prompts or customize existing ones
- 🤝 **Community-Driven**: Contribute and share prompts with the community

## Quick Start

1. Install the extension
2. Open the AI Panel Library view (activity bar icon)
3. Browse prompts by category
4. Click "Use Prompt" or type in chat:
   ```
   @panel #file:prompts/software-development/sprint-planning.prompt.md What should we prioritize?
   ```

## Categories

- **Software Development**: Sprint planning, architecture review, code review
- **Business & Strategy**: Product strategy, market analysis, prioritization
- **Design & UX**: Design critiques, accessibility audits
- **Education**: Tutoring, concept exploration, study groups
- **Creative**: Brainstorming, story development
- **Operations**: Incident postmortems, capacity planning

## Creating Custom Prompts

Create a `.prompt.md` file with this structure:

```markdown
---
name: My Discussion
description: What this discussion is about
category: software-development
orchestration: sequential
tags: [tag1, tag2]
tools:
  - copilot_readFile
  - copilot_searchCodebase
  # Or use wildcard to include ALL available tools:
  # - "*"
roles:
  - name: Expert 1
    systemPrompt: You are...
    model: gpt-4
  - name: Expert 2
    systemPrompt: You are...
    model: gpt-4
---

# Context
Shared background information for all roles...
```

### Tools Configuration

The `tools` field allows AI roles to interact with your workspace:

- **Specific tools**: List tool names like `copilot_readFile`, `copilot_searchCodebase`, `copilot_listDirectory`
- **Wildcard**: Use `["*"]` to include all available VS Code tools
- **No tools**: Omit the field or use empty array for conversation-only mode

See `prompts/software-development/codebase-exploration.prompt.md` for a wildcard example.

## Commands

- `AI Panel: Browse Prompt Library` - Open the library view
- `AI Panel: Search Prompts` - Search by keyword or tag
- `AI Panel: Create Prompt from Template` - Start with a template
- `AI Panel: Copy Prompt to Workspace` - Copy to your project

## Contributing

See [community/README.md](community/README.md) for contribution guidelines.

## License

MIT
