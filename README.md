# Sezzle Calculator

A full-stack expression calculator with a Go/Gin API and React/TypeScript keypad UI.

## Requirements

- Go 1.26+
- Node.js 26+ and npm
- Docker Engine or Docker Desktop with the Docker Compose v2 plugin (for containerized use)

## Run locally

In one terminal, start the API:

```sh
go run ./api/cmd/server
```

The API listens on `http://localhost:8080` by default. Set `API_ADDRESS` to change the address.

In another terminal, start the web app:

```sh
cd web
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. The development server proxies `/api` and `/healthz` to the Go API.
Use `http://localhost:5173/` while Vite is running; opening `web/index.html` directly as a `file://` URL skips the TypeScript module server and leaves the app blank.

## Run in containers

Build and start the backend API and frontend web server together:

```sh
./scripts/containers.sh start
```

The first start builds both images. Open `http://localhost:3000/`. The Nginx frontend serves the compiled React app and proxies `/api/` and `/healthz` requests to the Go API over the private Compose network; only the frontend port is published to the host.

```sh
./scripts/containers.sh status  # show both containers
./scripts/containers.sh logs    # follow container logs
./scripts/containers.sh stop    # stop both containers
```

`stop` preserves the containers so a later `start` can reuse them. To choose another host port, set `CALCULATOR_WEB_PORT` when starting, for example `CALCULATOR_WEB_PORT=8088 ./scripts/containers.sh start`.

## API

`POST /api/v1/calculate`

Request:

```json
{"expression":"(2 + 3) * 4"}
```

Success response:

```json
{"result":20}
```

Supported operators are `+`, `-`, `*`, `/`, `^`, postfix `%`, parentheses, and `sqrt(...)`. Multiplication and division take precedence over addition and subtraction; exponentiation is right-associative. Percentage divides its value by 100. Errors use a stable code and a support reference:

```json
{"error":{"code":"division_by_zero","correlation_id":"..."}}
```

Other error codes include `invalid_request`, `invalid_expression`, `result_out_of_range`, `method_not_allowed`, and `not_found`.

The API also exposes `GET /healthz`.

## Development checks

```sh
go test ./api/... -cover
npm ci --prefix web
npm --prefix web run lint
npm --prefix web test
npm --prefix web run build
npm --prefix web run build-storybook
npm --prefix web run test:bdd
```

The BDD suite starts both services and checks expression entry, error recovery, shell containment, and overflow at `1080x1920`, `1366x768`, and `1920x1080`.

## Design notes

- The browser sends a complete expression to the API; arithmetic and validation stay server-side.
- The API accepts only a JSON object with an `expression` string and returns finite numeric results.
- UI errors tell users what action failed, how to recover, and the API correlation ID when available.
- The initial keypad is the complete expression entry surface. It supports the four basic operations plus exponentiation, square root, and percentage.
- The interface uses Sezzle purple (`#382757`) and mint (`#9FF4D9`). Outside the expression field, type digits and operators, `Shift+6` for exponentiation, `x` for multiply, `s` for square root, Backspace to delete, Escape to clear, and Enter or `=` to calculate. In the expression field, type normally and press Enter to calculate.
- The page credits the project as: “Calculator created by Elner Ribeiro as a Full Stack Engineer test for Sezzle.”

## Code documentation

See [the code walkthrough](docs/code-walkthrough.md) for the responsibilities of each API, UI, test, browser-check, and configuration source file. See [the architecture and behavior diagrams](docs/architecture.md) for Mermaid flow, state, sequence, activity, and deployment views. Prompts and clarifications are recorded in [docs/prompts.md](docs/prompts.md).

## Test suites

- API tests: `go test ./api/... -cover`
- Unit and component tests: `npm --prefix web test`
- TypeScript/component checks: `npm --prefix web run lint`
- Integration and Playwright browser scenarios: `npm --prefix web run test:bdd` (also exposed as `test:e2e`)
- Storybook build: `npm --prefix web run build-storybook`

Container images are defined by `api/Dockerfile` and `web/Dockerfile`; `compose.yaml` and `scripts/containers.sh` build and manage both services.
