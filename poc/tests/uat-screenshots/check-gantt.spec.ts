import { test } from '@playwright/test';

test('debug what user sees at /gantt', async ({ page }) => {
  test.setTimeout(45_000);
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (e) => errors.push(`PAGE ERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE ERR: ${m.text()}`); });
  page.on('requestfailed', (r) => failed.push(`FAILED ${r.method()} ${r.url()} -- ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.request().method()} ${r.url()}`); });

  await page.goto('https://demo.breisner.info/abax-gantt/gantt', { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2000);
  const visibleText = await page.locator('body').innerText();
  console.log('--- VISIBLE TEXT ---\n' + visibleText.slice(0, 1500));
  console.log('--- ERRORS ---');
  errors.forEach((e) => console.log(e));
  console.log('--- FAILED REQUESTS ---');
  failed.forEach((f) => console.log(f));
});
