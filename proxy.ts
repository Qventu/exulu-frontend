import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LOCALE_COOKIE, defaultLocale, locales, type Locale } from './i18n/config';
import { decideHostRouting, localeFromSearch, readHostRoutingConfig } from './lib/host-routing';

const isDev = process.env.NODE_ENV !== 'production';

function backendOrigin(): string {
    try {
        return process.env.BACKEND ? new URL(process.env.BACKEND).origin : '';
    } catch {
        return '';
    }
}

function s3Origin(): string {
    try {
        return process.env.COMPANION_S3_ENDPOINT ? new URL(process.env.COMPANION_S3_ENDPOINT).origin : '';
    } catch {
        return '';
    }
}

function redisOrigin(): string {
    try {
        return process.env.REDIS_HOST ? new URL(process.env.REDIS_HOST).origin : '';
    } catch {
        return '';
    }
}

function feedbackOrigin(): string {
    try {
        return process.env.FEEDBACK_BACKEND ? new URL(process.env.FEEDBACK_BACKEND).origin : '';
    } catch {
        return '';
    }
}

export function buildCsp(): string {
    const backend = backendOrigin();
    const s3 = s3Origin();
    const redis = redisOrigin();
    const feedback = feedbackOrigin();

    const scriptSrc = [
        "'self'",
        "'unsafe-inline'",
        // Shiki uses WebAssembly for syntax highlighting; wasm-unsafe-eval
        // permits only wasm instantiation (not arbitrary eval) so it is safe
        // in production. unsafe-eval is still needed in dev for Next.js HMR.
        "'wasm-unsafe-eval'",
        isDev && "'unsafe-eval'",
        'https://cdn.jsdelivr.net',
        'https://accounts.google.com',
        'https://apis.google.com',
    ].filter(Boolean).join(' ');

    const styleSrc = "'self' 'unsafe-inline' https://fonts.googleapis.com";

    const imgSrc = [
        "'self'",
        'data:',
        'blob:',
        'https://*.googleusercontent.com',
        backend,
        redis,
        s3,
        feedback,
    ].filter(Boolean).join(' ');

    const connectSrc = [
        "'self'",
        'https://accounts.google.com',
        'https://www.googleapis.com',
        'https://admin.googleapis.com',
        backend,
        redis,
        s3,
        feedback,
        isDev && 'ws:',
        isDev && 'wss:',
    ].filter(Boolean).join(' ');

    // blob: — the in-shell artifact viewer (/artifacts/open/<name>) shows a
    // PDF from URL.createObjectURL(); the content route itself cannot be
    // framed (X-Frame-Options: DENY), and a blob: URL carries no headers.
    const frameSrc = [
        "'self'",
        'blob:',
        'https://accounts.google.com',
        s3,
    ].filter(Boolean).join(' ');
    const fontSrc = "'self' data: https://fonts.gstatic.com";

    // <audio>/<video> sources:
    // - blob: — chat TTS plays generated MP3s via URL.createObjectURL();
    //   without it Chrome rejects the load with "Media load rejected by URL
    //   safety check".
    // - s3 — presigned URLs for uploaded audio (transcriptions AudioTimeline)
    //   and locally stored meeting video (video_s3key) live on the
    //   COMPANION_S3_ENDPOINT origin, same as img-src/frame-src above.
    // - *.amazonaws.com — Recall's on-demand meeting video (recordingVideoUrl)
    //   is a signed URL on a regional bucket such as
    //   eu-central-1-recallai-production-bot-data.s3.amazonaws.com; the
    //   wildcard covers every Recall region. A blocked source renders as an
    //   empty 0:00 player with no network request (ALGI, 2026-09-23).
    const mediaSrc = [
        "'self'",
        'blob:',
        s3,
        'https://*.amazonaws.com',
    ].filter(Boolean).join(' ');

    return [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        `style-src ${styleSrc}`,
        `img-src ${imgSrc}`,
        `font-src ${fontSrc}`,
        `connect-src ${connectSrc}`,
        `frame-src ${frameSrc}`,
        `media-src ${mediaSrc}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        'upgrade-insecure-requests',
    ].join('; ');
}

export default function proxy(request: NextRequest) {
    // Which part of the product this hostname serves (lib/host-routing.ts).
    // Decided on the Host header alone: it is what the platform routed on,
    // whereas X-Forwarded-Host can be supplied by the caller, and this decision
    // is what keeps the internal application off the public hostname.
    const routing = decideHostRouting(
        request.headers.get('host'),
        request.nextUrl.pathname,
        readHostRoutingConfig(),
    );

    if (routing.kind === 'notFound') {
        return new NextResponse('Not found', {
            status: 404,
            headers: { 'Content-Security-Policy': buildCsp() },
        });
    }

    if (routing.kind === 'redirect') {
        // Path and query travel along, so a link sent out under the old
        // address — including its ?lang= — lands on the same page.
        const target = request.nextUrl.clone();
        target.protocol = 'https';
        target.host = routing.host;
        target.port = '';
        return NextResponse.redirect(target, 307);
    }

    const pathname = routing.kind === 'rewrite' ? routing.pathname : request.nextUrl.pathname;

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-next-pathname', encodeURIComponent(pathname));

    // ?lang= wins over the cookie for this request and is written to the cookie
    // on the way out, so it survives the redirects that follow a first visit.
    const queryLocale = localeFromSearch(request.nextUrl.searchParams.get('lang'));
    const locale = queryLocale || request.cookies.get(LOCALE_COOKIE)?.value || defaultLocale;
    const validLocale = locales.includes(locale as Locale) ? locale : defaultLocale;
    requestHeaders.set('x-locale', validLocale);

    // Where the guided demo currently is, forwarded so SERVER-side fixture
    // reads are scoped to this request.
    //
    // lib/demo/current-position.ts keeps the position in a module-level
    // variable, and the only thing that writes it is the client TourProvider.
    // Server components therefore read the default — chapter 1, step 0 — no
    // matter which chapter the visitor is on. Worse for a public demo: a module
    // global is shared by every concurrent request, so two prospects browsing
    // at once would resolve each other's data if it ever were written on the
    // server. A request header is the correct scope for both.
    const tour = request.nextUrl.searchParams.get('tour');
    if (tour) requestHeaders.set('x-demo-tour', tour);

    let response: NextResponse;
    if (routing.kind === 'rewrite') {
        // A rewrite, not a redirect: the address bar keeps the bare hostname.
        const target = request.nextUrl.clone();
        target.pathname = routing.pathname;
        response = NextResponse.rewrite(target, { request: { headers: requestHeaders } });
    } else {
        response = NextResponse.next({ request: { headers: requestHeaders } });
    }

    if (queryLocale) {
        response.cookies.set(LOCALE_COOKIE, queryLocale, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            sameSite: 'lax',
        });
    }

    response.headers.set('Content-Security-Policy', buildCsp());

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};