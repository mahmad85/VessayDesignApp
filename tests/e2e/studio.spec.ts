import { test, expect, type Page } from '@playwright/test';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';

const artifactDirectory = process.env.VESSY_E2E_ARTIFACT_DIR || 'artifacts';
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
  if (await crumb.isVisible())
    await crumb.getByRole('button', { name: 'All details', exact: true }).click();
  await page
    .getByRole('region', { name: 'All design details' })
    .getByRole('button', { name: branch })
    .click();
  await page.getByRole('button', { name: leaf }).first().click();
}
test('design, chat, measurement and review journey', async ({ page }) => {
  // The longest journey; a cold development server compiles every step on first use.
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/studio');
  await startGarment(page, 'Two-piece suit');
  await page.getByRole('button', { name: 'Wedding', exact: true }).click();
  await page.getByRole('button', { name: 'All season', exact: true }).click();
  await page.getByRole('button', { name: 'Midnight navy', exact: true }).last().click();
  // The suit fit is a jacket option with the catalog's own choice labels.
  await openDetail(page, /^7 Jacket/, /^Fit Slim Fit/);
  await page.getByRole('button', { name: 'Regular', exact: true }).click();
  await expect(page.locator('.sketch-callout')).toContainText('Regular');
  await page.getByRole('tab', { name: 'Ask your tailor' }).click();
  await page.getByLabel('Message your tailor').fill('Could you suggest a green fabric?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply this suggestion' })).toBeVisible();
  await page.getByRole('button', { name: 'Apply this suggestion' }).click();
  // The assistant's accepted change shows up as a tag and focuses the drawing.
  await expect(page.locator('.sketch-callout')).toContainText('Forest green');
  await page.getByRole('button', { name: 'Fabric: Forest green. Edit' }).click();
  await expect(
    page.getByRole('button', { name: 'Forest green', exact: true }).last(),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByRole('button', { name: 'Fabric: Forest green. Edit' }).click();
  await expect(
    page.getByRole('button', { name: 'Forest green', exact: true }).last(),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sketch-svg')).toBeVisible();
  await page.getByRole('button', { name: '3D model', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({ path: join(artifactDirectory, '01-design-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Review design & continue' }).click();
  await page.getByRole('button', { name: 'Confirm design & take measurements' }).click();
  await expect(page.getByRole('heading', { name: /A better fit/ })).toBeVisible();
  const values: { [key: string]: string } = {
    Height: '180',
    Chest: '101.3',
    'Body waist': '87',
    'Shoulder width': '45',
    'Sleeve length': '63',
    'Seat / hips': '100',
    'Inside leg': '80',
  };
  for (const [label, value] of Object.entries(values))
    await page.getByRole('textbox', { name: label, exact: true }).fill(value);
  await page.getByRole('button', { name: 'in', exact: true }).click();
  await page.getByRole('button', { name: 'cm', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Chest', exact: true })).toHaveValue('101.3');
  await page.getByRole('textbox', { name: 'Chest', exact: true }).focus();
  await expect(page.locator('.model-label')).toContainText('101.3 cm');
  await page.screenshot({
    path: join(artifactDirectory, '02-measurements-desktop.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Confirm measurements' }).click();
  await expect(page.getByRole('heading', { name: 'Review & pay', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Check my order' }).click();
  await expect(page.getByText('Advice: Your measurements')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Place order and pay' })).toBeDisabled();
  await page.screenshot({ path: join(artifactDirectory, '03-review-desktop.png'), fullPage: true });
  await expect(page.getByLabel('Add a tailor review', { exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});
test('category changes need confirmation and update the available fabric controls', async ({
  page,
}) => {
  await page.goto('/studio');
  await startGarment(page, 'Two-piece suit');
  await page.getByLabel('Garment', { exact: true }).selectOption('shirt');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep my design' }).click();
  await expect(page.getByLabel('Garment', { exact: true })).toHaveValue('suit');
  await page.getByLabel('Garment', { exact: true }).selectOption('shirt');
  await page.getByRole('button', { name: 'Change garment', exact: true }).click();
  await openDetail(page, /The essentials/, /^Fabric Ivory cotton/);
  await expect(
    page.getByRole('button', { name: 'Ivory cotton', exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forest green', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Next Fit/ }).click();
  await page.getByRole('button', { name: /^Next Collar/ }).click();
  await page.getByRole('button', { name: /^Next Cuffs/ }).click();
  await expect(page.getByRole('button', { name: 'French', exact: true })).toBeVisible();
  // Suit-only jacket, trouser, vest and accent branches are not offered for a shirt.
  await page.getByRole('button', { name: 'All details', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'All design details' }).getByRole('button'),
  ).toHaveCount(1);
});
test('mobile layout and unconfigured 3DLOOK capture remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'Choose a garment' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({ path: join(artifactDirectory, '00-start-mobile.png'), fullPage: true });
  await startGarment(page, 'Two-piece suit');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: join(artifactDirectory, '04-design-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.sketch-svg')).toBeVisible();
  await page.screenshot({ path: join(artifactDirectory, '05-preview-mobile.png'), fullPage: true });
  await page
    .getByRole('group', { name: 'Selection group' })
    .getByRole('button', { name: /^Jacket/ })
    .click();
  await page.getByRole('button', { name: /^Fit: Slim Fit/ }).click();
  await expect(page.getByRole('heading', { name: 'Fit', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('button', { name: '3D model', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: '02 Measurements' }).click();
  await page.getByRole('button', { name: /Measure with 3DLOOK/ }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Sign in to save a 3DLOOK scan to your account.',
  );
  await page.getByRole('button', { name: 'Continue with manual entry' }).click();
  await page.getByRole('textbox', { name: 'Height', exact: true }).fill('180');
  await page.getByRole('button', { name: '03 Review' }).click();
  await expect(page.getByRole('dialog')).toContainText('unsaved measurements');
});
test('the API prevents cross-origin mutation and guest data access', async ({ browser }) => {
  const a = await browser.newContext({ baseURL: 'http://localhost:3000' }),
    b = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const one = await (await a.request.get('/api/studio')).json(),
    two = await (await b.request.get('/api/studio')).json();
  expect(one.draft.id).not.toBe(two.draft.id);
  const r = await a.request.post('/api/studio', {
    headers: { Origin: 'https://untrusted.example' },
    data: {
      actionId: crypto.randomUUID(),
      expectedRevision: 0,
      command: { type: 'design', patch: { fabricId: 'forest' } },
    },
  });
  expect(r.status()).toBe(403);
  const checkout = await a.request.post('/api/checkout', {
    headers: { Origin: 'http://localhost:3000' },
  });
  expect(checkout.status()).toBe(410);
  // 3DLOOK capture and the scan-service checkout both require a signed-in
  // owner — a guest cookie is not enough.
  const saiaSession = await a.request.post('/api/measurements/saia/session', {
    headers: { Origin: 'http://localhost:3000' },
    data: { targetUnit: 'cm' },
  });
  expect(saiaSession.status()).toBe(401);
  const scanCheckout = await a.request.post('/api/scan-service/checkout', {
    headers: { Origin: 'http://localhost:3000' },
  });
  expect(scanCheckout.status()).toBe(401);
  await a.close();
  await b.close();
});

test('verification, sign-in, guest claim and sign-out use real database sessions', async ({
  page,
}) => {
  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'Choose a garment' })).toBeVisible();
  const before = await (await page.request.get('/api/studio')).json();
  const email = `test-${crypto.randomUUID()}@vessy.invalid`;
  const password = 'Synthetic-only-password-123';
  const signup = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: 'http://localhost:3000' },
    data: { name: 'Test Customer', email, password },
  });
  expect(signup.status()).toBe(200);
  const denied = await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: 'http://localhost:3000' },
    data: { email, password },
  });
  expect(denied.status()).toBe(403);
  const mail = await Promise.all(
    (await readdir('.data/mail'))
      .filter((f) => f.endsWith('.json'))
      .map(async (f) => JSON.parse(await readFile('.data/mail/' + f, 'utf8'))),
  );
  const verification = mail.find((m) => m.to === email && m.subject.includes('Verify'));
  expect(verification).toBeTruthy();
  await page.request.get(verification.url);
  await page.goto('/account');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose a garment' })).toBeVisible();
  const after = await (await page.request.get('/api/studio')).json();
  expect(after.user.email).toBe(email);
  expect(after.draft.id).toBe(before.draft.id);
  // Once signed in, the public 3DLOOK capture path opens; the paid path
  // still fails closed on the unconfigured provider authorization.
  const saiaSession = await page.request.post('/api/measurements/saia/session', {
    headers: { Origin: 'http://localhost:3000' },
    data: { targetUnit: 'cm' },
  });
  expect(saiaSession.status()).toBe(201);
  const saiaPaidSession = await page.request.post('/api/measurements/saia/session', {
    headers: { Origin: 'http://localhost:3000' },
    data: { targetUnit: 'cm', mode: 'paid' },
  });
  expect(saiaPaidSession.status()).toBe(503);
  await page.getByRole('link', { name: 'Your account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose a garment' })).toBeVisible();
  expect((await (await page.request.get('/api/studio')).json()).user).toBeNull();
});
test('keyboard controls and accessibility checks across desktop and small layouts', async ({
  page,
}) => {
  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'Choose a garment' })).toBeVisible();
  const start = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(start.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  // The start screen works by keyboard alone.
  const cards = page.getByRole('group', { name: 'Garment' });
  const shirt = cards.getByRole('button', { name: /Dress shirt/ });
  await shirt.focus();
  await page.keyboard.press('Space');
  await expect(shirt).toHaveAttribute('aria-pressed', 'true');
  const suitCard = cards.getByRole('button', { name: /Two-piece suit/ });
  await suitCard.focus();
  await page.keyboard.press('Enter');
  await expect(suitCard).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Start designing' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await openDetail(page, /^7 Jacket/, /^Lapels/);
  const fields = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(fields.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await page.getByRole('button', { name: 'Appearance', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Appearance', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({ path: join(artifactDirectory, '06-design-tablet.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('field choices and the 2D drawing stay in sync across 2D/3D switches', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/studio');
  await startGarment(page, 'Two-piece suit');
  const svg = page.locator('.sketch-svg');
  await expect(svg).toHaveAttribute('viewBox', '0 0 400 800');
  await openDetail(page, /^7 Jacket/, /^Pocket/);
  // Opening a group zooms to it before anything changes.
  await expect(page.locator('.sketch-callout')).toContainText('Pocket');
  await expect(svg).not.toHaveAttribute('viewBox', '0 0 400 800');
  await page.getByRole('button', { name: 'With flap x3', exact: true }).click();
  await expect(page.locator('.sketch-callout')).toContainText('With flap x3');
  await expect(page.getByRole('button', { name: 'Pocket: With flap x3. Edit' })).toBeVisible();
  await page.getByRole('button', { name: /^Next Sleeve/ }).click();
  await page.getByRole('button', { name: /^Next Back/ }).click();
  await page.getByRole('button', { name: 'Side Vents', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Drawing side' }).getByRole('button', { name: 'back' }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Trouser details reveal the waistband by fading the jacket.
  await page.getByRole('button', { name: 'All details', exact: true }).click();
  await page.getByRole('button', { name: /^9 Trousers/ }).click();
  await page.getByRole('button', { name: /^Pleats/ }).click();
  await page.getByRole('button', { name: 'Double pleats', exact: true }).click();
  await expect(page.locator('.sketch-callout')).toContainText('Double pleats');
  await expect(
    page.getByRole('group', { name: 'Drawing side' }).getByRole('button', { name: 'front' }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Switching renderers never changes the saved selection.
  await page.getByRole('button', { name: '3D model', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: '2D drawing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pleats: Double pleats. Edit' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^Trousers 9/ }).click();
  await expect(page.getByRole('button', { name: 'Pleats: Double pleats. Edit' })).toBeVisible();
  // A drawing hotspot opens its editor, and keyboard zoom works on the drawing.
  await page.getByRole('button', { name: 'Edit Lapels' }).click();
  await expect(page.getByRole('heading', { name: 'Lapels', exact: true })).toBeVisible();
  await svg.focus();
  const before = await svg.getAttribute('viewBox');
  await page.keyboard.press('+');
  await expect(svg).not.toHaveAttribute('viewBox', before!);
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({ path: join(artifactDirectory, '07-design-2d-fields.png') });
  expect(errors).toEqual([]);
});
test('the start screen fits every customer width and starts the chosen garment', async ({
  page,
}) => {
  await mkdir(artifactDirectory, { recursive: true });
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [320, 740],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/studio');
    await expect(page.getByRole('heading', { name: 'Choose a garment' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: join(artifactDirectory, `08-start-${width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await startGarment(page, 'Blazer');
  await expect(page.getByLabel('Garment', { exact: true })).toHaveValue('blazer');
  // A single-part product shows its options in the Essentials only.
  await page.getByRole('tab', { name: 'Choose details' }).click();
  await expect(
    page.getByRole('region', { name: 'All design details' }).getByRole('button'),
  ).toHaveCount(1);
});
