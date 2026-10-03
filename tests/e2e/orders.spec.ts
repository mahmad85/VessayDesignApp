import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import Stripe from 'stripe';
import { readFile, mkdir } from 'node:fs/promises';
import { totp } from '../helpers/totp';
const origin = { Origin: 'http://localhost:3000' };
test.afterEach(async ({ request }) => {
  const restored = await request.post('/api/test/catalog', {
    headers: origin,
    data: { scenario: 'reference' },
  });
  expect(restored.status()).toBe(200);
});
const state = async (page: Page) => (await page.request.get('/api/studio')).json();
async function cmd(page: Page, command: Record<string, unknown>) {
  const before = await state(page),
    response = await page.request.post('/api/studio', {
      headers: origin,
      data: { actionId: crypto.randomUUID(), expectedRevision: before.draft.revision, command },
    });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
async function start(page: Page, name: string, dialog = false) {
  const scope = dialog ? page.getByRole('dialog') : page.locator('#studio-content');
  await scope
    .getByRole('group', { name: 'Garment', exact: true })
    .getByRole('button', { name: new RegExp(name) })
    .click();
  await scope.getByRole('button', { name: 'Start designing', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
}
async function capture(page: Page, name: string, widths: number[]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `test-results/ordering/${name}-${width}.png`, fullPage: true });
  }
}
test('SYNTHETIC purchase: cart, check, sign-off, verified test payment, tailor proposal and customer amendment', async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  await mkdir('test-results/ordering', { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const customer = JSON.parse(await readFile('.data/qa-orders.json', 'utf8'));
  expect(
    (await page.request.post('/api/auth/sign-in/email', { headers: origin, data: customer })).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post('/api/test/catalog', {
        headers: origin,
        data: { scenario: 'priced' },
      })
    ).ok(),
  ).toBe(true);
  await page.goto('/studio');
  await start(page, 'Two-piece suit');
  await page.getByRole('button', { name: '+ Add garment', exact: true }).focus();
  await page.keyboard.press('Enter');
  await start(page, 'Dress shirt', true);
  await page.getByRole('button', { name: '+ Add garment', exact: true }).click();
  await start(page, 'Dress shirt', true);
  const added = await state(page);
  expect(added.draft.garments).toHaveLength(3);
  for (const [i, g] of added.draft.garments.entries()) {
    await cmd(page, {
      type: 'design',
      garmentId: g.id,
      patch: {
        preferences: { occasion: 'wedding', climate: 'warm' },
        ...(i === 2 ? { selections: { 'style.shirt.shirt_collar.shirt-collar': 'point' } } : {}),
      },
    });
    await cmd(page, { type: 'accept_design', garmentId: g.id });
  }
  await page.reload();
  await page.getByRole('button', { name: /^2\. Dress shirt/ }).focus();
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await state(page)).draft.activeGarmentId)
    .toBe(added.draft.garments[1].id);
  const second = await state(page);
  expect(second.draft.garments[1].selections).not.toEqual(second.draft.garments[2].selections);
  await capture(page, 'cart', [1440, 768, 390, 320]);
  await page.getByRole('button', { name: 'Remove garment 3: Dress shirt', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('confirmed design');
  await page.getByRole('button', { name: 'Remove garment', exact: true }).click();
  await expect.poll(async () => (await state(page)).draft.garments.length).toBe(2);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page
    .getByRole('button', { name: /02.*Measurements|Measurements/ })
    .first()
    .click();
  for (const [label, value] of Object.entries({
    Height: '180',
    Chest: '100',
    'Body waist': '88',
    'Shoulder width': '45',
    'Sleeve length': '63',
    'Seat / hips': '100',
    'Inside leg': '80',
    Neck: '39',
  })) {
    await page.getByRole('textbox', { name: label, exact: true }).fill(value);
  }
  await page.getByRole('button', { name: 'Confirm measurements', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review & pay', exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Quantity for garment 2' }).fill('2');
  await expect.poll(async () => (await state(page)).quote.totalMinor).toBe(105700);
  await page.getByRole('button', { name: 'Check my order', exact: true }).click();
  await expect(page.getByText('Your order is ready', { exact: true })).toBeVisible();
  const design = page.getByLabel(
    'I have reviewed the design of each garment and want it made as shown.',
  );
  const measurements = page.getByLabel(
    'These are my measurements. I confirm they are correct and understand my garments will be made to them.',
  );
  expect(await design.isChecked()).toBe(false);
  expect(await measurements.isChecked()).toBe(false);
  await design.check();
  await measurements.check();
  await page.getByLabel('Add a tailor review', { exact: true }).check();
  await capture(page, 'signoff', [1440, 768, 390, 320]);
  await page.getByRole('button', { name: /Place order and pay/ }).click();
  await expect(page).toHaveURL(/\/orders\/VS-\d+/);
  const number = new URL(page.url()).pathname.split('/').at(-1)!;
  await expect(page.getByText('We are confirming your payment.', { exact: false })).toBeVisible();
  expect(
    (await (await page.request.get('/api/orders/' + number)).json()).order.payment.status,
  ).toBe('payment_pending');
  const event = await (
      await page.request.post('/api/test/orders', { headers: origin, data: { number } })
    ).json(),
    raw = JSON.stringify(event),
    signature = Stripe.webhooks.generateTestHeaderString({
      payload: raw,
      secret: 'whsec_SYNTHETIC_orders_only',
    });
  const paid = await page.request.post('/api/payments/stripe/webhook', {
    headers: { 'Stripe-Signature': signature, 'Content-Type': 'application/json' },
    data: raw,
  });
  expect(paid.status(), await paid.text()).toBe(200);
  await page.reload();
  await expect(page.getByRole('paragraph').filter({ hasText: /^Payment received$/ })).toBeVisible();
  await capture(page, 'paid-order', [1440, 768, 390, 320]);
  const tailorContext = await browser.newContext(),
    tailor = await tailorContext.newPage(),
    staff = JSON.parse(await readFile('.data/qa-catalog.json', 'utf8'));
  expect(
    (await tailor.request.post('/api/auth/sign-in/email', { headers: origin, data: staff })).ok(),
  ).toBe(true);
  const enrolled = await (
    await tailor.request.post('/api/auth/two-factor/enable', {
      headers: origin,
      data: { password: staff.password },
    })
  ).json();
  const secret = new URL(enrolled.totpURI).searchParams.get('secret')!;
  expect(
    (
      await tailor.request.post('/api/auth/two-factor/verify-totp', {
        headers: origin,
        data: { code: totp(secret) },
      })
    ).ok(),
  ).toBe(true);
  await tailor.goto('/admin/reviews');
  await expect(tailor.getByRole('link', { name: number, exact: true })).toBeVisible();
  await capture(tailor, 'tailor-queue', [1440, 1024, 768]);
  await tailor.getByRole('link', { name: number, exact: true }).click();
  await tailor.getByRole('button', { name: 'Claim review', exact: true }).click();
  await tailor.getByLabel('Outcome').selectOption('changes_proposed');
  await tailor.getByLabel(/^Chest — current/).fill('103');
  await tailor
    .getByLabel('Message to customer')
    .fill('SYNTHETIC: please review this chest measurement proposal.');
  await capture(tailor, 'tailor-proposal', [1440, 1024, 768]);
  await tailor.getByRole('button', { name: 'Submit decision', exact: true }).click();
  await expect(tailor.getByText('Waiting for the customer’s answer.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your tailor’s proposal' })).toBeVisible();
  await capture(page, 'customer-proposal', [1440, 768, 390, 320]);
  await page.getByRole('button', { name: 'Accept the tailor’s changes', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('specification v2', { exact: false })).toBeVisible();
  const amended = (await (await page.request.get('/api/orders/' + number)).json()).order;
  expect(amended.measurements.values.find((m: { id: string }) => m.id === 'chest').mm).toBe(1030);
  expect(amended.tailorReview.status).toBe('completed');
  expect((await state(page)).draft.measurements.values.chest).toBe(1000);
  await capture(page, 'amended-order', [1440, 768, 390, 320]);
  await page.goto('/orders');
  await capture(page, 'orders-list', [1440, 768, 390, 320]);
  expect(errors).toEqual([]);
  await tailorContext.close();
});
