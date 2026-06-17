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
  // Knowledge redesign (work item 2.11): the legacy `/data/[[...query]]`
  // catch-all route was retired in favor of `/data` + `/data/[ctx]` with
  // `?tab/?view/?item` params. These 308 redirects keep every previously
  // valid URL working — covering deep links in toasts, notifications, chat
  // citations, saved bookmarks, etc. (see design/pages/knowledge.md §3 and
  // §4 risks: "Redirect shim must cover all 8 legacy URL shapes").
  async redirects() {
    return [
      // Pipeline stage URLs → ?tab=pipeline (anchor preserves stage focus).
      {
        source: '/data/:ctx/sources',
        destination: '/data/:ctx?tab=pipeline#sources',
        permanent: true,
      },
      {
        source: '/data/:ctx/processors',
        destination: '/data/:ctx?tab=pipeline#processor',
        permanent: true,
      },
      {
        source: '/data/:ctx/embeddings',
        destination: '/data/:ctx?tab=pipeline#embedder',
        permanent: true,
      },
      // Archived item deep link → ?view=archived&item=...
      {
        source: '/data/:ctx/archived/:item',
        destination: '/data/:ctx?view=archived&item=:item',
        permanent: true,
      },
      // Archived list view → ?view=archived
      {
        source: '/data/:ctx/archived',
        destination: '/data/:ctx?view=archived',
        permanent: true,
      },
      // Legacy item deep link → dedicated detail page (knowledge V2 Phase
      // F1). Kept last so it doesn't shadow the segment-named routes above.
      // Note: `/data/:ctx/items/:itemId` is now a real route, so this only
      // catches the old single-segment shape.
      {
        source: '/data/:ctx/:item',
        destination: '/data/:ctx/items/:item',
        permanent: true,
      },
    ];
  },
};

if (process.env.DOCKER) {
  baseConfig.output = "standalone";
}

module.exports = withNextIntl(baseConfig);
