'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, ShieldCheck, LayoutDashboard, Settings2 } from 'lucide-react';
import type { StaffContext } from '@/modules/staff/authorize';
import { PublishBar } from './publishing';
const navigation = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, permission: null },
  ...['products', 'fabrics', 'lists', 'pricing', 'templates', 'rules', 'media', 'publish'].map(
    (screen, i) => ({
      href: `/admin/catalog/${screen}`,
      label: [
        'Products & options',
        'Fabrics',
        'Lists',
        'Pricing',
        'Looks',
        'Rules',
        'Media',
        'Publish & history',
      ][i],
      icon: Settings2,
      permission: 'catalog.read' as const,
    }),
  ),
  { href: '/admin/suppliers', label: 'Suppliers', icon: Settings2, permission: 'suppliers.read' },
  { href: '/admin/orders', label: 'Order desk', icon: Settings2, permission: 'orders.read' },
  {
    href: '/admin/customers',
    label: 'Customer lookup',
    icon: Settings2,
    permission: 'customers.read',
  },
  {
    href: '/admin/reviews',
    label: 'Tailor reviews',
    icon: ShieldCheck,
    permission: 'reviews.read',
  },
  { href: '/admin/settings', label: 'Staff & audit', icon: Settings2, permission: 'staff.manage' },
  { href: '/admin/security', label: 'Account security', icon: ShieldCheck, permission: null },
] as const;
export function AdminShell({
  staff,
  children,
}: {
  staff: StaffContext;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="admin-shell">
      <a className="admin-skip" href="#admin-main">
        Skip to content
      </a>
      <aside className="admin-sidebar">
        <Link className="wordmark" href="/admin">
          vessy<span>®</span>
        </Link>
        <p className="admin-eyebrow">THE WORKROOM</p>
        <nav aria-label="Administration">
          {navigation
            .filter((item) => !item.permission || staff.permissions.includes(item.permission))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="admin-sidebar-foot">
          <span className="admin-dot" />{' '}
          {process.env.NODE_ENV === 'production' ? 'Staff workspace' : 'Development workspace'}
          <p>Reference catalog</p>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <div>
            <strong>{staff.user.name}</strong>
            <p>{staff.roles.map((role) => role.replaceAll('_', ' ')).join(' · ')}</p>
          </div>
          <Link href={staff.permissions.includes('catalog.read') ? '/?catalog=working' : '/'}>
            {staff.permissions.includes('catalog.read') ? 'Preview as customer' : 'Customer studio'}{' '}
            <ArrowUpRight size={16} />
          </Link>
        </header>
        {staff.permissions.includes('catalog.read') && <PublishBar />}
        <main id="admin-main" tabIndex={-1} className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
