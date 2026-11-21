#!/usr/bin/env node
/**
 * Walled Guard - Chrome Native Messaging Host
 * Communicates with Chrome/Edge extension over stdio.
 * Displays native desktop dialogs and enforces DLP policies.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SENSITIVE_MARKER = 'WALLED_SENSITIVE';

// ==========================================
// 1. Native Windows Confirmation Dialog
// ==========================================
function showNativeDialog(kind, identifier, snippetText) {
  const isPrompt = kind === 'prompt';
  const typeLabel = isPrompt ? 'text prompt' : 'file';
  const title = 'Sensitive content detected';
  const message = `Sensitive marker found in a ${typeLabel}`;

  let cleanSnippet = (snippetText || '').replace(/[\r\n]+/g, ' ').trim();
  if (cleanSnippet.length > 80) cleanSnippet = cleanSnippet.slice(0, 80) + '...';

  const detail = isPrompt
    ? `Prompt: "${cleanSnippet}"\n\nContinue to send it, or Cancel to keep editing.`
    : `Name: ${identifier}\n\nContinue to upload this file, or Cancel to keep it from leaving this computer.`;

  const fullText = `${message}\n\n${detail}`;
  const escapedText = fullText.replace(/"/g, '`"').replace(/\$/g, '`$');

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    $result = [System.Windows.Forms.MessageBox]::Show(
      "${escapedText}",
      "${title}",
      [System.Windows.Forms.MessageBoxButtons]::OKCancel,
      [System.Windows.Forms.MessageBoxIcon]::Warning,
      [System.Windows.Forms.MessageBoxDefaultButton]::Button2
    )
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) { exit 0 } else { exit 1 }
  `;

  try {
    const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
      encoding: 'utf8'
    });
    return res.status === 0 ? 'CONTINUE' : 'CANCEL';
  } catch (err) {
    // Fail closed on error
    return 'CANCEL';
  }
}

// ==========================================
// 2. Inspection Logic
// ==========================================
function scanText(text) {
  if (!text || typeof text !== 'string') return false;
  return text.includes(SENSITIVE_MARKER);
}

function scanFileBuffer(buffer) {
  if (!buffer) return false;
  const str = buffer.toString('utf8');
  if (str.includes(SENSITIVE_MARKER)) return true;

  // Also check raw latin1
  const latin1 = buffer.toString('latin1');
  return latin1.includes(SENSITIVE_MARKER);
}

function processMessage(msg) {
  if (msg.action === 'SCAN_PROMPT') {
    const promptText = msg.text || '';
    const hasMarker = scanText(promptText);

    if (!hasMarker) {
      return { action: 'allow', decision: 'CONTINUE', markerFound: false };
    }

    const userDecision = showNativeDialog('prompt', 'Prompt', promptText);
    return {
      action: userDecision === 'CONTINUE' ? 'allow' : 'block',
      decision: userDecision,
      markerFound: true
    };
  }

  if (msg.action === 'SCAN_FILE') {
    const fileName = msg.fileName || 'unknown file';
    let hasMarker = false;

    if (msg.isText) {
      hasMarker = scanText(msg.data);
    } else if (msg.data) {
      const buffer = Buffer.from(msg.data, 'base64');
      hasMarker = scanFileBuffer(buffer);
    }

    if (!hasMarker) {
      return { action: 'allow', decision: 'CONTINUE', markerFound: false };
    }

    const userDecision = showNativeDialog('file', fileName, fileName);
    return {
      action: userDecision === 'CONTINUE' ? 'allow' : 'block',
      decision: userDecision,
      markerFound: true
    };
  }

  return { action: 'allow', decision: 'CONTINUE' };
}

// ==========================================
// 3. Stdio Native Messaging Protocol
// ==========================================
let bufferQueue = Buffer.alloc(0);

process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    bufferQueue = Buffer.concat([bufferQueue, chunk]);

    while (bufferQueue.length >= 4) {
      const msgLen = bufferQueue.readUInt32LE(0);
      if (bufferQueue.length < 4 + msgLen) {
        break; // Wait for full message
      }

      const msgBytes = bufferQueue.subarray(4, 4 + msgLen);
      bufferQueue = bufferQueue.subarray(4 + msgLen);

      try {
        const message = JSON.parse(msgBytes.toString('utf8'));
        const response = processMessage(message);
        sendResponse(response);
      } catch (err) {
        sendResponse({ action: 'block', decision: 'CANCEL', error: String(err) });
      }
    }
  }
});

function sendResponse(response) {
  const jsonStr = JSON.stringify(response);
  const jsonBuffer = Buffer.from(jsonStr, 'utf8');
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(jsonBuffer.length, 0);

  process.stdout.write(lenBuffer);
  process.stdout.write(jsonBuffer);
}
