import Link from 'next/link';
import { staffPage } from '@/modules/staff/page-guard';
import { OperationsDashboard } from '@/components/admin/operations';
export default async function Dashboard() {
  const staff = await staffPage();
  return (
    <>
      <div className="admin-title">
        <p className="admin-eyebrow">WORKROOM / OVERVIEW</p>
        <h1>A considered start.</h1>
        <p>Manage the details behind every design.</p>
      </div>
      <section className="admin-welcome">
        <div>
          <p className="admin-eyebrow">STAFF ACCESS IS READY</p>
          <h2>Your workroom, connected.</h2>
          <p>
            Your account has {staff.mfa.enabled ? 'authenticator protection' : 'development access'}{' '}
            and permissions for {staff.roles.map((r) => r.replaceAll('_', ' ')).join(', ')}.
          </p>
        </div>
        <span aria-hidden="true" className="admin-monogram">
          V
        </span>
      </section>
      <OperationsDashboard />
      <div className="admin-tiles">
        <article className="admin-card">
          <p className="admin-eyebrow">CATALOG</p>
          <h2>Design the collection</h2>
          <p>Set up products, prices and fabrics, then publish them to customers.</p>
          {staff.permissions.includes('catalog.read') && (
            <Link className="admin-action" href="/admin/catalog/products">
              Open catalog →
            </Link>
          )}
        </article>
        {staff.permissions.includes('staff.manage') && (
          <article className="admin-card">
            <p className="admin-eyebrow">PEOPLE & PERMISSIONS</p>
            <h2>A place for your team</h2>
            <p>Grant access to verified accounts and review staff activity.</p>
            <Link className="admin-action" href="/admin/settings">
              Manage staff →
            </Link>
          </article>
        )}
        <article className="admin-card">
          <p className="admin-eyebrow">ACCOUNT SECURITY</p>
          <h2>Keep your access protected</h2>
          <p>Use an authenticator app and save your backup codes somewhere private.</p>
          <Link className="admin-action" href="/admin/security">
            Account security →
          </Link>
        </article>
      </div>
    </>
  );
}
