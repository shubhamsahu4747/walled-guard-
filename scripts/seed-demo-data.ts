import crypto from 'crypto';
import { getEventsRepo, checkDbHealth, getMemoryRepo } from '../src/main/store/db';
import { NewEvent } from '../src/main/store/schema';

export async function seedDemoData(targetCount = 300): Promise<void> {
  const health = await checkDbHealth();
  const repo = health === 'up' ? getEventsRepo() : getMemoryRepo();
  console.log(`Target database status: ${health}. Seeding ~${targetCount} events...`);

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const sampleFileNames = [
    'Q3-board-notes.pdf',
    'screenshot-0412.png',
    'scan-contract.pdf',
    'export.txt',
    'customer_list.csv',
    'internal-memo.pdf',
    'architecture-diagram.png',
    'credentials_backup.txt',
    'financials_q4.pdf'
  ];

  const sampleSnippets = [
    'Summarise the attached notes in five bullets',
    'Draft a short intro for our product update email.',
    'Summarise the Q3 numbers WALLED_SENSITIVE budget by team and projected growth',
    'Review the attached contract terms and flags',
    'What are the key architectural trade-offs in this design?',
    'Draft an email announcement regarding WALLED_SENSITIVE system migration',
    'Analyze this error trace and provide a patch'
  ];

  const events: NewEvent[] = [];

  for (let i = 0; i < targetCount; i++) {
    const ageMs = Math.random() * thirtyDaysMs;
    const date = new Date(now - ageMs);

    const site = Math.random() < 0.66 ? 'chatgpt' : 'perplexity';
    const isFile = Math.random() < 0.25;
    const kind = isFile ? 'file' : 'prompt';
    const isDetected = Math.random() < 0.15;

    let fileType: 'text' | 'pdf' | 'image' | null = null;
    let fileName: string | null = null;
    let sizeBytes = Math.floor(Math.random() * 500) + 50;
    let detectionSource: 'plain-text' | 'text-layer' | 'ocr' | 'fuzzy' | null = null;
    let decision: 'clean' | 'continued' | 'cancelled' | 'scan_failed' = 'clean';
    let snippet: string | null = null;

    if (isFile) {
      fileName = sampleFileNames[Math.floor(Math.random() * sampleFileNames.length)];
      if (fileName.endsWith('.pdf')) fileType = 'pdf';
      else if (fileName.endsWith('.png')) fileType = 'image';
      else fileType = 'text';

      sizeBytes = Math.floor(Math.random() * 2000000) + 5000;
    } else {
      snippet = sampleSnippets[Math.floor(Math.random() * sampleSnippets.length)];
    }

    if (isDetected) {
      if (isFile) {
        if (fileType === 'pdf') detectionSource = Math.random() < 0.6 ? 'text-layer' : 'ocr';
        else if (fileType === 'image') detectionSource = Math.random() < 0.8 ? 'ocr' : 'fuzzy';
        else detectionSource = 'plain-text';
      } else {
        detectionSource = 'plain-text';
      }

      decision = Math.random() < 0.62 ? 'cancelled' : 'continued';
    } else {
      if (isFile && Math.random() < 0.04) {
        decision = 'scan_failed';
      } else {
        decision = 'clean';
      }
    }

    const contentHash = crypto
      .createHash('sha256')
      .update(`${fileName || snippet || 'item'}_${i % 30}`)
      .digest('hex');

    events.push({
      ts: date,
      site,
      kind,
      fileType,
      fileName,
      sizeBytes,
      detected: isDetected,
      detectionSource,
      decision,
      scanMs: isFile ? Math.floor(Math.random() * 2000) + 50 : Math.floor(Math.random() * 15) + 2,
      contentHash,
      snippet: isDetected ? snippet?.slice(0, 80) : null
    });
  }

  // Insert in chronological order
  events.sort((a, b) => new Date(a.ts || 0).getTime() - new Date(b.ts || 0).getTime());
  for (const ev of events) {
    await repo.insert(ev);
  }

  console.log(`Successfully seeded ${events.length} realistic events into store!`);
}

if (process.argv[1]?.includes('seed-demo-data')) {
  seedDemoData().catch(console.error);
}
