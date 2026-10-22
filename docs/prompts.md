# Project prompts

This file records the user's project prompts and the choices that set the initial implementation scope.

## Design and implementation phases - Codex, GPT-6 Luna High

1. “Let's start creating this project. Check AGENTS.md and OVERVIEW.md, ask for any clarification and then let's start to build.”
2. Initial scope: “Include all optional operations”.
3. Calculator behavior: “Full keypad expression entry”.
4. “OK, looks good now. Use the same color schema as this site ([https://sezzle.com/](https://sezzle.com/)). Also, bind keyboard keys to allow easy keyboard input.”
5. “Check why exponentiation keyboard input is not working. Fix. Add the text "Calculator created by Elner Ribeiro as a Full Stack Engineer test for Sezzle.". Document the whole code. Assure all prompts are saved. Assure unit tests, integration tests, API tests, storybook, components tests, and playwright tests are all green.”
6. “Put the comment text below the Ready to calculate info. Use that style.”
7. “Document the code on the .go, .ts and .tsx files.”
8. “Create docker containers for both backend and frontend. Create a script for start and stop both. Document this on README.”
9. “Create a doc with Mermaid diagrams, explaining flow, states, sequences, activities and the overall architecture. With that done, check one more time the project and create a PR.”

## Clean chat, review and tests - Codex, GPT 6.1 Sol High

1. “You are a Senior Software Architect and designated code reviewer/tester for this PR (https://github.com/elnerribeiro/sezzle-test/pull/1). Analyze everything, comment any possible changes or better ways, and put the comments on Github.”

## Back to initial context

1. “Check the comments on the PR. Analyze meaning, code and viability. Implement them. Document everything and change docs accordingly.”
2. “Add a couple more API examples on README, add full curl command to test.”

## Back to review and tests chat

1. “Review the changes. Assure code is the best it can be, comment if needed.”

## Back to initial context

1. “Check the new comments on the PR. Analyze meaning, code and viability. Implement them. Document everything and change docs accordingly.”