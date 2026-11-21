import lottie from 'lottie-web';
import shieldData from './shield-lottie.json';

function initSplash(): void {
  const container = document.getElementById('lottie-shield');
  if (container) {
    lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: shieldData
    });
  }

  const progressBar = document.getElementById('progress-bar');
  const statusLabel = document.getElementById('status-label');
  const card = document.getElementById('splash-card');

  setTimeout(() => {
    if (progressBar) progressBar.style.width = '25%';
    if (statusLabel) statusLabel.textContent = 'Engaging AI prompt & upload guards...';
  }, 250);

  setTimeout(() => {
    if (progressBar) progressBar.style.width = '60%';
    if (statusLabel) statusLabel.textContent = 'Mounting ChatGPT & Perplexity interceptors...';
  }, 650);

  setTimeout(() => {
    if (progressBar) progressBar.style.width = '88%';
    if (statusLabel) statusLabel.textContent = 'Connecting secure audit ledger...';
  }, 1100);

  setTimeout(() => {
    if (progressBar) progressBar.style.width = '100%';
    if (statusLabel) statusLabel.textContent = 'Protection engaged · Launching...';
  }, 1500);

  function triggerFadeOut(): void {
    if (card) {
      card.classList.add('fade-out');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (win.require) {
    try {
      const electron = win.require('electron');
      if (electron?.ipcRenderer) {
        electron.ipcRenderer.on('splash-fade-out', triggerFadeOut);
      }
    } catch {
      // ignore
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSplash);
} else {
  initSplash();
}
