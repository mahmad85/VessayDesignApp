import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="center-state">
      <h1>A different direction.</h1>
      <p>This page is not part of your studio.</p>
      <Link className="button button-primary" href="/">
        Back to the studio
      </Link>
    </main>
  );
}
