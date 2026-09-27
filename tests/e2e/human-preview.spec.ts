import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('full human reference supports garment changes, camera keys, and responsive views', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const model = page.waitForResponse((r) => r.url().endsWith('/models/human-reference-v1.glb'));
  await page.goto('/');
  expect((await model).status()).toBe(200);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Loading human model…')).toHaveCount(0);
  // Allow the first demand frame and contact shadows to finish before visual evidence.
  await page.waitForTimeout(1000);
  await mkdir('artifacts/human-preview', { recursive: true });
  await page.screenshot({ path: 'artifacts/human-preview/suit-desktop.png', fullPage: true });
  for (const angle of ['side', 'back', 'front']) {
    const button = page.getByRole('button', { name: angle, exact: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(300);
    await page
      .locator('.model-stage')
      .screenshot({ path: `artifacts/human-preview/suit-${angle}.png` });
  }
  await page.getByRole('button', { name: 'Zoom in', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page
    .locator('.model-stage')
    .screenshot({ path: 'artifacts/human-preview/suit-detail.png' });
  await page.getByRole('button', { name: 'Reset view', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'front', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('tab', { name: /Style/ }).click();
  await page.getByRole('tab', { name: /LAPELS/ }).click();
  await page.getByRole('button', { name: 'Peak', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Peak', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page
    .locator('.right-pane')
    .screenshot({ path: 'artifacts/human-preview/suit-style-catalog.png' });
  await page.getByRole('tab', { name: /Accents/ }).click();
  await page.getByRole('tab', { name: /Canvas/ }).click();
  await page.getByRole('button', { name: 'Half Canvas Construction', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Half Canvas Construction', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .locator('.right-pane')
    .screenshot({ path: 'artifacts/human-preview/suit-accents-catalog.png' });
  await page.reload();
  await page.getByRole('tab', { name: /Style/ }).click();
  await page.getByRole('tab', { name: /LAPELS/ }).click();
  await expect(page.getByRole('button', { name: 'Peak', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('tab', { name: 'Fabric 01', exact: true }).click();
  await page.getByRole('button', { name: 'Slate windowpane', exact: true }).last().click();
  await expect(
    page.getByRole('button', { name: 'Slate windowpane', exact: true }).last(),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: /Fit & shape/ }).click();
  await page.getByRole('button', { name: /Relaxed/ }).click();
  await page.getByRole('tab', { name: /Finishing details/ }).click();
  await page.getByRole('button', { name: 'Peak', exact: true }).click();
  await page.getByRole('button', { name: 'Patch', exact: true }).click();
  await page.getByRole('button', { name: 'One button', exact: true }).click();
  await page.waitForTimeout(300);
  await page
    .locator('.model-stage')
    .screenshot({ path: 'artifacts/human-preview/suit-options.png' });
  for (const product of ['shirt', 'blazer']) {
    await page.getByLabel('Garment', { exact: true }).selectOption(product);
    await page.getByRole('button', { name: 'Change garment', exact: true }).click();
    await expect(page.getByLabel('Garment', { exact: true })).toHaveValue(product);
    await page.waitForTimeout(300);
    await page
      .locator('.model-stage')
      .screenshot({ path: `artifacts/human-preview/${product}-front.png` });
    await page.getByRole('button', { name: 'side', exact: true }).click();
    await page
      .locator('.model-stage')
      .screenshot({ path: `artifacts/human-preview/${product}-side.png` });
    await page.getByRole('button', { name: 'front', exact: true }).click();
  }
  await page.getByRole('button', { name: '02 Measurements' }).click();
  await page.getByRole('textbox', { name: 'Chest', exact: true }).focus();
  await expect(page.locator('.model-label')).toContainText('Chest');
  await page
    .locator('.model-stage')
    .screenshot({ path: 'artifacts/human-preview/measurements.png' });
  await page.getByRole('button', { name: /Create your look/ }).click();
  for (const [width, height] of [
    [768, 1024],
    [390, 844],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height });
    if (width < 768) await page.getByRole('button', { name: '3D preview', exact: true }).click();
    await expect(page.locator('canvas')).toBeVisible();
    if (width === 768) {
      await page
        .locator('.model-stage')
        .evaluate((element) => element.scrollIntoView({ block: 'center' }));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `artifacts/human-preview/preview-${width}${width === 768 ? '-visible' : ''}.png`,
      fullPage: width < 768,
    });
  }
  expect(errors).toEqual([]);
});

test('failed human asset leaves an honest fallback and usable design controls', async ({
  page,
}) => {
  await page.route('**/models/human-reference-v1.glb', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByText('3D preview unavailable', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Forest green', exact: true }).last().click();
  await expect(
    page.getByRole('button', { name: 'Forest green', exact: true }).last(),
  ).toHaveAttribute('aria-pressed', 'true');
});
