# Observability and error handling

## API responses

Successful calculations return only the numeric `result`. Error responses use a stable English `error.code` and a `correlation_id`; they do not include parser internals, stack traces, or panic values. The browser uses the stable code to show an action-focused message and displays the correlation ID as the support reference.

## Server logs

The Go server uses the standard structured `log/slog` JSON handler on stderr. Recovered panics are logged once with the safe `internal_error` code and correlation ID; panic contents are deliberately omitted. Startup and shutdown failures use safe error-type labels rather than raw implementation details. Routine client input errors are returned to the caller and do not create noisy server logs.

## Client behavior

The React client maps known API error codes to user-facing recovery guidance. Network failures and malformed success payloads receive generic messages with an `unavailable` support reference. Raw response text, exceptions, and implementation details are never rendered to the page.
