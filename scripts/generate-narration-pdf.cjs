const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const htmlPath = path.join(__dirname, '..', 'docs', 'narration-guide.html');
  await win.loadFile(htmlPath);

  await new Promise((r) => setTimeout(r, 600));

  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: {
      top: 0.3,
      bottom: 0.3,
      left: 0.3,
      right: 0.3
    }
  });

  const outPath = path.join(__dirname, '..', 'docs', 'Walled-Guard-Demo-Video-Script.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log('PDF successfully created at:', outPath);
  app.quit();
});
