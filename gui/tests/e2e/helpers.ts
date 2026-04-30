import { type Page } from '@playwright/test';

export async function waitForBridgeReady(page: Page, timeout = 10000) {
  await page.waitForFunction(
    () => {
      const status = (window as any).__bridgeStatus;
      return status === 'connected' || status === 'ready';
    },
    { timeout },
  );
}

export async function switchTab(page: Page, tabId: string) {
  const tab = page.locator(`[data-tab="${tabId}"]`);
  await tab.click();
}

export async function waitForPanel(page: Page, panelId: string, timeout = 5000) {
  const panel = page.locator(`[data-panel="${panelId}"]`);
  await panel.waitFor({ state: 'visible', timeout });
}
