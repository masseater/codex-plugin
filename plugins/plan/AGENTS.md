# plan

Plan file review and quality assurance

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                     | Description                                                                                                                                                                                                                                                                               |
| ----- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | plan:define              | Use when creating plan files, writing plans, or entering Plan mode. This skill provides a template and checklist for structuring plan files with User Prompts, Purpose, Structure, TODO, and Verification sections that comply with plan file content rules.                              |
| skill | plan:review              | Use when the user asks to "review the plan", "check plan quality", "validate the plan before ExitPlanMode", or "run plan review". This skill coordinates parallel review from multiple specialized sub-agents and iterates until 3 consecutive rounds of unanimous approval are achieved. |
| agent | consistency-checker      | Checks the internal consistency of plan files. Detects contradictions in Purpose, TODO, implementation details, and Phase dependencies. Use when reviewing plan files.                                                                                                                    |
| agent | goal-fulfillment-checker | Checks whether the plan fulfills user goals. Compares User Prompts against Purpose, TODO, and Verification to ensure the plan addresses what the user actually requested. Use when reviewing plan files.                                                                                  |
| agent | plan-updater             | Updates plan files based on review feedback from review.md. Uses review-combiner output as the sole source for plan modifications.                                                                                                                                                        |
| agent | policy-checker           | Checks whether plan files conform to content rules. Verifies required elements are present and prohibited content is absent. Use when reviewing plan files.                                                                                                                               |
| agent | review-claim-verifier    | Verifies whether a reviewer's claim about a plan file is correct. Use when you suspect a reviewer's feedback may be incorrect.                                                                                                                                                            |
| agent | review-combiner          | Updates the review.md file with round results, revision records, and final status. Use to record review outcomes during plan review workflow.                                                                                                                                             |

<!-- END:component-list -->
