## ADDED Requirements

### Requirement: Astro + Starlight docs site in monorepo
A static documentation site SHALL exist in the `docs-site/` directory of the `feima-copilot-ai-flow` repository. The site SHALL be built with Astro and use the Starlight theme. The site SHALL be deployable to GitHub Pages via GitHub Actions.

#### Scenario: Docs site builds successfully
- **WHEN** `npm run build` is executed in `docs-site/`
- **THEN** a static HTML site SHALL be generated in `docs-site/dist/` without errors

#### Scenario: Docs site deploys to GitHub Pages
- **WHEN** changes are pushed to the `main` branch
- **THEN** the GitHub Actions workflow SHALL build and deploy the site to the `gh-pages` branch

### Requirement: Docs site content structure
The docs site SHALL include the following sections: (1) Getting Started — installation and quickstart (first flow in 60 seconds), (2) Tutorials — a 5-tutorial chain anchored on story-estimation (create → customize → Jira integration → staged iteration → CLI delegation), (3) Guides — execution patterns, referencing files, flow authoring concepts, tool integration, (4) Gallery — links to in-editor gallery and key example flows.

#### Scenario: Tutorial chain follows create-first pedagogy
- **WHEN** a user follows the tutorial chain from beginning to end
- **THEN** the first tutorial SHALL teach `@flow create` before any YAML authoring, and each subsequent tutorial SHALL build on the working flow from the previous step

### Requirement: Deep-link Run in Copilot buttons
Each tutorial and flow reference page SHALL include a "Run in Copilot" deep-link button using the `vscode://github.copilot-chat/chat?prompt=...` URI scheme. The button SHALL be a plain HTML `<a>` tag requiring no JavaScript. A fallback "Copy command" button SHALL be provided for users not on a VS Code-capable device.

#### Scenario: User clicks Run in Copilot from docs
- **WHEN** a user on a device with VS Code installed clicks the "Run in Copilot" button
- **THEN** VS Code SHALL open with the Copilot Chat input pre-populated with the `@flow` invocation

#### Scenario: User copies command on non-VS Code device
- **WHEN** a user on a device without VS Code clicks the "Copy command" fallback
- **THEN** the `@flow` invocation SHALL be copied to their clipboard

### Requirement: No MDX required for initial launch
The docs site SHALL be authored in standard Markdown (`.md`). Interactive components (MDX islands) SHALL NOT be required for the initial launch. Deep links and copy buttons SHALL function with plain HTML in Markdown.

#### Scenario: All docs pages render from plain Markdown
- **WHEN** the docs site is built
- **THEN** all content pages SHALL render correctly from `.md` files without requiring MDX or client-side JavaScript components
