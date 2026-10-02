import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/** The start screen (S-01): choose a garment, then start designing. */
async function startGarment(page: Page, name: string) {
  await expect(page.getByRole('heading', { name: 'Choose a garment' })).toBeVisible();
  await page
    .getByRole('group', { name: 'Garment' })
    .getByRole('button', { name: new RegExp(name) })
    .click();
  await page.getByRole('button', { name: 'Start designing' }).click();
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
}
async function openDetail(page: Page, branch: RegExp, leaf: RegExp) {
  await page.getByRole('tab', { name: 'Choose details' }).click();
  const crumb = page.getByRole('navigation', { name: 'Detail hierarchy' });
  if (await crumb.isVisible()) await crumb.getByRole('button', { name: 'All details' }).click();
  await page
    .getByRole('region', { name: 'All design details' })
    .getByRole('button', { name: branch })
    .click();
  await page.getByRole('button', { name: leaf }).first().click();
}

test('full human reference supports garment changes, camera keys, and responsive views', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/studio');
  await startGarment(page, 'Two-piece suit');
  const model = page.waitForResponse((r) => r.url().endsWith('/models/human-reference-v1.glb'));
  await page.getByRole('button', { name: '3D model', exact: true }).click();
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
  await openDetail(page, /^7 Jacket/, /^Lapels/);
  await page.getByRole('button', { name: 'Peak', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Peak', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page
    .locator('.right-pane')
    .screenshot({ path: 'artifacts/human-preview/suit-style-catalog.png' });
  await openDetail(page, /Accents/, /^Canvas/);
  await page.getByRole('button', { name: 'Half Canvas Construction', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Half Canvas Construction', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .locator('.right-pane')
    .screenshot({ path: 'artifacts/human-preview/suit-accents-catalog.png' });
  await page.reload();
  await openDetail(page, /^7 Jacket/, /^Lapels/);
  await expect(page.getByRole('button', { name: 'Peak', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '3D model', exact: true }).click();
  await openDetail(page, /The essentials/, /^Fabric/);
  await page.getByRole('button', { name: 'Slate windowpane', exact: true }).last().click();
  await expect(
    page.getByRole('button', { name: 'Slate windowpane', exact: true }).last(),
  ).toHaveAttribute('aria-pressed', 'true');
  // The suit fit is a jacket option (the Essentials tab ends with the fabric).
  await openDetail(page, /^7 Jacket/, /^Fit/);
  await page.getByRole('button', { name: 'Relaxed', exact: true }).click();
  await openDetail(page, /^7 Jacket/, /^Pocket/);
  await page.getByRole('button', { name: 'With flap', exact: true }).click();
  await page.getByRole('button', { name: /^Previous Lapels/ }).click();
  await page.getByRole('button', { name: /^Previous Fit/ }).click();
  await page.getByRole('button', { name: /^Previous Style/ }).click();
  await page.getByRole('button', { name: 'Single-breasted 1 button', exact: true }).click();
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
    if (width < 768) await page.getByRole('button', { name: 'Preview', exact: true }).click();
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
  await page.goto('/studio');
  await startGarment(page, 'Two-piece suit');
  await page.getByRole('button', { name: '3D model', exact: true }).click();
  await expect(page.getByText('3D preview unavailable', { exact: true })).toBeVisible();
  await openDetail(page, /The essentials/, /^Fabric/);
  await page.getByRole('button', { name: 'Forest green', exact: true }).last().click();
  await expect(
    page.getByRole('button', { name: 'Forest green', exact: true }).last(),
  ).toHaveAttribute('aria-pressed', 'true');
});
