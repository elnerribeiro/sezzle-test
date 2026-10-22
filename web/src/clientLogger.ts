// Configure one structured browser logger for handled calculator failures.
import { configureSync, getConsoleSink, getLogger } from '@logtape/logtape';

configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ['sezzle', 'calculator'], lowestLevel: 'error', sinks: ['console'] },
    { category: ['logtape', 'meta'], lowestLevel: 'fatal', sinks: [] },
  ],
});

const logger = getLogger(['sezzle', 'calculator']);

/** Log one safe failure category without expressions, response bodies, or exceptions. */
export function logClientFailure(errorType: 'network_failure' | 'request_timeout' | 'invalid_response') {
  logger.error('Calculator request failed ({errorType})', { operation: 'calculate', errorType });
}
