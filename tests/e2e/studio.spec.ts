import { test, expect } from '@playwright/test';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';

const artifactDirectory = process.env.VESSY_E2E_ARTIFACT_DIR || 'artifacts';
test('design, chat, measurement and review journey', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
  await page.getByRole('button', { name: 'Two-piece suit', exact: true }).click();
  await page.getByRole('button', { name: 'Wedding', exact: true }).click();
  await page.getByRole('button', { name: 'All season', exact: true }).click();
  await page.getByRole('button', { name: 'Midnight navy', exact: true }).last().click();
  await page.getByRole('tab', { name: /Fit & shape/ }).click();
  await page.getByRole('button', { name: /Classic Comfortably balanced/ }).click();
  await page.getByRole('tab', { name: /Fabric/ }).click();
  await page.getByLabel('Message your tailor').fill('Could you suggest a green fabric?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply this suggestion' })).toBeVisible();
  await page.getByRole('button', { name: 'Apply this suggestion' }).click();
  await expect(
    page.getByRole('button', { name: 'Forest green', exact: true }).last(),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Forest green', exact: true }).last(),
  ).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.getByRole('heading', { name: /Thoughtfully chosen/ })).toBeVisible();
  await page.getByRole('button', { name: 'Check my draft' }).click();
  await expect(page.getByText('Measurements need verification')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  await page.screenshot({ path: join(artifactDirectory, '03-review-desktop.png'), fullPage: true });
  await page.getByRole('radio', { name: /Expert review/ }).click();
  await page.getByRole('button', { name: 'Check expert review availability' }).click();
  await expect(page.getByText('NO REVIEW HAS BEEN SUBMITTED')).toBeVisible();
  expect(errors).toEqual([]);
});
test('category changes need confirmation and update the available fabric controls', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Two-piece suit', exact: true }).click();
  await page.getByLabel('Garment', { exact: true }).selectOption('shirt');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep my design' }).click();
  await expect(page.getByLabel('Garment', { exact: true })).toHaveValue('suit');
  await page.getByLabel('Garment', { exact: true }).selectOption('shirt');
  await page.getByRole('button', { name: 'Change garment', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Ivory cotton', exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forest green', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: /Finishing details/ }).click();
  await expect(page.getByRole('button', { name: 'French', exact: true })).toBeVisible();
});
test('mobile layout and unavailable capture remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({ path: join(artifactDirectory, '04-design-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '3D preview', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: join(artifactDirectory, '05-preview-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '02 Measurements' }).click();
  await page.getByRole('button', { name: /Measure with 3DLOOK/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Provider connection required');
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
  expect(checkout.status()).toBe(409);
  const capture = await a.request.post('/api/capture', {
    headers: { Origin: 'http://localhost:3000' },
  });
  expect(capture.status()).toBe(503);
  await a.close();
  await b.close();
});

test('verification, sign-in, guest claim and sign-out use real database sessions', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
  const after = await (await page.request.get('/api/studio')).json();
  expect(after.user.email).toBe(email);
  expect(after.draft.id).toBe(before.draft.id);
  await page.getByRole('link', { name: 'Your account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
  expect((await (await page.request.get('/api/studio')).json()).user).toBeNull();
});
test('keyboard controls and accessibility checks across desktop and small layouts', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
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
