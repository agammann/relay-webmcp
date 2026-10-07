import type { NextConfig } from 'next';

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/', headers: securityHeaders },
      { source: '/:path*', headers: securityHeaders },
    ];
  },
};

export default nextConfig;
