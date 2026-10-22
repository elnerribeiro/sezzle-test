# Pull request review follow-ups

This document records the findings on [PR #1](https://github.com/elnerribeiro/sezzle-test/pull/1#pullrequestreview-5614674780), why they affect user-visible or operational behavior, and the changes made on the PR branch. All five inline findings and all four additional recommendations were viable for this calculator and were implemented.

## Inline findings

| Finding | Analysis and decision | Implementation and regression check |
| --- | --- | --- |
| [Wait for graceful shutdown](https://github.com/elnerribeiro/sezzle-test/pull/1#discussion_r4348681892) | `http.Server.Shutdown` closes the listener, so `ListenAndServe` can return while active handlers are still draining. Returning from `main` terminates those handlers. Waiting is required for the process lifecycle to match the API contract. | `run` waits for `Shutdown` and then for the serving goroutine; a deadline failure forces `Close` and returns failure. A subprocess sends SIGTERM while a JSON body is still arriving and verifies the response is delivered before exit. |
| [Fail the process when listen fails](https://github.com/elnerribeiro/sezzle-test/pull/1#discussion_r4348692480) | A normal exit status falsely reports a healthy server to Docker and supervisors after bind errors. | `main` exits with `run`'s status; unexpected listen failures return 1 while clean shutdown returns 0. Unit and subprocess tests cover both statuses. |
| [Reject invalid intermediate powers](https://github.com/elnerribeiro/sezzle-test/pull/1#discussion_r4348697238) | NaN can be transformed into a finite value by later operations such as `NaN^0`; checking only the final expression hides invalid real-number arithmetic. | Every arithmetic operation validates its result immediately and propagates `result_out_of_range`. API regressions cover nested powers, a NaN exponent, and overflow intermediates. |
| [Preserve native Enter activation](https://github.com/elnerribeiro/sezzle-test/pull/1#discussion_r4348704112) | The global shortcut intercepted Enter on buttons and links, preventing keyboard users from using native controls. | The global handler leaves Enter alone when a native interactive element has focus. Component tests activate Clear, a digit, an operator, and a menu link with Enter and verify calculation is not triggered accidentally. |
| [Contain long numeric results](https://github.com/elnerribeiro/sezzle-test/pull/1#discussion_r4348709251) | Long values such as `2^100` exceeded the result row and caused page-level horizontal scrolling on narrow displays. | The result flex item can shrink and wrap long unbroken values. A Playwright scenario checks the result, error/footer containment, and document width at all required sizes plus `320x720`. |

## Additional recommendations

| Recommendation | Analysis and decision | Implementation and regression check |
| --- | --- | --- |
| Commit merge-time CI | Local green checks do not protect future changes. A pull-request workflow was appropriate and does not require external credentials. The initial hosted run stalled installing browser dependencies after the `ubuntu-latest` image migrated to Ubuntu 26.04. Pinning the runner to the supported Ubuntu 24.04 image makes the environment predictable. | `.github/workflows/ci.yml` runs race-enabled Go tests, `go vet`, 80% coverage gates for both Go packages, web lint/unit/build/Storybook checks, BDD definition validation and dependency audit, the full browser suite, and Compose image builds on Ubuntu 24.04. |
| Run each browser flow at each required size | Checking only the happy path at the viewport matrix left error recovery and input modes exposed to different layout regressions. | Every Gherkin integrated scenario is now an outline covering `1080x1920`, `1366x768`, and `1920x1080`. Each flow checks shell fit and relevant content containment; long results also cover `320x720`. |
| Log client exceptions safely | Network and JSON parsing failures were handled without diagnostics, but logging an exception object or expression would expose implementation details or user input. A browser-capable structured logger is viable. | Added `@logtape/logtape` and `web/src/clientLogger.ts`. Events contain only `operation` and a finite `errorType` category; the expression, raw exception, and response body are never passed to the logger. Tests cover network failure, malformed JSON, and timeout events. LogTape documents browser support and structured logs in its [quick start](https://logtape.org/manual/start); the [changelog](https://logtape.org/changelog) records releases through October 2026. |
| Bound stalled requests and show progress | Without cancellation, one unresolved fetch leaves the input and keypad disabled forever. A fixed deadline provides a clear recovery boundary without introducing user configuration. | Fetch uses an `AbortController` with a 10-second deadline. The header shows “Calculating…” while pending, then timeout guidance while preserving the expression and re-enabling controls. A controlled pending-fetch test verifies timeout recovery. |

## Documentation updated

- `AGENTS.md`: safe client logging, intermediate numeric validation, timeout behavior, CI, and the full viewport requirement.
- `README.md`: new timeout, logging, finite-intermediate behavior, browser matrix, and CI workflow.
- `docs/architecture.md`: request timeout/error and client logging flow, UI timeout state, process shutdown sequence, and current test matrix.
- `docs/observability.md`: structured client event fields and privacy limits.
- `docs/code-walkthrough.md`: changed runtime responsibilities and new tests/configuration.
- `docs/prompts.md`: this follow-up request.

## Verification commands

The committed workflow is the authoritative merge-time validation on Ubuntu 24.04. To run the equivalent local checks:

```sh
go test -race ./...
go vet ./...
go test ./api -coverprofile=api.cover
go tool cover -func=api.cover
npm ci --prefix web
npm --prefix web run lint
npm --prefix web test
npm --prefix web run build
npm --prefix web run build-storybook
npm --prefix web run test:bdd:validate
npm --prefix web audit --audit-level=high
npm --prefix web run test:bdd
docker compose build
```

## Verification results for this revision

- `npm ci`: passed; 306 packages audited, no reported vulnerabilities.
- `go test -race ./... -cover`: passed; API package 90.8%, server process package 82.8%.
- `go vet ./...`: passed.
- `npm run lint`: passed.
- `npm test`: 19 tests passed; 90.29% statement coverage (lines 94.18%, branches 91.48%).
- `npm run build`: passed.
- `npm run build-storybook`: passed. Storybook reports its existing large manager chunk and Node's `module.register()` deprecation warning.
- `npm run test:bdd:validate`: passed; 20 scenarios and 157 steps discovered.
- `npm audit --audit-level=high`: passed; no vulnerabilities reported.
- `npm run test:bdd` and `npm run test:e2e`: passed; each ran 20 scenarios and 157 steps.
- `docker compose build` and `./scripts/containers.sh start`: passed; both services are running.
- External Edge checked long-result containment and global width at `1080x1920`, `1366x768`, `1920x1080`, and `320x720`; no console errors were observed. The full Gherkin suite also validates all error, keypad, keyboard, and happy-path flows at each required viewport.

The local checks validate the same commands committed in CI. GitHub Actions reports the merge-time run after each branch update is pushed.

## Follow-up review

The follow-up review of commit `5281ce7` identified three P2 issues and one P3 logging-format mismatch. All four are viable corrections and are implemented below.

| Finding | Analysis and decision | Implementation and regression check |
| --- | --- | --- |
| [Make the shutdown deadline test deterministic](https://github.com/elnerribeiro/sezzle-test/pull/1#discussion_r4349083253) | The test launched `ListenAndServe` and its client request concurrently, ignored the request error, and could race listener startup. This made an infrastructure test flaky rather than measuring shutdown behavior. | The test now registers cleanup before launching goroutines, waits for the health route to prove the listener is ready, reports request failures before handler entry, and consumes the forced-close result afterward. The deadline test passed 100 consecutive runs. |
| [Handle mixed keypad and keyboard entry](https://github.com/elnerribeiro/sezzle-test/pull/1#discussion_r4349087375) | Preserving native Enter activation left a mouse-focused keypad button in focus. Subsequent global shortcuts updated React state but Enter activated the old button, so the typed expression was not submitted. Moving focus into the field also means the physical `Shift+6` shortcut must still be translated there. | After a global expression key, a layout effect focuses the expression input and places the caret at the end. `Shift+6` inserts `^` at the caret even when the field is focused. Native Enter on deliberately focused buttons and links remains intact. Component tests cover mixed click/keyboard entry, exponent entry, and submission. |
| [Validate API JSON envelopes at runtime](https://github.com/elnerribeiro/sezzle-test/pull/1#discussion_r4349093082) | TypeScript assertions do not validate network data. Null and arrays could be dereferenced, and an object-valued `correlation_id` could reach React as a child and crash the calculator. | Runtime guards require a non-array object, a finite numeric success result, and string error code/reference fields. Malformed shapes log one `invalid_response` event and render generic recoverable guidance with an unavailable reference. Component tests cover null and array envelopes, wrong result types, missing fields, and a non-string correlation ID. |
| [Emit client events as JSON Lines](https://github.com/elnerribeiro/sezzle-test/pull/1#discussion_r4349097348) | LogTape's default console formatter uses styled, multi-argument output and did not satisfy the project's structured JSON log contract. | `clientLogger.ts` now configures the console sink with `jsonLinesFormatter`. A component-level test captures the actual console sink output, parses the JSON line, and verifies that it contains only the expected operation and error category fields. |

For this follow-up, the relevant documentation was updated in `README.md`, `docs/architecture.md`, `docs/code-walkthrough.md`, and `docs/observability.md`. `docs/prompts.md` records the review requests.

### Follow-up verification

- `go test ./api/cmd/server -run '^TestShutdownDeadlineClosesServerAndReturnsFailure$' -count=100`: passed all 100 runs.
- `go test -race ./... -cover`: passed; API package 90.8%, server lifecycle package 82.8%.
- `go vet ./...`: passed.
- `npm run lint`, `npm test`, `npm run build`, `npm run build-storybook`, `npm run test:bdd:validate`, and `npm audit --audit-level=high`: passed. Vitest ran 27 tests with 94.73% statement and 89.56% branch coverage; Storybook retained its existing large-chunk and Node deprecation warnings; audit found no vulnerabilities.
- `npm run test:bdd`: passed all 20 scenarios and 157 steps across the required viewports.
- `docker compose build` and `./scripts/containers.sh start`: passed.
- External Edge on `http://localhost:3000/`: clicked keypad `2`, entered `Shift+6`, typed `3`, and submitted with Enter; the expression was `2^3` and the result was `8`.
