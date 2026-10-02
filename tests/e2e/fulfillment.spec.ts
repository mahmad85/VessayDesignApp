import { test, expect, type Page, type APIResponse } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import Stripe from 'stripe';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { totp } from '../helpers/totp';
import type { AdminOrder } from '../../src/db/fulfillment-repository';
const originHeaders = () => ({ Origin: new URL(test.info().project.use.baseURL!).origin });
async function ok(r: APIResponse) {
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function login(page: Page, file: string, mfa = false) {
  const account = JSON.parse(await readFile('.data/qa-' + file + '.json', 'utf8'));
  await ok(
    await page.request.post('/api/auth/sign-in/email', { headers: originHeaders(), data: account }),
  );
  if (mfa) {
    const setup = await ok(
      await page.request.post('/api/auth/two-factor/enable', {
        headers: originHeaders(),
        data: { password: account.password },
      }),
    );
    await ok(
      await page.request.post('/api/auth/two-factor/verify-totp', {
        headers: originHeaders(),
        data: { code: totp(new URL(setup.totpURI).searchParams.get('secret')!) },
      }),
    );
  }
  return account;
}
async function capture(page: Page, name: string, widths = [1440, 768, 390]) {
  // Client navigation can expose the new document before its metadata has settled.
  await expect(page).toHaveTitle(/\S/);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      name + ' ' + width,
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations, name + ' ' + width).toEqual([]);
    await page.screenshot({
      path: `test-results/fulfillment/${name}-${width}.png`,
      fullPage: true,
    });
  }
}
async function command(page: Page, command: unknown) {
  const s = await ok(await page.request.get('/api/studio'));
  return ok(
    await page.request.post('/api/studio', {
      headers: originHeaders(),
      data: { actionId: crypto.randomUUID(), expectedRevision: s.draft.revision, command },
    }),
  );
}
async function pay(page: Page, number: string) {
  const event = await ok(
      await page.request.post('/api/test/orders', { headers: originHeaders(), data: { number } }),
    ),
    raw = JSON.stringify(event);
  await ok(
    await page.request.post('/api/payments/stripe/webhook', {
      headers: {
        'Stripe-Signature': Stripe.webhooks.generateTestHeaderString({
          payload: raw,
          secret: 'whsec_SYNTHETIC_orders_only',
        }),
        'Content-Type': 'application/json',
      },
      data: raw,
    }),
  );
}
test.afterEach(async ({ request }) => {
  await ok(
    await request.post('/api/test/catalog', {
      headers: originHeaders(),
      data: { scenario: 'reference' },
    }),
  );
});
test('SYNTHETIC M6: publish → look → sign-off → signed payment → accepted tailor amendment → release → ship → support and customer tracking', async ({
  page,
  browser,
}) => {
  test.setTimeout(360000);
  await mkdir('test-results/fulfillment', { recursive: true });
  const staffContext = await browser.newContext(),
    staff = await staffContext.newPage(),
    supportContext = await browser.newContext(),
    support = await supportContext.newPage();
  const errors: string[] = [];
  for (const p of [page, staff, support]) {
    p.setDefaultTimeout(15000);
    p.on('pageerror', (e) => errors.push(e.message));
  }
  await login(staff, 'fulfillment-staff', true);
  const customer = await login(page, 'fulfillment-customer');
  await login(support, 'fulfillment-support', true);
  await ok(
    await staff.request.post('/api/test/catalog', {
      headers: originHeaders(),
      data: { scenario: 'priced' },
    }),
  );
  const products = await ok(await staff.request.get('/api/admin/catalog/products')),
    product = products.items.find((p: { code: string }) => p.code === 'suit');
  const materials = await ok(await staff.request.get('/api/admin/catalog/materials?limit=100')),
    material = materials.items.find((m: { code: string }) => m.code === 'navy-twill');
  const media = await ok(
    await staff.request.post('/api/admin/media', {
      headers: originHeaders(),
      multipart: {
        file: {
          name: 'synthetic-64.png',
          mimeType: 'image/png',
          buffer: await readFile('tests/fixtures/media/synthetic-64.png'),
        },
        altText: 'SYNTHETIC look fabric',
        rightsStatus: 'owned',
      },
    }),
  );
  const look = await ok(
    await staff.request.post('/api/admin/catalog/templates', {
      headers: originHeaders(),
      data: {
        code: 'synthetic-fulfillment-look',
        name: 'SYNTHETIC Fulfilment Look',
        productId: product.id,
        materialId: material.id,
        status: 'active',
        featured: true,
      },
    }),
  );
  await ok(
    await staff.request.put('/api/admin/catalog/templates/' + look.id + '/media', {
      headers: originHeaders(),
      data: { items: [{ mediaId: media.id, role: 'hero', sort: 0 }] },
    }),
  );
  await staff.goto('/admin/catalog/publish');
  await staff.getByRole('button', { name: 'Run catalog check', exact: true }).click();
  await expect(staff.getByText(/0 blocking errors/)).toBeVisible();
  await staff.getByLabel('I have reviewed these warnings').check();
  await staff.getByRole('button', { name: 'Continue', exact: true }).click();
  await staff.getByRole('button', { name: 'Continue', exact: true }).click();
  await staff.getByLabel('Release notes').fill('SYNTHETIC M6 full journey');
  await staff.getByRole('button', { name: 'Publish catalog', exact: true }).click();
  await expect(staff.getByRole('status')).toContainText(/live/);
  const catalogStatus = await ok(await staff.request.get('/api/admin/catalog/status'));
  const projection = await page.request.get('/api/catalog/v/' + catalogStatus.currentVersion);
  expect(projection.ok()).toBe(true);
  const projectionBytes = await projection.body();
  const size = {
    jsonBytes: projectionBytes.length,
    gzipBytes: gzipSync(projectionBytes).length,
    releaseLimitBytes: 5_000_000,
  };
  expect(size.jsonBytes).toBeLessThan(size.releaseLimitBytes);
  await writeFile('test-results/fulfillment/catalog-size.json', JSON.stringify(size, null, 2));
  await page.goto('/studio');
  await page.getByRole('button', { name: /Two-piece suit/ }).click();
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'SYNTHETIC Fulfilment Look' }) })
    .getByRole('button', { name: 'Customise this look' })
    .click();
  await expect(page.getByRole('heading', { name: /Good style/ })).toBeVisible();
  await command(page, {
    type: 'design',
    patch: { preferences: { occasion: 'wedding', climate: 'warm' } },
  });
  await command(page, { type: 'accept_design' });
  await page.reload();
  await page
    .getByRole('button', { name: /02.*Measurements|Measurements/ })
    .first()
    .click();
  for (const [name, value] of Object.entries({
    Height: '180',
    Chest: '100',
    'Body waist': '88',
    'Shoulder width': '45',
    'Sleeve length': '63',
    'Seat / hips': '100',
    'Inside leg': '80',
  }))
    await page.getByRole('textbox', { name, exact: true }).fill(value);
  await page.getByRole('button', { name: 'Confirm measurements', exact: true }).click();
  await page.getByRole('button', { name: 'Check my order', exact: true }).click();
  await page
    .getByLabel('I have reviewed the design of each garment and want it made as shown.')
    .check();
  await page
    .getByLabel(
      'These are my measurements. I confirm they are correct and understand my garments will be made to them.',
    )
    .check();
  await page.getByLabel('Add a tailor review', { exact: true }).check();
  await page.getByRole('button', { name: /Place order and pay/ }).click();
  await expect(page).toHaveURL(/\/orders\/VS-\d+/);
  const number = new URL(page.url()).pathname.split('/').at(-1)!;
  await pay(page, number);
  const list = await ok(await staff.request.get('/api/admin/orders?query=' + number)),
    id = list.items[0].id;
  const read = async (): Promise<AdminOrder> =>
    ok(await staff.request.get('/api/admin/orders/' + id));
  const supplier = await ok(
    await staff.request.post('/api/admin/suppliers', {
      headers: originHeaders(),
      data: {
        code: 'synthetic-fulfillment-maker',
        name: 'SYNTHETIC Fulfilment Manufacturer',
        kind: 'manufacturer',
        status: 'active',
        addressLine1: 'SYNTHETIC workshop',
        city: 'Fixture City',
        countryCode: 'US',
        primaryContact: { name: 'SYNTHETIC Dispatch', email: 'synthetic-dispatch@vessy.invalid' },
      },
    }),
  );
  await staff.goto('/admin/orders');
  await staff.getByRole('textbox', { name: 'Search by order number or email' }).fill(number);
  await expect(staff.getByRole('link', { name: number, exact: true })).toBeVisible();
  await capture(staff, 'order-desk');
  await staff.getByRole('link', { name: number, exact: true }).click();
  await staff.getByRole('button', { name: 'Fulfilment', exact: true }).focus();
  await staff.keyboard.press('Enter');
  const assign = staff.getByRole('form', { name: 'Assign all items' });
  await assign.getByLabel('Manufacturer', { exact: true }).selectOption(supplier.id);
  await assign.getByLabel('Supplier deadline').fill('2026-10-10');
  await assign.getByRole('button', { name: 'Assign all items', exact: true }).focus();
  await staff.keyboard.press('Enter');
  await expect.poll(async () => (await read()).items[0].supplier?.id).toBe(supplier.id);
  await expect(staff.getByRole('button', { name: 'Release all items' })).toBeDisabled();
  const blocked = await staff.request.post('/api/admin/orders/' + id + '/release', {
    headers: originHeaders(),
    data: { rowVersion: (await read()).rowVersion },
  });
  expect(blocked.status()).toBe(409);
  let o = await read();
  await staff.goto('/admin/reviews/' + o.reviewCases[0].id);
  await staff.getByRole('button', { name: 'Claim review', exact: true }).click();
  await staff.getByLabel('Outcome').selectOption('changes_proposed');
  await staff.getByLabel(/^Chest — current/).fill('103');
  await staff
    .getByLabel('Message to customer')
    .fill('SYNTHETIC: confirm the proposed chest measurement.');
  await staff.getByRole('button', { name: 'Submit decision', exact: true }).click();
  await expect(staff.getByText('Waiting for the customer’s answer.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Accept the tailor’s changes', exact: true }).click();
  await expect(page.getByText('specification v2', { exact: false })).toBeVisible();
  await staff.goto('/admin/orders/' + id);
  await capture(staff, 'order-summary');
  await staff.getByRole('button', { name: 'Specification', exact: true }).click();
  await capture(staff, 'specification');
  o = await read();
  const sheet = await ok(
    await staff.request.get(
      `/api/admin/orders/${id}/items/${o.items[0].id}/production-sheet?format=json`,
    ),
  );
  expect(sheet.measurements.values.find((m: { id: string }) => m.id === 'chest').mm).toBe(1030);
  const print = await staffContext.newPage();
  await print.goto(`/api/admin/orders/${id}/items/${o.items[0].id}/production-sheet`);
  await capture(print, 'production-sheet', [1440, 390]);
  await print.close();
  await staff.getByRole('button', { name: 'Measurements', exact: true }).click();
  await capture(staff, 'measurements');
  await staff.getByRole('button', { name: 'Tailor review', exact: true }).click();
  await capture(staff, 'review-history');
  await staff.getByRole('button', { name: 'Payment', exact: true }).click();
  await capture(staff, 'payment-history');
  await staff.getByRole('button', { name: 'Fulfilment', exact: true }).click();
  await staff.getByRole('button', { name: 'Release all items', exact: true }).click();
  await expect.poll(async () => (await read()).fulfillment).toBe('released');
  const item = staff.getByRole('article', { name: 'Item 1' });
  await item.getByRole('button', { name: 'Start production', exact: true }).click();
  await expect.poll(async () => (await read()).fulfillment).toBe('in_production');
  await item
    .getByLabel('Reason (required for hold, cancellation or rework)')
    .fill('SYNTHETIC internal hold');
  await item.getByRole('button', { name: 'Put on hold' }).click();
  await expect.poll(async () => (await read()).fulfillment).toBe('on_hold');
  await capture(staff, 'fulfillment-hold');
  await item.getByRole('button', { name: /Resume/ }).click();
  await expect.poll(async () => (await read()).fulfillment).toBe('in_production');
  const single = item.getByRole('form', { name: 'Supplier assignment' });
  await single.getByLabel('Supplier deadline').fill('2026-10-12');
  await single.getByLabel('Reason for change').fill('SYNTHETIC deadline adjustment');
  await single.getByRole('button', { name: 'Save assignment' }).click();
  await expect.poll(async () => (await read()).items[0].dueDate).toBe('2026-10-12');
  await item.getByRole('button', { name: 'Quality check', exact: true }).click();
  await item.getByRole('button', { name: 'Ready to ship', exact: true }).click();
  await item.getByLabel('Carrier', { exact: true }).fill('SYNTHETIC Carrier');
  await item.getByLabel('Tracking number').fill('SYNTHETIC-001');
  await item
    .getByLabel('Tracking URL (optional)')
    .fill('https://example.invalid/track/SYNTHETIC-001');
  await capture(staff, 'shipping-form');
  await item.getByRole('button', { name: 'Ship item' }).click();
  await expect.poll(async () => (await read()).fulfillment).toBe('shipped');
  await staff.getByRole('button', { name: 'Summary', exact: true }).click();
  await staff.getByLabel('Estimated delivery date').fill('2026-10-15');
  await staff.getByLabel('Reason for estimate change').fill('SYNTHETIC staff estimate');
  await staff.getByRole('button', { name: 'Save delivery estimate' }).click();
  await expect.poll(async () => (await read()).customerEtaDate).toBe('2026-10-15');
  await staff.getByRole('button', { name: 'Activity', exact: true }).click();
  await staff.getByLabel('Note', { exact: true }).fill('SYNTHETIC internal logistics note');
  await staff.getByRole('button', { name: 'Add note', exact: true }).click();
  await expect(staff.getByText('SYNTHETIC internal logistics note', { exact: true })).toBeVisible();
  await capture(staff, 'activity');
  await staff.goto('/admin/suppliers/' + supplier.id);
  await staff.getByRole('tab', { name: 'assigned items' }).click();
  await expect(staff.getByRole('link', { name: number, exact: true })).toBeVisible();
  await capture(staff, 'supplier-items');
  await staff.goto('/admin');
  await expect(staff.getByRole('heading', { name: 'Today in the workroom' })).toBeVisible();
  await capture(staff, 'dashboard');
  await support.goto('/admin/customers');
  await expect(support.getByText('Enter at least 3 characters.')).toBeVisible();
  await support.getByLabel('Name or email').fill(customer.email);
  await support.getByRole('button', { name: 'Search customers' }).click();
  await expect(support.getByRole('link', { name: 'SYNTHETIC fulfillment-customer' })).toBeVisible();
  await capture(support, 'support-search');
  await support.getByRole('link', { name: 'SYNTHETIC fulfillment-customer' }).click();
  await expect(
    support.getByRole('heading', { name: 'SYNTHETIC fulfillment-customer', exact: true }),
  ).toBeVisible();
  await expect(support.getByRole('link', { name: number, exact: true })).toBeVisible();
  await capture(support, 'support-customer');
  await support.getByRole('link', { name: number, exact: true }).click();
  await expect(support.getByRole('heading', { name: number, exact: true })).toBeVisible();
  await expect(support.getByRole('button', { name: 'Measurements', exact: true })).toHaveCount(0);
  const safe = await ok(await support.request.get('/api/admin/orders/' + id));
  expect(safe.snapshot.measurements).toBeNull();
  expect(JSON.stringify(safe)).not.toContain('1030');
  await capture(support, 'support-order');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Track shipment' })).toHaveAttribute(
    'href',
    'https://example.invalid/track/SYNTHETIC-001',
  );
  await expect(page.getByText('Expected delivery: 2026-10-15')).toBeVisible();
  expect(await page.locator('body').innerText()).not.toContain('SYNTHETIC Fulfilment Manufacturer');
  expect(await page.locator('body').innerText()).not.toContain('internal logistics');
  await capture(page, 'customer-tracking', [1440, 768, 390, 320]);
  await staff.goto('/admin/orders/' + id);
  await staff.getByRole('button', { name: 'Fulfilment', exact: true }).click();
  await staff.getByRole('button', { name: 'Mark delivered', exact: true }).click();
  await staff.getByRole('button', { name: 'Complete item', exact: true }).click();
  await expect.poll(async () => (await read()).fulfillment).toBe('completed');
  // A second order with no tailor review releases directly after verified payment.
  await command(page, {
    type: 'design',
    patch: { preferences: { occasion: 'wedding', climate: 'warm' } },
  });
  await command(page, { type: 'accept_design' });
  let state = await ok(await page.request.get('/api/studio'));
  await ok(
    await page.request.post('/api/studio/check', {
      headers: originHeaders(),
      data: { actionId: crypto.randomUUID(), expectedRevision: state.draft.revision },
    }),
  );
  state = await ok(await page.request.get('/api/studio'));
  const placed = await ok(
    await page.request.post('/api/orders', {
      headers: originHeaders(),
      data: {
        actionId: crypto.randomUUID(),
        expectedRevision: state.draft.revision,
        checkId: state.draft.review.id,
        signoff: { design: true, measurements: true, statementVersion: 'signoff-v1' },
        tailorReview: false,
        acceptTotal: { amountMinor: state.quote.totalMinor, currency: state.quote.currency },
      },
    }),
  );
  await ok(
    await page.request.post('/api/orders/' + placed.order.number + '/checkout', {
      headers: originHeaders(),
      data: { actionId: crypto.randomUUID() },
    }),
  );
  await pay(page, placed.order.number);
  const second = (
    await ok(await staff.request.get('/api/admin/orders?query=' + placed.order.number))
  ).items[0];
  await staff.goto('/admin/orders/' + second.id);
  await staff.getByRole('button', { name: 'Fulfilment', exact: true }).click();
  const all = staff.getByRole('form', { name: 'Assign all items' });
  await all.getByLabel('Manufacturer', { exact: true }).selectOption(supplier.id);
  await all.getByLabel('Supplier deadline').fill('2026-10-20');
  await all.getByRole('button', { name: 'Assign all items', exact: true }).click();
  await expect(staff.getByRole('button', { name: 'Release all items' })).toBeEnabled();
  await staff.getByRole('button', { name: 'Release all items' }).click();
  await expect
    .poll(
      async () => (await ok(await staff.request.get('/api/admin/orders/' + second.id))).fulfillment,
    )
    .toBe('released');
  await capture(staff, 'direct-release', [1440, 390]);
  expect(errors).toEqual([]);
  await staffContext.close();
  await supportContext.close();
});
