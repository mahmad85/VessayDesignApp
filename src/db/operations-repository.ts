import { z } from 'zod';
import { getDatabase } from './client';
import { missing } from './admin-mutations';
import { catalogStatus, catalogDiff } from './catalog-publishing';
import { currentItemsClause } from './fulfillment-repository';
import { opsToday } from '@/modules/orders/fulfillment';
import type { Permission } from '@/modules/staff/permissions';
import type { DraftV2 } from '@/modules/configuration/types';
import type { CatalogSnapshot } from '@/modules/catalog/snapshot';
const at = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const userView = (u: Record<string, unknown>) => ({
  userId: String(u.id),
  name: String(u.name),
  email: String(u.email),
  emailVerified: u.email_verified === true,
  createdAt: at(u.created_at),
});
export async function findCustomers(input: unknown) {
  const { query } = z.object({ query: z.string().trim().min(3).max(200) }).parse(input),
    q = (await getDatabase()).query;
  const rows = await q(
    'SELECT u.id,u.name,u.email,u.email_verified,u.created_at,(SELECT count(*)::int FROM orders o WHERE o.user_id=u.id) AS order_count FROM "user" u WHERE u.name ILIKE $1 OR u.email ILIKE $1 ORDER BY u.name,u.id LIMIT 25',
    ['%' + query.replace(/[\\%_]/g, '\\$&') + '%'],
  );
  return { items: rows.map((u) => ({ ...userView(u), orderCount: Number(u.order_count) })) };
}
export async function supportCustomer(id: string) {
  const q = (await getDatabase()).query,
    [u] = await q('SELECT id,name,email,email_verified,created_at FROM "user" WHERE id=$1', [id]);
  if (!u) missing();
  const orders = await q(
    'SELECT id,number,submitted_at,total_minor,currency,payment_status,tailor_review_status,fulfillment_status FROM orders WHERE user_id=$1 ORDER BY submitted_at DESC,id DESC',
    [id],
  );
  const [saved] = await q('SELECT data,updated_at FROM drafts WHERE owner=$1', ['user:' + id]);
  let draft = null;
  if (saved) {
    const data = saved.data as DraftV2,
      garments = [];
    for (const g of data.garments ?? []) {
      const [r] = await q('SELECT snapshot FROM catalog_releases WHERE version=$1', [
        g.catalogVersion,
      ]);
      const s = r?.snapshot as CatalogSnapshot | undefined;
      garments.push({
        productName: s?.products.find((p) => p.code === g.productCode)?.name ?? g.productCode,
        materialName: s?.materials.find((m) => m.code === g.materialCode)?.name ?? g.materialCode,
        quantity: g.quantity,
        templateName: s?.templates.find((t) => t.code === g.templateCode)?.name ?? null,
      });
    }
    draft = {
      garments,
      measurementsConfirmed: data.measurements?.confirmed === true,
      updatedAt: at(saved.updated_at),
    };
  }
  return {
    user: userView(u),
    orders: orders.map((o) => ({
      id: String(o.id),
      number: String(o.number),
      submittedAt: at(o.submitted_at),
      totalMinor: Number(o.total_minor),
      currency: String(o.currency),
      payment: String(o.payment_status),
      tailorReview: String(o.tailor_review_status),
      fulfillment: String(o.fulfillment_status),
    })),
    draft,
  };
}
export type SupportCustomer = Awaited<ReturnType<typeof supportCustomer>>;
export async function operationsDashboard(permissions: readonly Permission[]) {
  const q = (await getDatabase()).query,
    tiles: { label: string; count: number; href: string }[] = [];
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await q(sql, params))[0]?.n ?? 0);
  if (permissions.includes('catalog.read')) {
    const s = await catalogStatus(),
      diff = await catalogDiff();
    tiles.push(
      {
        label: 'Unpublished catalog changes',
        count: diff.added.length + diff.changed.length + diff.removed.length,
        href: '/admin/catalog/publish',
      },
      { label: 'Catalog errors', count: s.errors, href: '/admin/catalog/publish' },
      { label: 'Catalog warnings', count: s.warnings, href: '/admin/catalog/publish' },
    );
  }
  if (permissions.includes('reviews.read'))
    for (const [label, where, filter] of [
      ['Tailor reviews waiting', "status IN ('pending','in_review')", 'status=pending,in_review'],
      [
        'Overdue tailor reviews',
        "status IN ('pending','in_review') AND due_at<now()",
        'overdue=true',
      ],
      ['Awaiting customer answer', "status='awaiting_customer'", 'status=awaiting_customer'],
    ])
      tiles.push({
        label,
        count: await count('SELECT count(*)::int AS n FROM review_cases WHERE ' + where),
        href: '/admin/reviews?' + filter,
      });
  if (permissions.includes('orders.read')) {
    tiles.push(
      {
        label: 'Paid orders ready to release',
        count: await count(
          "SELECT count(*)::int AS n FROM orders WHERE payment_status='succeeded' AND tailor_review_status IN ('not_requested','completed') AND fulfillment_status='not_released'",
        ),
        href: '/admin/orders?readyToRelease=true',
      },
      {
        label: 'Payments needing attention',
        count: await count('SELECT count(*)::int AS n FROM orders WHERE needs_attention'),
        href: '/admin/orders?needsAttention=true',
      },
    );
    const [c] = await q('SELECT ops_timezone FROM commerce_settings LIMIT 1');
    const overdue = await q(
      `SELECT s.id,s.name,count(*)::int AS n FROM order_items i JOIN orders o ON o.id=i.order_id JOIN suppliers s ON s.id=i.supplier_id WHERE ${currentItemsClause} AND i.fulfillment_status IN ('released','in_production','quality_check') AND i.supplier_due_date<$1::date GROUP BY s.id,s.name ORDER BY s.name`,
      [opsToday(String(c?.ops_timezone ?? 'UTC'))],
    );
    for (const s of overdue)
      tiles.push({
        label: 'Overdue · ' + s.name,
        count: Number(s.n),
        href: '/admin/orders?overdue=true&supplierId=' + s.id,
      });
    if (!overdue.length)
      tiles.push({ label: 'Overdue supplier items', count: 0, href: '/admin/orders?overdue=true' });
  }
  if (permissions.includes('orders.notifications.retry'))
    tiles.push({
      label: 'Failed notifications',
      count: await count("SELECT count(*)::int AS n FROM notifications WHERE status='failed'"),
      href: '/admin/orders?failedNotifications=true',
    });
  return { tiles };
}
