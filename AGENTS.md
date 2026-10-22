# Calculator Test — project index and development constitution

> Use the task-specific route.

## 1. Context

1. Always check work needed on OVERVIEW.md.
2. Before acting, check `git status --short` and preserve unrelated changes.
3. Use TDD always - first create tests, then implement, then check if tests are passing. Implementation follows tests.
4. Do extensive tests, for success and error scenarios.
5. Keep things simple, stupid. No overengineering.
6. Ignore generated files. Use Go, TypeScript or shell; do not introduce or invoke any other language.
7. Prefer the implementation and tests as the source of truth for current behavior.
8. Delegate by request or independent workstream; one writer per file.
9. When changing architecture, contracts, data, task status, or a rule in this index, update this file in the same delivery. Keep it under 16 KiB.
10. To demonstrate or validate the application, use the external Edge browser and leave the result open. In local environments, development credentials are authorized, subject to tool confirmations.
11. Document everything important, including promps typed. Be clear and concise on documents, though.

## 2. Status


## 3. Compact map

- `OVERVIEW.md`: original exercise; user clarifications below take precedence.
- `README.md`: current capabilities, local setup, migrations, registration and operation commands.
- `docs/architecture.md`: Mermaid diagrams for runtime architecture, expression flow, UI states, API sequence, user activity, and container lifecycle.
- `docs/review-followups.md`: PR review findings, implementation decisions, and regression coverage.
- `.github/workflows/ci.yml`: pull-request and main-branch validation gates.


## 4. Task-based reading routes


## 5. Invariants

### Security, privacy, and errors

- External errors use stable English codes and `correlation_id`; never expose internals. Log handled/recovered exceptions once as safe structured JSON. UI errors name the action, recovery and support reference; no raw exception text. See `docs/observability.md`.
- Logs must use established structured logging libraries: Go `slog` on the API and LogTape in the browser. Client logs include only a safe operation and error category; never include expression contents, raw exception text, or response bodies. Printing to out/err is not a real log.
- Production dependencies must be reproducible through lockfiles. Do not introduce high/critical CVEs; dependencies unmaintained for 24 months require a risk review.

### Confirmed product requirements

- Build a full-stack calculator using a React/TypeScript frontend and Go/Gin REST API.
- The first release includes addition, subtraction, multiplication, division, exponentiation, square root and percentage, entered as a full keypad expression.
- The API accepts `POST /api/v1/calculate` with `{ "expression": "..." }`; successful responses contain `{ "result": number }`. Stable error codes include a `correlation_id`.
- Expression precedence: parentheses, right-associative exponentiation, multiplication/division, then addition/subtraction. Postfix `%` divides by 100; `sqrt(...)` is supported.
- Reject NaN or infinite intermediate arithmetic results immediately with `result_out_of_range`, even if a later operator could mask them.
- Use Sezzle's purple `#382757` and mint `#9FF4D9` as the calculator's primary brand colors. Support global keyboard shortcuts for expression entry and calculation.
- Provide Docker images for the Go API and React frontend, with a Compose-based start/stop/status/logs script. The API remains private to the Compose network and the frontend proxies API calls.


### Architecture and consistency

- `api/` owns the calculator parser, JSON API and server; `web/` owns the React UI and calls the API over HTTP. Vite proxies API paths during local development.
- The calculator is stateless: each submission evaluates one complete expression. Browser-side arithmetic is not authoritative.
- Browser submissions abort after 10 seconds, show calculating feedback, and recover to an editable expression.
- `compose.yaml` runs the API and Nginx-hosted frontend as separate services; `scripts/containers.sh` manages their lifecycle.

## 6. Technology

Go API owns environment setup. Node is restricted to HTTP consumers, browser tests and upstream fixtures; it must not read database credentials or access PostgreSQL/Redis, if they exist. Run `node --test tests/*.test.mjs` for offline HTTP fixture checks.

Use a TDD approach, idiomatic Go 1.26 with Gin, strict React/TS in the latest LTS version.

## 7. Validation

- Make the smallest defensible change and preserve the user's work.
- Tests first. After implementation, tests should run green without changes.
- Every changed behavior gets a new or adjusted test at the closest appropriate level. Run all applicable tests; never claim to have run a command that was not executed. Record blockers and their reasons when present.
- API, should live in folder `api/`
- Web, from `web/`: `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npm run build-storybook`, `npm run test:bdd:validate`, `npm audit --audit-level=high`, and `npm run test:bdd`; `test:e2e` is an alias for the integrated Playwright/Cucumber suite.
- Update backlog items and genuinely affected documents only after obtaining evidence. A completed delivery reports changed files, executed commands, and remaining limitations.
- Ensure test coverage of at least 80% of the code. For web components, ensure Storybook stories exist.
- Integrations require Playwright and Gherkin scenarios executed by `@cucumber/cucumber` (a devDependency pinned in the web lockfile). `.github/workflows/ci.yml` runs API, web, BDD, dependency-audit, coverage, and image-build gates.
- Every integrated scenario and all visual validation must cover mobile viewport `1080x1920`, desktop viewports `1366x768` and Full HD `1920x1080`, checking the complete shell, absence of global horizontal overflow, and containment of visible calculator content. Additional narrow-size checks may be included.
- Plan interactions before implementation: selection hierarchy, visible preconditions, action feedback, recovery, and concurrency. A `404` for a listed item removes the stale item and preserves the collection; a collection error may replace the screen. Test what users can click, not just what they can see.
- Implementation with confirmed and approved scope must occur in the same delivery, not merely as a plan/promise. Blockers require technical evidence and the smallest necessary decision; lack of effort, context, or agent preference is not a blocker.

## 8. Exceptions
