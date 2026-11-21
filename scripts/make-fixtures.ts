import fs from 'fs';
import path from 'path';
import { Jimp } from 'jimp';
import { loadFont } from '@jimp/plugin-print/load-font';
import { SANS_32_BLACK, SANS_32_WHITE } from '@jimp/plugin-print/fonts';

export async function makeFixtures(): Promise<void> {
  const fixturesDir = path.resolve('tests/fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // 1. Text files
  fs.writeFileSync(
    path.join(fixturesDir, 'clean.txt'),
    'This is a clean corporate report with no sensitive markers inside.',
    'utf8'
  );

  fs.writeFileSync(
    path.join(fixturesDir, 'marked.txt'),
    'Attention: This document includes WALLED_SENSITIVE project data.',
    'utf8'
  );

  fs.writeFileSync(
    path.join(fixturesDir, 'marked-split.txt'),
    'Contains zero-width character: WALLED\u200B_SENSITIVE inside.',
    'utf8'
  );

  // 2. PDFs
  const cleanPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 40 >>
stream
BT
/F1 20 Tf
100 700 Td
(Clean annual quarterly report) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000319 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
394
%%EOF`;

  fs.writeFileSync(path.join(fixturesDir, 'clean.pdf'), cleanPdf, 'utf8');

  const markedPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 58 >>
stream
BT
/F1 20 Tf
100 700 Td
(Confidential WALLED_SENSITIVE roadmap) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000337 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
412
%%EOF`;

  fs.writeFileSync(path.join(fixturesDir, 'marked-text-layer.pdf'), markedPdf, 'utf8');

  // 3. Images
  // Clean Image
  const cleanImg = new Jimp({ width: 400, height: 100, color: 0xFFFFFFFF });
  const cleanBuf = await cleanImg.getBuffer('image/png');
  fs.writeFileSync(path.join(fixturesDir, 'clean.png'), cleanBuf);

  // Marked Image (Light Mode)
  const fontBlack = await loadFont(SANS_32_BLACK);
  const markedImg = new Jimp({ width: 450, height: 100, color: 0xFFFFFFFF });
  markedImg.print({ font: fontBlack, x: 20, y: 30, text: 'WALLED_SENSITIVE' });
  const markedBuf = await markedImg.getBuffer('image/png');
  fs.writeFileSync(path.join(fixturesDir, 'marked.png'), markedBuf);

  // Marked Image (Dark Mode)
  const fontWhite = await loadFont(SANS_32_WHITE);
  const darkImg = new Jimp({ width: 450, height: 100, color: 0x121212FF });
  darkImg.print({ font: fontWhite, x: 20, y: 30, text: 'WALLED_SENSITIVE' });
  const darkBuf = await darkImg.getBuffer('image/png');
  fs.writeFileSync(path.join(fixturesDir, 'marked-dark.png'), darkBuf);

  console.log('Successfully generated all test fixtures in tests/fixtures/');
}

if (process.argv[1]?.includes('make-fixtures')) {
  makeFixtures().catch(console.error);
}
