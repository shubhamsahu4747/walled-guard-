// Walled Guard Background Service Worker (Manifest V3)
// Communicates with Walled Guard Desktop Native Host via Chrome Native Messaging

const NATIVE_HOST_NAME = 'com.walledguard.native';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'SCAN_PROMPT' || message.action === 'SCAN_FILE') {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Walled Guard Background] Native host communication error:', chrome.runtime.lastError.message);
          // Fail-closed fallback: notify user native host is required
          sendResponse({
            action: 'block',
            decision: 'CANCEL',
            error: chrome.runtime.lastError.message,
            reason: 'NATIVE_HOST_UNAVAILABLE'
          });
          return;
        }

        console.log('[Walled Guard Background] Received decision from Native Host:', response);
        sendResponse(response);
      });
    } catch (err) {
      console.error('[Walled Guard Background] Failed to send native message:', err);
      sendResponse({
        action: 'block',
        decision: 'CANCEL',
        error: String(err),
        reason: 'NATIVE_HOST_ERROR'
      });
    }

    return true; // Keep message channel open for async response
  }

  return false;
});
