import { test, expect, Page } from '@playwright/test';

const BASE = process.env.UAT_BASE_URL ?? 'https://demo.breisner.info/abax-gantt';
const ADMIN_TOKEN = process.env.AKADMIN_TOKEN ?? '';

async function inject(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => window.localStorage.setItem('abax.auth.token', t), ADMIN_TOKEN);
}

test('debug: mueve slider, persiste, recarga, verifica', async ({ page }) => {
  test.setTimeout(60_000);
  const logs: string[] = [];
  const requests: { url: string; method: string; postData: string | null }[] = [];
  const responses: { url: string; status: number; body: string }[] = [];

  page.on('console', (msg) => {
    if (msg.text().includes('[progress') || msg.text().includes('[handleReportProgress')) {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('request', (req) => {
    if (req.url().includes('/api/wbs') && req.method() !== 'GET') {
      requests.push({ url: req.url(), method: req.method(), postData: req.postData() });
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/api/wbs') && res.request().method() !== 'GET') {
      try {
        const body = await res.text();
        responses.push({ url: res.url(), status: res.status(), body: body.slice(0, 300) });
      } catch { /* ignore */ }
    }
  });

  await inject(page);
  await page.addInitScript(() => localStorage.setItem('abax.detail.visible', '1'));
  await page.goto(`${BASE}/gantt`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Click en una tarea (no proyecto/etapa) para tener el slider habilitado
  const taskRow = page.locator('.gantt_tree_content').nth(2);
  await taskRow.click();
  await page.waitForTimeout(800);

  // Ir al tab Avance
  await page.getByRole('tab', { name: 'Avance' }).click();
  await page.waitForTimeout(500);

  const slider = page.locator('input[type="range"]').first();
  const beforeValue = await slider.inputValue();
  console.log('🎯 Slider valor inicial:', beforeValue);

  // Mover el slider a 75
  await slider.fill('75');
  await slider.evaluate((el) => {
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('mouseup', { bubbles: true }));
  });
  await page.waitForTimeout(1500); // espera el flush

  console.log('🎯 Slider después de mover:', await slider.inputValue());

  console.log('\n📞 Llamadas a /api/wbs (no-GET):');
  requests.forEach((r) => {
    console.log(`  ${r.method} ${r.url}`);
    console.log(`     body: ${(r.postData ?? '').slice(0, 200)}`);
  });

  console.log('\n📞 Respuestas:');
  responses.forEach((r) => console.log(`  ${r.status} ${r.url}\n     ${r.body.slice(0, 200)}`));

  console.log('\n📝 Console logs del cliente:');
  logs.forEach((l) => console.log(`  ${l}`));

  // Recargar y verificar
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await taskRow.click();
  await page.waitForTimeout(500);
  await page.getByRole('tab', { name: 'Avance' }).click();
  await page.waitForTimeout(500);

  const afterReload = await slider.inputValue();
  console.log('\n🔄 Slider después de recargar:', afterReload);

  expect(afterReload).toBe('75');
});
