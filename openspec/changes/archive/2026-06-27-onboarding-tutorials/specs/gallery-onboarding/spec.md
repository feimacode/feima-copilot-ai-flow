# gallery-onboarding Delta Specification

## ADDED Requirements

### Requirement: Tutorial links reference new tutorial pages
Gallery flow cards for builtin example flows SHALL include `tutorialUrl` fields pointing to the corresponding basic tutorial pages on the docs site. The mapping SHALL be: `hello-world` → `/tutorials/hello-world/`, `01-pipeline-review` → `/tutorials/pipeline-basics/`, `02-iterative-refine` → `/tutorials/iteration-convergence/`, `03-fork-join-perspectives` → `/tutorials/fork-join/`, `04-context-files` → `/tutorials/context-files/`, `05-dialog-simulator` → `/tutorials/dialog-simulator/`, `06-human-gate` → `/tutorials/human-gate/`.

#### Scenario: User opens tutorial from gallery for a basic flow
- **WHEN** a user clicks "Tutorial" on a builtin example flow card
- **THEN** the corresponding basic tutorial page SHALL open in the default browser
