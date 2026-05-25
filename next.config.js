/** @type {import('next').NextConfig} */

const withNextIntl = require('next-intl/plugin')(
  './i18n/config.ts'
);

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
];

const baseConfig = {
  productionBrowserSourceMaps: true,
  images: {
    domains: ["localhost"],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/n8n',
        destination: 'http://localhost:5678',
      },
      {
        source: '/n8n/:path*',
        destination: 'http://localhost:5678/:path*',
      },
    ];
  },
};

if (process.env.DOCKER) {
  baseConfig.output = "standalone";
}

module.exports = withNextIntl(baseConfig);
