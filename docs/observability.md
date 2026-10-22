# Observability and error handling

## API responses

Successful calculations return only the numeric `result`. Error responses use a stable English `error.code` and a `correlation_id`; they do not include parser internals, stack traces, or panic values. The browser uses the stable code to show an action-focused message and displays the correlation ID as the support reference.

## Server logs

The Go server uses the standard structured `log/slog` JSON handler on stderr. Recovered panics are logged once with the safe `internal_error` code and correlation ID; panic contents are deliberately omitted. Startup and shutdown failures use safe error-type labels rather than raw implementation details. Routine client input errors are returned to the caller and do not create noisy server logs.

## Client behavior

The React client validates JSON response envelopes at runtime before reading success results or error fields. Nulls, arrays, wrong result types, and missing/non-string error fields become the same recoverable invalid-response message with an `unavailable` support reference. Network failures, request timeouts, and malformed response payloads receive generic messages. Each handled transport/response exception is logged once through LogTape as a structured error event with only `operation` and `errorType` fields. Expression contents, raw exception messages, and response bodies are excluded. The 10-second request deadline aborts fetch and lets the UI leave its pending state.

The browser logger is configured in `web/src/clientLogger.ts` with the LogTape console sink, JSON Lines formatter, and error-level filtering. Each emitted console record is a single JSON line that preserves the safe operation and error category. LogTape is a zero-dependency, TypeScript-native logger for browser and server runtimes. Client logs remain quiet except for handled request failures. See the [LogTape quick start](https://logtape.org/manual/start) and [release changelog](https://logtape.org/changelog).
