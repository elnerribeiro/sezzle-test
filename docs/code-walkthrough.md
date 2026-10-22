# Code walkthrough

This document explains the application source, its boundaries, and the purpose of its test and configuration files. The source and tests remain the authoritative description of behavior.

## Application flow

The browser renders the React calculator, collects a complete expression, and sends it as JSON to `POST /api/v1/calculate`. The Go handler validates the request and calls the parser. The parser evaluates the expression and returns either a finite number or a stable error code. The browser displays the result or a recovery message with the API correlation ID.

## Go API (`api/`)

- `api/cmd/server/main.go` reads the listen address from `API_ADDRESS` (with a local default), constructs the HTTP handler, waits for graceful shutdown to drain requests, and returns a nonzero process status on startup or shutdown failure.
- `api/cmd/server/main_test.go` tests unexpected startup failure, sends SIGTERM during an active request, and repeats the forced-shutdown deadline test to guard against listener/request startup races.
- `api/handler.go` configures Gin routes and middleware. It limits request bodies, rejects malformed JSON, unknown fields, and trailing JSON, evaluates submitted expressions, and writes success or stable error responses. Recovery logging keeps panic details out of client responses.
- `api/calculator.go` implements a recursive-descent parser. Its precedence layers are expression (`+`, `-`), term (`*`, `/`), unary signs, power (`^`, right-associative), postfix percentage (`%`), then number, parentheses, or `sqrt(...)`. It rejects malformed inputs and immediately rejects NaN/infinite intermediate results.
- `api/calculator_test.go` exercises successful arithmetic, precedence, advanced operations, invalid expressions and requests, finite-intermediate regressions, health and route behavior, stable error responses, and panic recovery.

## React client (`web/src/`)

- `web/index.html` provides the browser document, page title, and root element used by the React entry point.
- `web/src/main.tsx` mounts the React application into the HTML root element.
- `web/src/App.tsx` owns the calculator view and interaction state: expression entry, keypad mapping, API submission, a 10-second abortable request, visible pending state, result display, runtime validation of untrusted JSON response shapes, safe error messages, and keyboard shortcuts. Enter preserves native activation on focused buttons and links; global typing after keypad interaction blurs the clicked button to keep the shortcut sequence active. Exponent replacement also collapses a selected `^` immediately.
- `web/src/clientLogger.ts` configures LogTape with a JSON Lines console formatter and logs only safe operation/error categories for handled transport and malformed-response failures.
- `web/src/app.css` defines the responsive application shell, keypad and result styles, long-number wrapping, accessibility focus styles, and Sezzle color tokens.
- `web/src/App.test.tsx` tests UI behavior with mocked HTTP responses, including native Enter activation, mixed keypad/keyboard input, malformed JSON envelope recovery, emitted JSON log records, timeout recovery, and error handling.
- `web/src/App.stories.tsx` provides the full-screen default Storybook story for visual component review.
- `web/src/test-setup.ts` installs shared Vitest and Testing Library setup.
- `web/src/vite-env.d.ts` provides Vite client type declarations.

## Browser checks and tooling (`web/`)

- `web/features/calculator.feature` describes integrated user scenarios in Gherkin, with each scenario across all required viewports and long-result containment down to `320x720`.
- `web/features/step-definitions/calculator.steps.mjs` runs those scenarios with Playwright and checks visible results, the complete shell, card containment, and global overflow.
- `web/scripts/test-bdd.sh` builds and launches the Go API and Vite app for the browser suite, waits for readiness, and cleans up its processes.
- `web/.storybook/main.ts` configures Storybook's React/Vite framework and story discovery.
- `web/.storybook/preview.ts` contains shared Storybook preview configuration.
- `web/vite.config.ts` configures React, the local API proxy, and Vitest's browser-like test environment and coverage thresholds.
- `web/package.json` records scripts and pinned-by-lockfile frontend dependencies; `web/package-lock.json` is the reproducible dependency lock.
- `web/tsconfig.json` enables strict TypeScript checks.
- `.github/workflows/ci.yml` runs Go tests/vet/coverage, npm checks and audit, the full Cucumber/Playwright suite, and both Compose image builds on pull requests.

## Container deployment

- `api/Dockerfile` builds the Go API binary and copies it into a small non-root runtime image.
- `web/Dockerfile` builds the React app from the npm lockfile and serves its static output with Nginx.
- `web/nginx.conf` serves the frontend, forwards API and health requests to the `api` Compose service, and falls back to the app entry point for client routes.
- `compose.yaml` defines the two services, their build contexts, private API exposure, frontend host port, and restart policy.
- `scripts/containers.sh` provides `start`, `stop`, `status`, and `logs` commands for both containers.
- Root `.dockerignore` and `web/.dockerignore` keep local dependencies, generated output, and Git metadata out of their respective container build contexts.

## Project documentation

- `go.mod` declares the Go module and API dependencies; `go.sum` records dependency checksums. `.gitignore` excludes local and generated files from version control.
- `docs/dependency-review.md` explains the dependency audit, including Gin's transitive BSON/MongoDB driver and the patched Go crypto module.
- `OVERVIEW.md` preserves the original exercise requirements.
- `AGENTS.md` is the project development constitution and validation route.
- `README.md` documents setup, HTTP API usage, operations, keyboard controls, and common checks.
- `docs/prompts.md` records the user prompts and scope clarifications that shaped the implementation.
- `docs/observability.md` documents client-safe error and logging conventions.
- `docs/review-followups.md` documents review analysis, selected implementation choices, and validation evidence for each finding.
