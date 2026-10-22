/**
 * Calculator page: keeps expression entry in React, submits complete expressions
 * to the Go API, and presents safe results and recovery messages.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { logClientFailure } from './clientLogger';
import './app.css';

/** Rows of visible keypad labels; the empty final cell is rendered as a spacer. */
const keys = [
  ['C', '⌫', '(', ')'],
  ['√', '^', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '=', ''],
];

/** Convert display glyphs to the ASCII operators accepted by the API parser. */
const apiOperator: Record<string, string> = { '×': '*', '÷': '/', '−': '-' };

/** Bound how long a request can keep calculator controls in a pending state. */
const requestTimeoutMs = 10_000;

/** Map stable API error codes to user-facing recovery guidance. */
function describeError(code: string) {
  switch (code) {
    case 'division_by_zero': return 'Division by zero is not allowed. Change the expression and try again.';
    case 'invalid_expression': return 'Check the expression and try again.';
    case 'result_out_of_range': return 'The result is outside the supported range. Try smaller numbers.';
    default: return 'Check the expression and try again.';
  }
}

/** Render the full calculator shell, keypad, API feedback, and keyboard controls. */
export default function App() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; reference: string } | null>(null);
  const [pending, setPending] = useState(false);

  /** Apply a keypad action to the expression and clear stale result/error feedback. */
  function enterKey(key: string) {
    setError(null);
    setResult(null);
    if (key === 'C') {
      setExpression('');
    } else if (key === '⌫') {
      setExpression((current) => current.slice(0, -1));
    } else if (key === '√') {
      setExpression((current) => `${current}sqrt(`);
    } else {
      setExpression((current) => `${current}${apiOperator[key] ?? key}`);
    }
  }

  /** Submit the current full expression and translate the API response for the UI. */
  async function calculate(event?: FormEvent) {
    event?.preventDefault();
    if (pending || !expression.trim()) return;
    setPending(true);
    setError(null);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);
    try {
      const response = await fetch('/api/v1/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression }),
        signal: controller.signal,
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        if (timedOut) {
          logClientFailure('request_timeout');
          setError({ message: 'The calculation timed out. Try again.', reference: 'unavailable' });
        } else {
          logClientFailure('invalid_response');
          setError({ message: 'The response could not be read. Try again.', reference: 'unavailable' });
        }
        return;
      }
      if (!response.ok) {
        const details = payload as { error?: { code?: string; correlation_id?: string } };
        setError({
          message: describeError(details.error?.code ?? ''),
          reference: details.error?.correlation_id ?? 'unavailable',
        });
        return;
      }
      const data = payload as { result?: number };
      if (typeof data.result !== 'number' || !Number.isFinite(data.result)) {
        setError({ message: 'The response could not be read. Try again.', reference: 'unavailable' });
        return;
      }
      setResult(String(data.result));
    } catch {
      if (timedOut) {
        logClientFailure('request_timeout');
        setError({ message: 'The calculation timed out. Try again.', reference: 'unavailable' });
      } else {
        logClientFailure('network_failure');
        setError({ message: 'Could not reach the calculator. Check your connection and try again.', reference: 'unavailable' });
      }
    } finally {
      window.clearTimeout(timeout);
      setPending(false);
    }
  }

  useEffect(() => {
    // Global shortcuts apply outside editable fields; focused inputs retain normal editing.
    function handleKeyboard(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || pending) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      // Preserve native Enter activation for focused buttons and links.
      if (event.key === 'Enter' && target?.closest('button, a, [role="button"], select, summary')) return;

      let key: string | undefined;
      // On common US layouts, exponentiation is typed with Shift+6. Prefer
      // the physical key shortcut when a browser reports the unshifted key.
      if (event.shiftKey && event.code === 'Digit6') key = '^';
      else if (/^[0-9.]$/.test(event.key) || /^[+\-*/^%()]$/.test(event.key)) key = event.key;
      else if (event.key === 'x' || event.key === 'X') key = '×';
      else if (event.key.toLowerCase() === 's') key = '√';
      else if (event.key === 'Backspace') key = '⌫';
      else if (event.key === 'Escape') key = 'C';

      if (key) {
        event.preventDefault();
        enterKey(key);
      } else if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault();
        void calculate();
      }
    }

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [expression, pending]);

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="Main menu">
        <a className="brand-mark" href="#calculator" aria-label="Sezzle calculator home">S</a>
        <nav>
          <a className="nav-item active" href="#calculator" aria-current="page">
            <span className="nav-icon" aria-hidden="true">＋</span>
            <span>Calculator</span>
          </a>
        </nav>
        <div className="rail-footer" aria-hidden="true">01</div>
      </aside>

      <main id="calculator" className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>Calculator</strong></div>
          <div className="status-stack">
            <span className="api-indicator"><span /> {pending ? 'Calculating…' : 'Ready to calculate'}</span>
            <span className="api-indicator status-attribution">Calculator created by Elner Ribeiro as a Full Stack Engineer test for Sezzle.</span>
          </div>
        </header>

        <section className="calculator-page" aria-labelledby="page-title">
          <div className="page-intro">
            <div className="eyebrow">PRECISION, SIMPLIFIED</div>
            <h1 id="page-title">Calculator</h1>
            <p>Work through an expression, one key at a time.</p>
          </div>

          <form className="calculator-card" onSubmit={calculate}>
            <div className="display-wrap">
              <label htmlFor="expression">Expression</label>
              <input
                id="expression"
                aria-label="Expression"
                value={expression}
                onChange={(event) => { setExpression(event.target.value); setResult(null); setError(null); }}
                placeholder="0"
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
              />
              <div className="result-line" aria-live="polite">
                <span>RESULT</span>
                <output role="status">{result ?? '—'}</output>
              </div>
            </div>

            {error && (
              <div className="error-message" role="alert">
                <span className="error-symbol" aria-hidden="true">!</span>
                <div><strong>Could not calculate.</strong> {error.message}<small>Support reference: {error.reference}</small></div>
              </div>
            )}

            <div className="keypad" aria-label="Calculator keypad">
              {keys.flatMap((row, rowIndex) => row.map((key, columnIndex) => {
                if (!key) return <span className="key-spacer" key={`space-${rowIndex}-${columnIndex}`} />;
                const isOperator = ['÷', '×', '−', '+', '^', '%', '√'].includes(key);
                const classNames = ['key', isOperator ? 'key-operator' : '', key === '=' ? 'key-equals' : '', key === 'C' || key === '⌫' ? 'key-utility' : ''].filter(Boolean).join(' ');
                return <button
                  className={classNames}
                  key={key}
                  type={key === '=' ? 'submit' : 'button'}
                  aria-label={key}
                  disabled={pending || (key === '=' && !expression.trim())}
                  onClick={key === '=' ? undefined : () => enterKey(key)}
                >{key === '−' ? '−' : key}</button>;
              }))}
            </div>
            <footer className="card-foot">
              <span><kbd>Enter</kbd> calculate <kbd>⌫</kbd> delete <kbd>Esc</kbd> clear</span>
              <span>Type digits and operators · <kbd>Shift+6</kbd> exponent · <kbd>S</kbd> square root</span>
            </footer>
          </form>
          <div className="page-note"><span className="note-dot" /> Results are calculated securely by your local calculator service.</div>
        </section>
      </main>
    </div>
  );
}
