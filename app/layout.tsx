import type { Metadata } from 'next';
import './globals.css';

const title = 'hEART 2026 Paper Explorer';
const description =
  'Explore 232 hEART 2026 papers by topic, research line, session and similarity.';

export const metadata: Metadata = {
  metadataBase: new URL('https://gnova3.github.io/hEART2026/'),
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    url: 'https://gnova3.github.io/hEART2026/',
    images: [{ url: 'og.png', width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
