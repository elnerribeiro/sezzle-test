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
| Commit merge-time CI | Local green checks do not protect future changes. A pull-request workflow was appropriate and does not require external credentials. | `.github/workflows/ci.yml` runs race-enabled Go tests, `go vet`, 80% coverage gates for both Go packages, web lint/unit/build/Storybook checks, BDD definition validation and dependency audit, the full browser suite, and Compose image builds. |
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

The committed workflow is the authoritative merge-time validation. To run the equivalent local checks:

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

The local checks validate the same commands committed in CI. GitHub Actions will report the merge-time run after this branch update is pushed.
