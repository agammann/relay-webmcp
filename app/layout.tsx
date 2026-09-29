import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://relay.alx21.chatgpt.site'),
  title: 'Relay — One plan for you and your agents',
  description:
    'A browser-bound workspace for human tasks, agent handoffs, deliverables, and review.',
  openGraph: {
    title: 'Relay — One plan for you and your agents',
    description:
      'Plan tasks, hand off structured work through WebMCP, and review deliverables.',
    images: [
      {
        url: '/og.png',
        width: 1536,
        height: 1024,
        alt: 'Relay human and agent task handoff diagram',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Relay — One plan for you and your agents',
    description:
      'Plan tasks and review agent deliverables in a workspace tied to your browser.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
