// Component-level behavior tests for keypad input, keyboard shortcuts, API states,
// and accessible user feedback.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it('uses a safe fallback when the API omits its error code and reference', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: {} }), { status: 400 }));
    render(<App />);
    press('1', '+', '1', '=');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Check the expression and try again/i);
    expect(screen.getByRole('alert')).toHaveTextContent('Support reference: unavailable');
  });
});
