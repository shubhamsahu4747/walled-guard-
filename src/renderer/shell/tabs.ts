export function initShell(): void {
  const items = document.querySelectorAll<HTMLLIElement>('#workspace-nav .nav-item');

  items.forEach((item) => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      if (!tab) return;

      items.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');

      if ((window as unknown as { dashboardApi?: { navigateTab: (t: string) => void } }).dashboardApi) {
        (window as unknown as { dashboardApi: { navigateTab: (t: string) => void } }).dashboardApi.navigateTab(tab);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initShell);
