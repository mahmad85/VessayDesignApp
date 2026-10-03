import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// TASK-017 (WP-18): prices in the studio. The imported reference catalog has
// no prices, so the studio says “Price not yet available”. A SYNTHETIC priced
// release (the PRICING.md E-fixture on the reference catalog) is then published
// through the test-only hook, and the E3 configuration must show $918 with the
// E3 breakdown. The reference catalog is restored afterwards.

const artifactDirectory = process.env.VESSY_E2E_ARTIFACT_DIR || 'artifacts';
const ORIGIN = { Origin: 'http://localhost:3000' };

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
  if (await crumb.isVisible())
    await crumb.getByRole('button', { name: 'All details', exact: true }).click();
  await page
    .getByRole('region', { name: 'All design details' })
    .getByRole('button', { name: branch })
    .click();
  await page.getByRole('button', { name: leaf }).first().click();
}
const price = (page: Page) => page.getByRole('region', { name: 'Price', exact: true });

test.afterAll(async ({ request }) => {
  const restored = await request.post('/api/test/catalog', {
    headers: ORIGIN,
    data: { scenario: 'reference' },
  });
  expect(restored.status()).toBe(200);
});

test('prices show from the current release and are never zero when unknown', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mkdir(artifactDirectory, { recursive: true });
  await page.goto('/studio');
  await startGarment(page, 'Two-piece suit');
  // The imported reference catalog has no prices (PRC-005).
  await expect(price(page).getByText('Price not yet available').first()).toBeVisible();
  await expect(price(page)).not.toContainText('$0');
  await expect(price(page).getByRole('button', { name: 'Price details' })).toHaveCount(0);

  const published = await request.post('/api/test/catalog', {
    headers: ORIGIN,
    data: { scenario: 'priced' },
  });
  expect(published.status(), 'start the server with VESSY_E2E_HOOKS=true').toBe(200);
  // The open draft shows the new prices on its next read (PRC-007).
  await page.reload();
  await expect(price(page)).toContainText('$799');

  // E3: add the vest, a custom lining in Berck, working buttonholes and peak lapels.
  await openDetail(page, /^1 Vest/, /^Add a vest/);
  const added = page.getByRole('button', { name: /^Added/ });
  await expect(added).toContainText('+$100');
  await added.click();
  await expect(price(page)).toContainText('$899');
  await openDetail(page, /Accents/, /^Lining/);
  // D-022: subcategories carry no customisation fee, so no fee hint is shown.
  await expect(page.getByText(/Customising adds/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Custom color', exact: true }).click();
  const berck = page.getByRole('button', { name: /^Berck/ });
  await expect(berck).toContainText('+$9');
  await berck.click();
  await openDetail(page, /^7 Jacket/, /^Sleeve/);
  const buttonholes = page.getByRole('button', { name: /^With buttonholes/ });
  await expect(buttonholes).toContainText('+$10');
  await buttonholes.click();
  await openDetail(page, /^7 Jacket/, /^Lapels/);
  await page.getByRole('button', { name: 'Peak', exact: true }).click();
  await expect(price(page)).toContainText('$918');

  // The Price details disclosure lists the E3 breakdown by category (keyboard).
  const toggle = price(page).getByRole('button', { name: 'Price details' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const details = page.getByRole('region', { name: 'Price details' });
  for (const [label, amount] of [
    ['Base', '$799'],
    ['Jacket', '$10'],
    ['Vest', '$100'],
    ['Accents', '$9'],
  ])
    await expect(details.locator('.price-category', { hasText: label })).toContainText(amount);
  await page.screenshot({ path: join(artifactDirectory, '09-price-details-1440.png') });
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(price(page)).toContainText('$918');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await price(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(artifactDirectory, '10-price-details-390.png') });

  // An unpriced fabric makes the price unknown again — never $0.
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDetail(page, /The essentials/, /^Fabric/);
  await page.getByRole('button', { name: 'Forest green', exact: true }).last().click();
  await expect(price(page).getByText('Price not yet available').first()).toBeVisible();
  await expect(price(page)).not.toContainText('$0');
  await page.screenshot({ path: join(artifactDirectory, '11-price-unavailable-1440.png') });
  expect(errors).toEqual([]);
});
