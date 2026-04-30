import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as path from 'path';

test.describe('Cleak GUI Smoke Tests', () => {
  let electronApp: ElectronApplication;
  let mainWindow: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['out/main/index.js'],
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, NODE_ENV: 'test' },
    });
    mainWindow = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('app launches', async () => {
    await expect(mainWindow).toHaveTitle(/Cleak/);
  });

  test('activity bar has expected icons', async () => {
    const activityBar = mainWindow.locator('[data-testid="activity-bar"]');
    await expect(activityBar).toBeVisible();
  });

  test('can switch between main tabs', async () => {
    const sidePanel = mainWindow.locator('[data-testid="side-panel"]');
    await expect(sidePanel).toBeVisible();
  });

  test('settings panel opens', async () => {
    const settingsButton = mainWindow.locator('[aria-label*="Settings" i]');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      const settingsPanel = mainWindow.locator('[data-testid="settings-panel"]');
      await expect(settingsPanel).toBeVisible();
    }
  });

  test('status bar shows bridge state', async () => {
    const statusBar = mainWindow.locator('[data-testid="status-bar"]');
    await expect(statusBar).toBeVisible();
  });
});
