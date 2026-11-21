import { SiteAdapter } from '../../sites/types';
import { GuardBridge } from '../bridge';
import { globalGateState } from './gate-state';

async function scanFileList(
  files: FileList | File[],
  adapter: SiteAdapter,
  bridge: GuardBridge
): Promise<boolean> {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const buffer = await file.arrayBuffer();
      const decision = await bridge.scan({
        site: adapter.id,
        kind: 'file',
        name: file.name,
        mime: file.type,
        data: buffer
      });

      if (decision.action === 'block') {
        return false;
      }
    } catch {
      // On read failure: fail closed
      return false;
    }
  }
  return true;
}

export function attachFileGate(adapter: SiteAdapter, bridge: GuardBridge): void {
  // 1. File Input Picker Listener (Change event, Capture Phase)
  window.addEventListener(
    'change',
    async (event: Event) => {
      const target = event.target as Element | null;
      if (!(target instanceof HTMLInputElement) || target.type !== 'file') {
        return;
      }

      if (globalGateState.isBypassed(target) || globalGateState.isBypassed(event)) {
        globalGateState.clearBypass(target);
        return;
      }

      const files = target.files;
      if (!files || files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      globalGateState.setStatus('HELD');

      const allowed = await scanFileList(files, adapter, bridge);

      if (allowed) {
        globalGateState.setStatus('RELEASED');
        globalGateState.markBypassed(target);
        const replayEvent = new Event('change', { bubbles: true, cancelable: true });
        target.dispatchEvent(replayEvent);
      } else {
        // Blocked: clear input so user can re-select files
        globalGateState.setStatus('BLOCKED');
        target.value = '';
      }
    },
    { capture: true }
  );

  // 2. Drag and Drop Listener (Drop event, Capture Phase)
  window.addEventListener(
    'drop',
    async (event: DragEvent) => {
      if (globalGateState.isBypassed(event)) {
        globalGateState.clearBypass(event);
        return;
      }

      const dataTransfer = event.dataTransfer;
      if (!dataTransfer || !dataTransfer.files || dataTransfer.files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      globalGateState.setStatus('HELD');

      const allowed = await scanFileList(dataTransfer.files, adapter, bridge);

      if (allowed) {
        globalGateState.setStatus('RELEASED');
        const target = event.target as Element | null;
        if (target) {
          const replayEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer
          });
          globalGateState.markBypassed(replayEvent);
          target.dispatchEvent(replayEvent);
        }
      } else {
        // Discard dropped files
        globalGateState.setStatus('BLOCKED');
      }
    },
    { capture: true }
  );

  // 3. Clipboard Paste Listener (Paste event, Capture Phase)
  window.addEventListener(
    'paste',
    async (event: ClipboardEvent) => {
      if (globalGateState.isBypassed(event)) {
        globalGateState.clearBypass(event);
        return;
      }

      const clipboardData = event.clipboardData;
      if (!clipboardData || !clipboardData.files || clipboardData.files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      globalGateState.setStatus('HELD');

      const allowed = await scanFileList(clipboardData.files, adapter, bridge);

      if (allowed) {
        globalGateState.setStatus('RELEASED');
        const target = event.target as Element | null;
        if (target) {
          const replayEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData
          });
          globalGateState.markBypassed(replayEvent);
          target.dispatchEvent(replayEvent);
        }
      } else {
        // Discard pasted files
        globalGateState.setStatus('BLOCKED');
      }
    },
    { capture: true }
  );
}
