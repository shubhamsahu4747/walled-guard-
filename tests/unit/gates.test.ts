import { describe, it, expect, beforeEach } from 'vitest';
import { createGateStateManager } from '../../src/preload/gates/gate-state';
import { chatgptAdapter } from '../../src/sites/chatgpt';
import { perplexityAdapter } from '../../src/sites/perplexity';

describe('Gate State Machine & Bypass WeakSet', () => {
  let state: ReturnType<typeof createGateStateManager>;

  beforeEach(() => {
    state = createGateStateManager();
  });

  it('initializes with IDLE status', () => {
    expect(state.getStatus()).toBe('IDLE');
  });

  it('updates gate status through lifecycle', () => {
    state.setStatus('HELD');
    expect(state.getStatus()).toBe('HELD');

    state.setStatus('AWAITING');
    expect(state.getStatus()).toBe('AWAITING');

    state.setStatus('RELEASED');
    expect(state.getStatus()).toBe('RELEASED');

    state.setStatus('BLOCKED');
    expect(state.getStatus()).toBe('BLOCKED');
  });

  it('marks and clears objects in bypass WeakSet', () => {
    const dummyEvent = { type: 'keydown' };

    expect(state.isBypassed(dummyEvent)).toBe(false);

    state.markBypassed(dummyEvent);
    expect(state.isBypassed(dummyEvent)).toBe(true);

    state.clearBypass(dummyEvent);
    expect(state.isBypassed(dummyEvent)).toBe(false);
  });
});

describe('Site Adapters Prompt Extraction', () => {
  it('extracts text from contenteditable element in ChatGPT adapter', () => {
    const fakeDoc = {
      querySelector: (sel: string) => {
        if (sel === '#prompt-textarea') {
          return {
            tagName: 'DIV',
            isContentEditable: true,
            innerText: 'Explain quantum computing WALLED_SENSITIVE'
          };
        }
        return null;
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = chatgptAdapter.getPromptText(fakeDoc as any);
    expect(text).toBe('Explain quantum computing WALLED_SENSITIVE');
  });

  it('extracts text from textarea in Perplexity adapter', () => {
    const fakeDoc = {
      querySelector: (sel: string) => {
        if (sel === 'textarea') {
          return {
            tagName: 'TEXTAREA',
            value: 'Search for recent papers'
          };
        }
        return null;
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = perplexityAdapter.getPromptText(fakeDoc as any);
    expect(text).toBe('Search for recent papers');
  });
});
