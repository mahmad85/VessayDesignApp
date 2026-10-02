import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfigured, getAuth } from '@/lib/auth';
export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  // Always opt into request rendering, including builds without auth secrets.
  const requestHeaders = await headers();
  const session = authConfigured()
    ? await (await getAuth()).api.getSession({ headers: requestHeaders })
    : null;
  if (!session) redirect('/account?next=/orders');
  return (
    <div className="orders-shell">
      <header>
        <Link className="wordmark" href="/">
          vessy<span>®</span>
        </Link>
        <nav aria-label="Orders navigation">
          <Link href="/studio">Back to studio</Link>
          <Link href="/account">Your account</Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
