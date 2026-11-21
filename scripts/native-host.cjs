#!/usr/bin/env node
/**
 * Walled Guard - Chrome Native Messaging Host
 * Communicates with Chrome/Edge extension over stdio.
 * Displays native desktop dialogs and logs events into PostgreSQL.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const SENSITIVE_MARKER = 'WALLED_SENSITIVE';

// ==========================================
// 1. PostgreSQL Database Logger
// ==========================================
function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.startsWith('#') || !line.includes('=')) continue;
        const eqIdx = line.indexOf('=');
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key === 'DATABASE_URL') return val;
      }
    }
  } catch {}
  return null;
}

let pgPool = null;

function getPgPool() {
  if (!pgPool) {
    try {
      const dbUrl = getDatabaseUrl();
      if (!dbUrl) return null;
      pgPool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000
      });
      pgPool.on('error', () => {
        // Suppress unhandled pool error
      });
    } catch {
      return null;
    }
  }
  return pgPool;
}

function computeHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function logEventToDb(event) {
  try {
    const pool = getPgPool();
    if (!pool) return;
    const query = `
      INSERT INTO events (
        ts, site, kind, source, file_type, file_name, size_bytes,
        detected, detection_source, decision, scan_ms,
        content_hash, snippet
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;
    const values = [
      event.ts || new Date(),
      event.site || 'chatgpt',
      event.kind || 'prompt',
      event.source || 'browser',
      event.file_type || null,
      event.file_name || null,
      event.size_bytes || 0,
      event.detected === true,
      event.detection_source || null,
      event.decision || 'clean',
      event.scan_ms || 0,
      event.content_hash || '',
      event.snippet || null
    ];
    await pool.query(query, values);
  } catch (err) {
    // Fallback: append to local file in case Postgres connection fails
    try {
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.appendFileSync(
        path.join(dataDir, 'events-fallback.jsonl'),
        JSON.stringify(event) + '\n'
      );
    } catch {}
  }
}

// ==========================================
// 2. Native Windows Confirmation Dialog
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
// 3. Inspection Logic
// ==========================================
function scanText(text) {
  if (!text || typeof text !== 'string') return false;
  return text.includes(SENSITIVE_MARKER);
}

function scanFileBuffer(buffer) {
  if (!buffer) return false;
  const str = buffer.toString('utf8');
  if (str.includes(SENSITIVE_MARKER)) return true;

  const latin1 = buffer.toString('latin1');
  return latin1.includes(SENSITIVE_MARKER);
}

async function processMessage(msg) {
  const startTime = Date.now();

  if (msg.action === 'SCAN_PROMPT' || msg.action === 'LOG_CLEAN_PROMPT') {
    const promptText = msg.text || '';
    const contentHash = computeHash(promptText);
    const sizeBytes = Buffer.byteLength(promptText, 'utf8');
    const hasMarker = scanText(promptText);

    if (!hasMarker || msg.action === 'LOG_CLEAN_PROMPT') {
      await logEventToDb({
        ts: new Date(),
        site: msg.site || 'chatgpt',
        kind: 'prompt',
        file_type: null,
        file_name: null,
        size_bytes: sizeBytes,
        detected: false,
        detection_source: null,
        decision: 'clean',
        scan_ms: Date.now() - startTime,
        content_hash: contentHash,
        snippet: null
      });

      return { action: 'allow', decision: 'CONTINUE', markerFound: false };
    }

    const userDecision = showNativeDialog('prompt', 'Prompt', promptText);
    const decisionReason = userDecision === 'CONTINUE' ? 'continued' : 'cancelled';

    await logEventToDb({
      ts: new Date(),
      site: msg.site || 'chatgpt',
      kind: 'prompt',
      file_type: null,
      file_name: null,
      size_bytes: sizeBytes,
      detected: true,
      detection_source: 'plain-text',
      decision: decisionReason,
      scan_ms: Date.now() - startTime,
      content_hash: contentHash,
      snippet: null
    });

    return {
      action: userDecision === 'CONTINUE' ? 'allow' : 'block',
      decision: userDecision,
      markerFound: true
    };
  }

  if (msg.action === 'SCAN_FILE') {
    const fileName = msg.fileName || 'unknown file';
    let rawBuffer = null;
    let sizeBytes = 0;
    let hasMarker = false;

    if (msg.isText) {
      rawBuffer = Buffer.from(msg.data || '', 'utf8');
      sizeBytes = rawBuffer.length;
      hasMarker = scanText(msg.data);
    } else if (msg.data) {
      rawBuffer = Buffer.from(msg.data, 'base64');
      sizeBytes = rawBuffer.length;
      hasMarker = scanFileBuffer(rawBuffer);
    }

    const contentHash = rawBuffer ? computeHash(rawBuffer) : computeHash(fileName);
    const ext = fileName.toLowerCase().split('.').pop() || '';
    const fileType = ext === 'pdf' ? 'pdf' : (['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : 'text');
    const detectionSource = msg.isText ? 'plain-text' : (fileType === 'pdf' ? 'text-layer' : 'ocr');

    if (!hasMarker) {
      await logEventToDb({
        ts: new Date(),
        site: msg.site || 'chatgpt',
        kind: 'file',
        file_type: fileType,
        file_name: fileName,
        size_bytes: sizeBytes,
        detected: false,
        detection_source: null,
        decision: 'clean',
        scan_ms: Date.now() - startTime,
        content_hash: contentHash,
        snippet: null
      });

      return { action: 'allow', decision: 'CONTINUE', markerFound: false };
    }

    const userDecision = showNativeDialog('file', fileName, fileName);
    const decisionReason = userDecision === 'CONTINUE' ? 'continued' : 'cancelled';

    await logEventToDb({
      ts: new Date(),
      site: msg.site || 'chatgpt',
      kind: 'file',
      file_type: fileType,
      file_name: fileName,
      size_bytes: sizeBytes,
      detected: true,
      detection_source: detectionSource,
      decision: decisionReason,
      scan_ms: Date.now() - startTime,
      content_hash: contentHash,
      snippet: null
    });

    return {
      action: userDecision === 'CONTINUE' ? 'allow' : 'block',
      decision: userDecision,
      markerFound: true
    };
  }

  return { action: 'allow', decision: 'CONTINUE' };
}

// ==========================================
// 4. Stdio Native Messaging Protocol
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
        processMessage(message)
          .then((response) => {
            sendResponse(response);
          })
          .catch((err) => {
            sendResponse({ action: 'block', decision: 'CANCEL', error: String(err) });
          });
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
