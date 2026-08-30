import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LOCALE_COOKIE, defaultLocale, locales, type Locale } from './i18n/config';

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

function buildCsp(): string {
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

    const frameSrc = [
        "'self'",
        'https://accounts.google.com',
        s3,
    ].filter(Boolean).join(' ');
    const fontSrc = "'self' data: https://fonts.gstatic.com";

    return [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        `style-src ${styleSrc}`,
        `img-src ${imgSrc}`,
        `font-src ${fontSrc}`,
        `connect-src ${connectSrc}`,
        `frame-src ${frameSrc}`,
        // Allow blob: URLs for <audio>/<video> so the TTS feature can play
        // generated MP3s via URL.createObjectURL(). Without this Chrome rejects
        // the load with "Media load rejected by URL safety check".
        "media-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        'upgrade-insecure-requests',
    ].join('; ');
}

export default function proxy(request: NextRequest) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-next-pathname', encodeURIComponent(request.nextUrl.pathname));

    const locale = request.cookies.get(LOCALE_COOKIE)?.value || defaultLocale;
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

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    response.headers.set('Content-Security-Policy', buildCsp());

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};