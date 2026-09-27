import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Vessy — Your personal tailoring studio',
  description:
    'A thoughtful way to make a suit, shirt or blazer your own. Design, measure and review in one personal tailoring studio.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
