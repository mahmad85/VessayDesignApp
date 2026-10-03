import Link from 'next/link';

/** Header for the customer pages outside the studio (home, fabrics). */
export function SiteHeader({ current }: { current?: 'studio' | 'fabrics' }) {
  return (
    <header className="site-header fabrics-header">
      <Link className="wordmark" href="/" aria-label="Vessy home">
        vessy<span>®</span>
      </Link>
      <nav className="fabrics-nav" aria-label="Main">
        <Link href="/studio" aria-current={current === 'studio' ? 'page' : undefined}>
          Design studio
        </Link>
        <Link href="/fabrics" aria-current={current === 'fabrics' ? 'page' : undefined}>
          Fabrics
        </Link>
      </nav>
    </header>
  );
}
