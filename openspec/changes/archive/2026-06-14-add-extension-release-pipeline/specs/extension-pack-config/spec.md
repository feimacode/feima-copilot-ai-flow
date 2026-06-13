## ADDED Requirements

### Requirement: extensionPack auto-installs copilot-more-llms

The extension's `package.json` SHALL declare `extensionPack` containing `feima.copilot-more-llms`, so that the VS Code Marketplace automatically installs the Feima global model provider extension alongside `feima.copilot-ai-flow`.

#### Scenario: User installs ai-flow from marketplace

- **WHEN** a user installs `feima.copilot-ai-flow` from the VS Code Marketplace
- **THEN** the marketplace SHALL also install `feima.copilot-more-llms`
- **AND** `feima.copilot-more-llms` SHALL in turn install `github.copilot-chat` (via its own `extensionDependencies`)
- **AND** both extensions SHALL activate and register their contributions

#### Scenario: copilot-more-llms unavailable

- **WHEN** a user installs `feima.copilot-ai-flow` from the marketplace
- **AND** `feima.copilot-more-llms` is unavailable for any reason
- **THEN** `feima.copilot-ai-flow` SHALL still install and activate successfully
- **AND** the `@flow` chat participant SHALL be functional using the built-in Copilot models (`vendor: 'copilot'`)

### Requirement: extensionDependencies on github.copilot-chat

The extension's `package.json` SHALL declare `extensionDependencies` containing `github.copilot-chat`, so that the Copilot Chat extension (which provides the `vscode.lm` API and chat participant surface) is guaranteed to be installed.

#### Scenario: Copilot Chat not installed

- **WHEN** a user attempts to install `feima.copilot-ai-flow`
- **AND** `github.copilot-chat` is not installed
- **THEN** the marketplace SHALL install `github.copilot-chat` before activating ai-flow

#### Scenario: Extension already has Copilot Chat via transitive dependency

- **WHEN** `feima.copilot-more-llms` successfully installs `github.copilot-chat`
- **AND** `feima.copilot-ai-flow` also declares the same `extensionDependencies`
- **THEN** there SHALL be no conflict or duplicate installation
- **AND** ai-flow SHALL activate normally
