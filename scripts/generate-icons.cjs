const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');

async function generate() {
  await app.whenReady();

  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: 512px;
          height: 512px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
        }
      </style>
    </head>
    <body>
      <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#020617" />
          </linearGradient>
          <linearGradient id="shieldGrad" x1="128" y1="80" x2="384" y2="440" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="50%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#047857" />
          </linearGradient>
          <linearGradient id="borderGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.6" />
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.2" />
          </linearGradient>
          <filter id="glow" x="60" y="40" width="392" height="432" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Rounded Background Squircle -->
        <rect x="16" y="16" width="480" height="480" rx="108" fill="url(#bgGrad)" stroke="url(#borderGrad)" stroke-width="8" />

        <!-- Shield Glow Backdrop -->
        <path d="M256 440C256 440 392 368 392 232V112L256 60L120 112V232C120 368 256 440 256 440Z" fill="#10b981" opacity="0.15" filter="url(#glow)"/>

        <!-- Outer Shield -->
        <path d="M256 430C256 430 384 362 384 234V120L256 70L128 120V234C128 362 256 430 256 430Z" fill="url(#shieldGrad)" stroke="#6ee7b7" stroke-width="6"/>

        <!-- Inner Protective Ring / Wall -->
        <path d="M256 392C256 392 352 338 352 236V146L256 106L160 146V236C160 338 256 392 256 392Z" fill="#042f2e" stroke="#10b981" stroke-width="5" opacity="0.95"/>

        <!-- Stylized Fortress W / Check Emblem -->
        <path d="M196 230L236 270L316 190" stroke="#ffffff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Tiny Core Node -->
        <circle cx="256" cy="336" r="14" fill="#34d399" />
      </svg>
    </body>
    </html>
  `;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Wait for rendering
  await new Promise((r) => setTimeout(r, 500));

  const image = await win.capturePage();
  const png512 = image.toPNG();

  const resourcesDir = path.join(__dirname, '../resources');
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }

  const pngPath = path.join(resourcesDir, 'icon.png');
  fs.writeFileSync(pngPath, png512);
  console.log('Saved 512x512 PNG to', pngPath);

  // Generate 256, 128, 64, 48, 32, 16 sizes for multi-resolution ICO
  const sizes = [256, 128, 64, 48, 32, 16];
  const pngBuffers = [];
  for (const size of sizes) {
    const resized = image.resize({ width: size, height: size, quality: 'best' });
    pngBuffers.push({
      size,
      buffer: resized.toPNG()
    });
  }

  // Build Windows ICO file with multiple resolutions
  // ICONDIR header: 6 bytes
  // ICONDIRENTRY: 16 bytes each
  const count = pngBuffers.length;
  const headerSize = 6 + 16 * count;
  let currentOffset = headerSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Count

  for (let i = 0; i < count; i++) {
    const item = pngBuffers[i];
    const entryOffset = 6 + i * 16;
    header.writeUInt8(item.size === 256 ? 0 : item.size, entryOffset + 0); // Width
    header.writeUInt8(item.size === 256 ? 0 : item.size, entryOffset + 1); // Height
    header.writeUInt8(0, entryOffset + 2); // Color palette
    header.writeUInt8(0, entryOffset + 3); // Reserved
    header.writeUInt16LE(1, entryOffset + 4); // Color planes
    header.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    header.writeUInt32LE(item.buffer.length, entryOffset + 8); // Image size in bytes
    header.writeUInt32LE(currentOffset, entryOffset + 12); // Offset of image data
    currentOffset += item.buffer.length;
  }

  const icoBuffer = Buffer.concat([header, ...pngBuffers.map((b) => b.buffer)]);
  const icoPath = path.join(resourcesDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Saved multi-resolution ICO (256, 128, 64, 48, 32, 16) to', icoPath);

  // Also copy to extension/icons for browser extension consistency
  const extIconsDir = path.join(__dirname, '../extension/icons');
  if (!fs.existsSync(extIconsDir)) {
    fs.mkdirSync(extIconsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(extIconsDir, 'icon16.png'), image.resize({ width: 16, height: 16 }).toPNG());
  fs.writeFileSync(path.join(extIconsDir, 'icon48.png'), image.resize({ width: 48, height: 48 }).toPNG());
  fs.writeFileSync(path.join(extIconsDir, 'icon128.png'), image.resize({ width: 128, height: 128 }).toPNG());
  console.log('Saved extension icons to extension/icons/');

  app.quit();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
