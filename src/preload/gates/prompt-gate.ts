import { SiteAdapter } from '../../sites/types';
import { GuardBridge } from '../bridge';
import { globalGateState } from './gate-state';

function isEditorElement(el: Element | null, adapter: SiteAdapter): boolean {
  if (!el) return false;
  for (const sel of adapter.selectors.editor) {
    try {
      if (el.matches(sel) || el.closest(sel)) {
        return true;
      }
    } catch {}
  }
  if (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable) ||
    el.closest('[contenteditable="true"]') ||
    el.closest('textarea') ||
    el.closest('[role="textbox"]')
  ) {
    return true;
  }
  return false;
}

function findSendButton(adapter: SiteAdapter, target?: Element | null): HTMLElement | null {
  if (target) {
    for (const sel of adapter.selectors.sendButton) {
      try {
        const match = target.matches(sel) ? target : target.closest(sel);
        if (match instanceof HTMLElement) return match;
      } catch {}
    }
    const closestBtn = target.closest('button');
    if (closestBtn) return closestBtn;
  }

  for (const sel of adapter.selectors.sendButton) {
    try {
      const el = document.querySelector(sel);
      if (el instanceof HTMLElement) {
        return el;
      }
      const buttonInside = el?.closest('button') || el?.querySelector('button');
      if (buttonInside instanceof HTMLElement) {
        return buttonInside;
      }
    } catch {}
  }

  // Fallback: search all buttons on page
  const buttons = document.querySelectorAll('button');
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const type = (btn.getAttribute('type') || '').toLowerCase();
    if (
      testId.includes('send') ||
      testId.includes('submit') ||
      ariaLabel.includes('send') ||
      ariaLabel.includes('submit') ||
      type === 'submit'
    ) {
      return btn;
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

      const promptText = adapter.getPromptText(document, target);
      if (!promptText || !promptText.trim()) {
        return;
      }

      // Intercept and Hold
      event.preventDefault();
      event.stopImmediatePropagation();
      globalGateState.setStatus('HELD');
      globalGateState.setStatus('AWAITING');

      console.info(`[WalledGuard Preload] Intercepting prompt via Enter key (${promptText.length} chars)`);

      const decision = await bridge.scan({
        site: adapter.id,
        kind: 'prompt',
        data: promptText
      });

      if (decision.action === 'allow') {
        globalGateState.setStatus('RELEASED');
        // Replay via send button click or synthetic Enter
        const sendBtn = findSendButton(adapter);
        if (sendBtn && !sendBtn.hasAttribute('disabled')) {
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

      const matchedButton = findSendButton(adapter, target);
      if (!matchedButton) {
        return;
      }

      const promptText = adapter.getPromptText(document, document.activeElement || target);
      if (!promptText || !promptText.trim()) {
        return;
      }

      // Intercept and Hold
      event.preventDefault();
      event.stopImmediatePropagation();
      globalGateState.setStatus('HELD');
      globalGateState.setStatus('AWAITING');

      console.info(`[WalledGuard Preload] Intercepting prompt via Send button (${promptText.length} chars)`);

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
