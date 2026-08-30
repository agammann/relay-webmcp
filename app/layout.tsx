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
  metadataBase: new URL('https://relayplan-webmcp.alx21.chatgpt.site'),
  title: 'RelayPlan — One plan for you and your agents',
  description:
    'A shared WebMCP planning workspace for human tasks, agent assignments, deliverables, approvals, and visible handoffs.',
  openGraph: {
    title: 'RelayPlan — One plan for you and your agents',
    description:
      'A shared WebMCP planning workspace where humans stay in control and agents move real work forward.',
    images: [{ url: '/og.png', width: 1536, height: 1024, alt: 'RelayPlan human and agent task handoff diagram' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RelayPlan — One plan for you and your agents',
    description: 'A shared WebMCP planning workspace for humans and agents.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
