import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { totp } from '../helpers/totp';
test('SYNTHETIC owner: CLI grant, authenticator enrollment, admin keyboard/screens, TOTP sign-in', async ({
  page,
}) => {
  const user = JSON.parse(await readFile('.data/qa-staff.json', 'utf8'));
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account\?next=/);
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/security/);
  await page.getByLabel('Confirm your password').fill(user.password);
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Set up authenticator', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Manual setup key')).toBeVisible();
  const secret = await page.getByLabel('Manual setup key').inputValue();
  expect((await page.request.get('/api/admin/staff')).status()).toBe(403);
  await mkdir('test-results/staff', { recursive: true });
  // Only synthetic keys appear in this local test artifact.
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `test-results/staff/enrollment-${width}.png`,
      fullPage: true,
      mask: [
        page.getByLabel('Manual setup key'),
        page.getByRole('img', { name: 'Authenticator setup QR code' }),
      ],
      maskColor: '#dfe6da',
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.getByLabel('Authenticator code', { exact: true }).fill(totp(secret));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Verify authenticator' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Save your backup codes' })).toBeVisible();
  await page.getByLabel('I have saved my backup codes').check();
  await page.getByRole('link', { name: 'Continue to admin' }).click();
  await expect(page.getByRole('heading', { name: 'A considered start.' })).toBeVisible();
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/staff/overview-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.getByRole('link', { name: 'Staff & audit', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'People & accountability.' })).toBeVisible();
  await page.getByLabel('Verified account email').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Role', exact: true })).toBeFocused();
  await page.getByLabel('Verified account email').fill(user.email);
  await page.getByRole('button', { name: 'Grant role', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Staff access updated.');
  const ownRow = page.getByRole('row').filter({ hasText: user.email });
  await expect(ownRow).toContainText('support');
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/staff/settings-${width}.png`, fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'Audit log', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'staff.grant', exact: true }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/staff/audit-768.png', fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.request.post('/api/auth/sign-out', {
    headers: { Origin: 'http://localhost:3000' },
    data: {},
  });
  await page.goto('/account?next=/admin');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your login code.' })).toBeVisible();
  expect((await page.request.get('/api/admin/me')).status()).toBe(401);
  await page.getByLabel('Authenticator code', { exact: true }).fill(totp(secret));
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
test('SYNTHETIC ordinary customer cannot see the admin shell', async ({ page }) => {
  const email = `synthetic-nonstaff-${crypto.randomUUID()}@vessy.invalid`;
  await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: 'http://localhost:3000' },
    data: { name: 'SYNTHETIC Customer', email, password: 'Synthetic-only-password-123' },
  });
  const { readdir } = await import('node:fs/promises');
  const mail = await Promise.all(
    (await readdir('.data/mail'))
      .filter((f) => f.endsWith('.json'))
      .map(async (f) => JSON.parse(await readFile('.data/mail/' + f, 'utf8'))),
  );
  await page.request.get(mail.find((m) => m.to === email).url);
  await page.request.post('/api/auth/sign-in/email', {
    headers: { Origin: 'http://localhost:3000' },
    data: { email, password: 'Synthetic-only-password-123' },
  });
  const denied = await page.goto('/admin');
  expect(denied?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'A different direction.' })).toBeVisible();
  expect((await page.request.get('/api/admin/me')).status()).toBe(403);
});
