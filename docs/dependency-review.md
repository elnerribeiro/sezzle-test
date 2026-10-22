# Dependency review

This review covers the Go module graph and the web package manifest/lockfile for the final PR pass. Production dependencies are pinned reproducibly by `go.mod`/`go.sum` and `web/package-lock.json`.

## Why the MongoDB driver is present

The calculator does not connect to MongoDB and application source does not import a MongoDB driver. `go mod why -m go.mongodb.org/mongo-driver/v2` traces the module through:

```text
calculator API -> github.com/gin-gonic/gin -> github.com/gin-gonic/gin/binding -> go.mongodb.org/mongo-driver/v2/bson
```

Gin's binding package includes BSON request binding, which imports the driver's BSON package. Since the API uses Gin, Go includes this package in Gin's build graph even though this calculator binds JSON requests only. It is an indirect dependency of Gin, not a database integration added by this project. Removing it would require changing or forking the required Gin dependency solely to remove an unused binding format, which is not a proportionate change here. The repository has no MongoDB service, configuration, connection string, or application-level BSON binding.

## Go dependency finding

The review found `golang.org/x/crypto v0.48.0` below the patched release specified by the critical advisory in the PR review. Although the affected SSH packages are not in the calculator's runtime package list, the project's dependency policy prohibits retaining a known high or critical vulnerable version. The module is now `v0.57.0` (the minimum selected by the patched HTTP/3 dependency), and `go get` advanced the related `x/net`, `x/sys`, and `x/text` modules. The same audit found `x/net v0.57.0` and `quic-go v0.59.0` below their fixes; they are now `x/net v0.60.0` and `quic-go v0.59.1`. Checksums were regenerated with `go mod tidy`.

The Go source does not import `x/crypto` directly. `go mod why -m golang.org/x/crypto` shows the shortest route through Gin's validator dependency to `x/crypto/sha3`; Gin also brings in HTTP/3 support. Keeping the patched version avoids changing the required Gin stack while satisfying the reported advisories. The source audit is pinned to Go 1.26.10 in `go.mod`, the CI workflow, and the API build image so it includes the standard-library fixes reported by the scanner. `govulncheck` checks known advisories against reachable symbols and required modules; this pass found no vulnerabilities in reachable code and reported one advisory in the unused `x/crypto/openpgp` package, which has no fix because it is unmaintained. The application does not import OpenPGP.

## Other dependency checks

- The Go application has one direct module dependency: `github.com/gin-gonic/gin`. Other entries in `go.mod` are indirect dependencies in Gin's compiled package graph.
- The web application lists React, React DOM, and LogTape as runtime dependencies. TypeScript, Vite, Vitest, Storybook, Testing Library, Playwright, and Cucumber are development/test dependencies, and the lockfile fixes their resolved versions.
- `npm audit --audit-level=high` checks the locked npm graph. The CI workflow runs it on every pull request and push to `main`.
- `go run golang.org/x/vuln/cmd/govulncheck@latest ./...` checks Go advisories. It is documented alongside the npm audit command so both ecosystems are included in future dependency review.
- No MongoDB server/client integration should be added unless the product requirements introduce a database-backed feature.

## Reproduction commands

```sh
go mod why -m go.mongodb.org/mongo-driver/v2
go mod graph
go run golang.org/x/vuln/cmd/govulncheck@latest ./...
npm --prefix web audit --audit-level=high
```
