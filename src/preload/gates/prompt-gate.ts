import { SiteAdapter } from '../../sites/types';
import { GuardBridge } from '../bridge';
import { globalGateState } from './gate-state';

function isEditorElement(el: Element | null, adapter: SiteAdapter): boolean {
  if (!el) return false;
  for (const sel of adapter.selectors.editor) {
    if (el.matches(sel) || el.closest(sel)) {
      return true;
    }
  }
  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) {
    return true;
  }
  return false;
}

function findSendButton(adapter: SiteAdapter): HTMLButtonElement | null {
  for (const sel of adapter.selectors.sendButton) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLButtonElement) {
      return el;
    }
    const buttonInside = el?.closest('button') || el?.querySelector('button');
    if (buttonInside instanceof HTMLButtonElement) {
      return buttonInside;
    }
  }
  return null;
}

export function attachPromptGate(adapter: SiteAdapter, bridge: GuardBridge): void {
  // 1. Enter Key Listener (Capture Phase)
  window.addEventListener(
    'keydown',
    async (event: KeyboardEvent) => {
      // Allow Shift+Enter (multiline), IME composition, or non-Enter keys
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) {
        return;
      }

      // Check one-shot bypass
      if (globalGateState.isBypassed(event)) {
        globalGateState.clearBypass(event);
        return;
      }

      const target = event.target as Element | null;
      if (!isEditorElement(target, adapter)) {
        return;
      }

      // Intercept and Hold
      event.preventDefault();
      event.stopImmediatePropagation();
      globalGateState.setStatus('HELD');

      const promptText = adapter.getPromptText(document);
      if (!promptText.trim()) {
        globalGateState.setStatus('IDLE');
        return;
      }

      globalGateState.setStatus('AWAITING');
      const decision = await bridge.scan({
        site: adapter.id,
        kind: 'prompt',
        data: promptText
      });

      if (decision.action === 'allow') {
        globalGateState.setStatus('RELEASED');
        // Replay via send button click or synthetic Enter
        const sendBtn = findSendButton(adapter);
        if (sendBtn && !sendBtn.disabled) {
          globalGateState.markBypassed(sendBtn);
          sendBtn.click();
        } else if (target) {
          const replayEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          globalGateState.markBypassed(replayEvent);
          target.dispatchEvent(replayEvent);
        }
      } else {
        // Cancelled: prompt remains in the editor so the user can edit or retry
        globalGateState.setStatus('BLOCKED');
      }
    },
    { capture: true }
  );

  // 2. Send Button Click Listener (Capture Phase)
  window.addEventListener(
    'click',
    async (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      // Check one-shot bypass
      if (globalGateState.isBypassed(event) || globalGateState.isBypassed(target)) {
        globalGateState.clearBypass(target);
        return;
      }

      // Check if target is or is inside a send button
      let matchedButton: HTMLElement | null = null;
      for (const sel of adapter.selectors.sendButton) {
        const match = target.matches(sel) ? target : target.closest(sel);
        if (match instanceof HTMLElement) {
          matchedButton = match;
          break;
        }
      }

      if (!matchedButton) {
        return;
      }

      // Intercept and Hold
      event.preventDefault();
      event.stopImmediatePropagation();
      globalGateState.setStatus('HELD');

      const promptText = adapter.getPromptText(document);
      if (!promptText.trim()) {
        globalGateState.setStatus('IDLE');
        return;
      }

      globalGateState.setStatus('AWAITING');
      const decision = await bridge.scan({
        site: adapter.id,
        kind: 'prompt',
        data: promptText
      });

      if (decision.action === 'allow') {
        globalGateState.setStatus('RELEASED');
        globalGateState.markBypassed(matchedButton);
        matchedButton.click();
      } else {
        // Cancelled: prompt remains in the editor
        globalGateState.setStatus('BLOCKED');
      }
    },
    { capture: true }
  );
}
