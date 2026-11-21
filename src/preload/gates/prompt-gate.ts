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

function isClickOnSendButton(target: Element | null, adapter: SiteAdapter): HTMLElement | null {
  if (!target) return null;

  // 1. Check if target or parent matches any specific send button selector
  for (const sel of adapter.selectors.sendButton) {
    try {
      if (target.matches(sel)) {
        return target as HTMLElement;
      }
      const match = target.closest(sel);
      if (match instanceof HTMLElement) {
        return match;
      }
    } catch {}
  }

  // 2. Check closest button strictly for send/submit identifiers
  const button = target.closest('button');
  if (button) {
    const testId = (button.getAttribute('data-testid') || '').toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const type = (button.getAttribute('type') || '').toLowerCase();

    if (
      testId.includes('send-button') ||
      testId.includes('composer-send') ||
      ariaLabel.includes('send prompt') ||
      ariaLabel.includes('send message') ||
      (ariaLabel === 'send')
    ) {
      return button;
    }

    if (type === 'submit' && (testId.includes('send') || ariaLabel.includes('send') || ariaLabel.includes('submit'))) {
      return button;
    }
  }

  return null;
}

function findSendButtonInDOM(adapter: SiteAdapter): HTMLElement | null {
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

  const buttons = document.querySelectorAll('button');
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (
      testId.includes('send-button') ||
      testId.includes('composer-send') ||
      ariaLabel.includes('send prompt') ||
      ariaLabel.includes('send message')
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
        const sendBtn = findSendButtonInDOM(adapter);
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

      const matchedButton = isClickOnSendButton(target, adapter);
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
