'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, ShieldCheck, LayoutDashboard, Settings2 } from 'lucide-react';
import type { StaffContext } from '@/modules/staff/authorize';
type StaffPermission = StaffContext['permissions'][number];
import { PublishBar } from './publishing';
const navigation: {
  heading: string | null;
  items: {
    href: string;
    label: string;
    icon: typeof Settings2;
    permission: StaffPermission | null;
  }[];
}[] = [
  {
    heading: null,
    items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard, permission: null }],
  },
  {
    heading: 'Catalog',
    items: [
      {
        href: '/admin/catalog/products',
        label: 'Products',
        icon: Settings2,
        permission: 'catalog.read',
      },
      {
        href: '/admin/catalog/fabrics',
        label: 'Fabrics',
        icon: Settings2,
        permission: 'catalog.read',
      },
      {
        href: '/admin/catalog/publish',
        label: 'Publish & history',
        icon: Settings2,
        permission: 'catalog.read',
      },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { href: '/admin/orders', label: 'Order desk', icon: Settings2, permission: 'orders.read' },
      {
        href: '/admin/suppliers',
        label: 'Suppliers',
        icon: Settings2,
        permission: 'suppliers.read',
      },
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
    ],
  },
  {
    // D-022: rules, ready-made styles, lists, media and the band price matrix
    // are out of the v1 menu; their pages still work for developers.
    heading: 'Settings',
    items: [
      {
        href: '/admin/settings',
        label: 'Staff & audit',
        icon: Settings2,
        permission: 'staff.manage',
      },
      { href: '/admin/security', label: 'Account security', icon: ShieldCheck, permission: null },
    ],
  },
];
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
          {navigation.map((group) => {
            const items = group.items.filter(
              (item) => !item.permission || staff.permissions.includes(item.permission),
            );
            if (!items.length) return null;
            return (
              <div className="admin-nav-group" key={group.heading ?? 'home'}>
                {group.heading && <p className="admin-nav-heading">{group.heading}</p>}
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={
                      pathname === item.href ||
                      (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
                        ? 'page'
                        : undefined
                    }
                  >
                    <item.icon size={18} />
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
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
          <Link
            href={
              staff.permissions.includes('catalog.read') ? '/studio?catalog=working' : '/studio'
            }
          >
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
