import fs from 'fs';
import path from 'path';

async function download() {
  const targetDir = path.resolve('resources/tessdata');
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, 'eng.traineddata');

  console.log('Downloading eng.traineddata from GitHub...');
  const res = await fetch('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const buffer = await res.arrayBuffer();
  fs.writeFileSync(targetPath, Buffer.from(buffer));
  console.log(`Successfully saved eng.traineddata (${(buffer.byteLength / (1024 * 1024)).toFixed(2)} MB) to ${targetPath}`);
}

download().catch((err) => {
  console.error('Failed to download traineddata:', err);
  process.exit(1);
});
