// Component-level behavior tests for keypad input, keyboard shortcuts, API states,
// and accessible user feedback.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import * as clientLogger from './clientLogger';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Click keypad keys by their accessible names to exercise the public UI controls. */
function press(...labels: string[]) {
  labels.forEach((label) => fireEvent.click(screen.getByRole('button', { name: label })));
}

describe('calculator', () => {
  it('enters and evaluates a keypad expression through the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: 14 }), { status: 200 }),
    );
    render(<App />);

    press('2', '+', '3', '×', '4', '=');

    expect(await screen.findByRole('status')).toHaveTextContent('14');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/calculate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ expression: '2+3*4' }),
    }));
  });

  it('clears the current entry', () => {
    render(<App />);
    press('8', 'C');
    expect(screen.getByLabelText('Expression')).toHaveValue('');
  });

  it('deletes the last character and inserts square root syntax', () => {
    render(<App />);
    press('8', '⌫', '√', '9', ')');
    expect(screen.getByLabelText('Expression')).toHaveValue('sqrt(9)');
  });

  it('accepts keyboard expression input and calculates with Enter', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: 7 }), { status: 200 }),
    );
    render(<App />);

    for (const key of ['1', '+', '2', '*', '3', 'Enter']) {
      fireEvent.keyDown(window, { key });
    }

    expect(await screen.findByRole('status')).toHaveTextContent('7');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/calculate', expect.objectContaining({
      body: JSON.stringify({ expression: '1+2*3' }),
    }));
  });

  it('maps the physical Shift+6 shortcut to exponentiation', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '6', code: 'Digit6', shiftKey: true });
    expect(screen.getByLabelText('Expression')).toHaveValue('^');
  });

  it('displays the project attribution below the ready status', () => {
    render(<App />);
    const readyStatus = screen.getByText('Ready to calculate').closest('.status-stack');
    const attribution = screen.getByText('Calculator created by Elner Ribeiro as a Full Stack Engineer test for Sezzle.');

    expect(readyStatus).toContainElement(attribution);
    expect(attribution).toHaveClass('status-attribution');
  });

  it('binds Backspace, Escape, and S to delete, clear, and square root', () => {
    render(<App />);
    for (const key of ['8', '9', 'Backspace', 's', '9', ')']) {
      fireEvent.keyDown(window, { key });
    }
    expect(screen.getByLabelText('Expression')).toHaveValue('8sqrt(9)');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByLabelText('Expression')).toHaveValue('');
  });

  it('supports parentheses, exponent, square root, and percent keys', () => {
    render(<App />);
    for (const key of ['(', '2', '+', '3', ')', '^', '2', '√', '5', '%']) {
      expect(screen.getByRole('button', { name: key })).toBeEnabled();
    }
  });

  it('shows a recoverable error with support reference and preserves the expression', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'division_by_zero', correlation_id: 'support-123' },
    }), { status: 400 }));
    render(<App />);
    press('8', '÷', '0', '=');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not calculate/i);
    expect(screen.getByRole('alert')).toHaveTextContent('support-123');
    expect(screen.getByLabelText('Expression')).toHaveValue('8/0');
  });

  it('prevents duplicate submissions while calculation is pending', async () => {
    let finish: (response: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<App />);
    press('1', '+', '1', '=');

    expect(screen.getByRole('button', { name: '=' })).toBeDisabled();
    fireEvent.keyDown(window, { key: '9' });
    expect(screen.getByLabelText('Expression')).toHaveValue('1+1');
    finish(new Response(JSON.stringify({ result: 2 }), { status: 200 }));
    await waitFor(() => expect(screen.getByRole('button', { name: '=' })).toBeEnabled());
  });

  it('shows a recovery message if the service cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network details are hidden'));
    render(<App />);
    press('1', '+', '1', '=');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the calculator/i);
    expect(screen.getByRole('alert')).toHaveTextContent('Support reference: unavailable');
    expect(screen.getByRole('alert')).not.toHaveTextContent('network details');
  });

  it('handles an unreadable success response without exposing raw details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ result: 'not a number' }), { status: 200 }));
    render(<App />);
    press('1', '=');

    expect(await screen.findByRole('alert')).toHaveTextContent(/response could not be read/i);
    expect(screen.getByRole('alert')).toHaveTextContent('Support reference: unavailable');
  });

  it('logs a malformed JSON response with only a safe failure category', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private response details', { status: 200 }));
    const logFailure = vi.spyOn(clientLogger, 'logClientFailure');
    render(<App />);
    press('1', '=');

    expect(await screen.findByRole('alert')).toHaveTextContent(/response could not be read/i);
    expect(logFailure).toHaveBeenCalledTimes(1);
    expect(logFailure).toHaveBeenCalledWith('invalid_response');
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain('private response details');
  });

  it('uses a safe fallback when the API omits its error code and reference', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: {} }), { status: 400 }));
    render(<App />);
    press('1', '+', '1', '=');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Check the expression and try again/i);
    expect(screen.getByRole('alert')).toHaveTextContent('Support reference: unavailable');
  });

  it('lets Enter activate a focused clear button instead of submitting', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<App />);
    press('2', '+', '3');
    screen.getByRole('button', { name: 'C' }).focus();

    await user.keyboard('{Enter}');

    expect(screen.getByLabelText('Expression')).toHaveValue('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets Enter activate focused keypad digit and operator buttons', async () => {
    const user = userEvent.setup();
    render(<App />);

    screen.getByRole('button', { name: '7' }).focus();
    await user.keyboard('{Enter}');
    screen.getByRole('button', { name: '+' }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getByLabelText('Expression')).toHaveValue('7+');
  });

  it('lets Enter follow a focused menu link without calculating', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<App />);
    press('2', '+', '3');
    const homeLink = screen.getByRole('link', { name: 'Sezzle calculator home' });
    homeLink.focus();

    await user.keyboard('{Enter}');

    expect(window.location.hash).toBe('#calculator');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows calculating feedback and recovers after a bounded request timeout', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const logFailure = vi.spyOn(clientLogger, 'logClientFailure');
    render(<App />);
    press('1', '+', '1', '=');

    expect(screen.getByText('Calculating…')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });

    expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i);
    expect(screen.getByLabelText('Expression')).toHaveValue('1+1');
    expect(screen.getByRole('button', { name: 'C' })).toBeEnabled();
    expect(logFailure).toHaveBeenCalledWith('request_timeout');
  });

  it('logs client failures once using a safe category without expression or raw error data', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('private response details'));
    const logFailure = vi.spyOn(clientLogger, 'logClientFailure');
    render(<App />);
    press('1', '+', '1', '=');

    await screen.findByRole('alert');

    expect(logFailure).toHaveBeenCalledTimes(1);
    expect(logFailure).toHaveBeenCalledWith('network_failure');
    expect(JSON.stringify(logFailure.mock.calls)).not.toMatch(/private response details|1\+1/);
  });
});
