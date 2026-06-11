# Internationalization (i18n) Guide

The app supports English and German via a custom `LanguageProvider` (which wraps
`next-intl`'s `NextIntlClientProvider`) and a cookie-based locale, with `i18n/config.ts`
as the single source of truth for locale constants.

## Architecture Overview

| Piece | File | Role |
|---|---|---|
| Locale constants | `i18n/config.ts` | `locales`, `Locale` type, `defaultLocale`, `LOCALE_COOKIE` — the **only** place locales are declared |
| Proxy | `proxy.ts` | Imports the constants from `i18n/config.ts`, reads the `NEXT_LOCALE` cookie, sets the validated locale on the `x-locale` request header |
| Translation files | `messages/en.json`, `messages/de.json` | One JSON file per locale, identical key sets (enforced in CI) |
| Provider | `components/shell/language-provider.tsx` | Client context (`useLanguage`) + `NextIntlClientProvider`; owns cookie writes and message loading |
| Root layouts | `app/(application)/layout.tsx`, `app/(authentication)/layout.tsx` | Read the cookie server-side, set `<html lang>`, import the locale's messages and pass them to `LanguageProvider` |
| Parity check | `scripts/check-messages.js` | `npm run check-messages` — fails (exit 1) when en/de key sets diverge |

How a request flows:

1. `proxy.ts` reads the `NEXT_LOCALE` cookie, validates it against `locales` from
   `i18n/config.ts`, and forwards it as the `x-locale` header.
2. The root layout reads the cookie via `cookies()`, sets `<html lang={locale}>`, imports
   `messages/<locale>.json`, and hands both to `LanguageProvider`.
3. `LanguageProvider` exposes `{ locale, setLocale }` through `useLanguage()` and feeds the
   messages into `NextIntlClientProvider`, so `useTranslations()` works in any client
   component below it.
4. `setLocale()` writes the cookie (1-year expiry), loads the new messages, then reloads the
   page so server-rendered content picks up the new locale too.

> Note: there is no `next-intl` request config (`getRequestConfig`), so the server-side
> `getTranslations` API is **not** wired up. Translate in client components via
> `useTranslations`; in server components, read the cookie and access the imported messages
> directly (see below).

## Adding New Translations

### 1. Update both translation files — in the same PR

Add the keys under your feature's namespace to **both** files:

**`messages/en.json`**
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is a description"
  }
}
```

**`messages/de.json`**
```json
{
  "myFeature": {
    "title": "Meine Funktion",
    "description": "Dies ist eine Beschreibung"
  }
}
```

Then run the parity check:

```bash
npm run check-messages
```

It prints any keys missing from either locale and exits non-zero on mismatch (CI runs it
too, so en/de parity is a merge requirement).

### 2. Namespace conventions

- **Namespace = feature** (camelCase of the feature folder): `chat.*`, `agents.*`,
  `knowledge.*` (despite the `/data` route), `models.*`, `evals.*`, `prompts.*`, `skills.*`,
  `workflows.*`, `variables.*`, `access.*` (users + roles + teams), `budgets.*`,
  `analytics.*`, `keys.*`, `token.*`, `settings.*`, `configuration.*`, `transcriptions.*`,
  `projects.*`, `feedbackReview.*` (triage console) vs `feedback.*` (submit widget),
  `auth.*`, `home.*`, `explorer.*`.
- **Shared namespaces:** `common.*` (primitive built-ins: cancel/confirm/delete/copy/
  copied/search/retry/noResults) and `navigation.*`.
- Keys are camelCase, max depth 3 (`namespace.section.key`).
- Shared primitives may use `useTranslations("common")` for their built-in strings only;
  all other copy arrives via props.

### 3. Using translations in client components

```tsx
"use client";

import { useTranslations } from 'next-intl';

export function MyClientComponent() {
  // Scoped to a namespace (preferred):
  const t = useTranslations('myFeature');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### 4. Using translations in server components

`getTranslations` is not configured — read the locale from the cookie and pull strings from
the imported messages:

```tsx
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, Locale, defaultLocale } from '@/i18n/config';

export default async function MyServerComponent() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get(LOCALE_COOKIE)?.value as Locale) || defaultLocale;
  // Use a relative path to /messages from your file's location:
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return <h1>{messages.myFeature.title}</h1>;
}
```

In practice almost all translated UI is client-side; the server-side pattern is mainly used
by the root layouts.

### 5. Translations with variables

**Translation file:**
```json
{
  "myFeature": {
    "greeting": "Hello {name}!",
    "itemCount": "You have {count} items"
  }
}
```

**Component:**
```tsx
const t = useTranslations('myFeature');

<p>{t('greeting', { name: 'John' })}</p>
<p>{t('itemCount', { count: 5 })}</p>
```

## Language Toggle

The toggle lives in the sidebar user dropdown (`components/shell/main-nav.tsx`) and calls
`setLocale` from `useLanguage()`. That:

1. Writes the `NEXT_LOCALE` cookie (1-year expiry)
2. Loads the new locale's messages
3. Reloads the page so server-rendered output (including `<html lang>`) updates

## Accessing the Current Locale

### In client components

```tsx
"use client";

import { useLanguage } from '@/components/shell/language-provider';

export function MyComponent() {
  const { locale, setLocale } = useLanguage();

  return (
    <button onClick={() => setLocale(locale === 'en' ? 'de' : 'en')}>
      Current language: {locale}
    </button>
  );
}
```

### In server components

```tsx
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, defaultLocale } from '@/i18n/config';

export default async function MyServerComponent() {
  const cookieStore = await cookies();
  const locale = cookieStore.get(LOCALE_COOKIE)?.value || defaultLocale;

  return <div>Current locale: {locale}</div>;
}
```

## Adding a New Language

1. **Create the translation file**: `messages/fr.json` with the full key set (copy
   `en.json` as the template).
2. **Update the single source**: in `i18n/config.ts`:
   ```typescript
   export const locales = ['en', 'de', 'fr'] as const;
   ```
   `proxy.ts` and `LanguageProvider` pick this up automatically.
3. **Update the parity check**: add the locale to the `locales` list at the top of
   `scripts/check-messages.js` (kept in sync manually because the script is zero-dep
   plain Node and cannot import the TypeScript config).
4. **Update the language toggle**: extend the toggle in `components/shell/main-nav.tsx`
   (it currently flips between exactly `en` and `de`).
5. Run `npm run check-messages` to confirm the new file has full key parity.

## File Structure

```
/
├── i18n/
│   └── config.ts                       # locales, Locale, defaultLocale, LOCALE_COOKIE
├── messages/
│   ├── en.json                         # English translations
│   └── de.json                         # German translations
├── proxy.ts                            # cookie -> x-locale header (imports i18n/config.ts)
├── components/shell/
│   ├── language-provider.tsx           # LanguageProvider + useLanguage()
│   └── main-nav.tsx                    # language toggle
├── app/(application)/layout.tsx        # reads cookie, <html lang>, mounts provider
├── app/(authentication)/layout.tsx     # reads cookie, <html lang>
└── scripts/
    └── check-messages.js               # npm run check-messages (en/de key parity)
```

## Best Practices

1. **One namespace per feature** — follow the table in section 2 above; don't invent
   parallel namespaces for the same feature.
2. **en + de land in the same PR** — `npm run check-messages` enforces key parity, so a
   missing translation fails CI.
3. **No hardcoded user-facing strings** in redesigned/migrated folders — scoped
   `react/jsx-no-literals` lint enforces this; add keys instead.
4. **Real translations, not placeholders** — don't copy the English string into `de.json`
   just to pass the parity check.
5. **Test both languages** — toggle via the sidebar user menu and verify layout holds
   (German strings are typically ~30% longer).

## Examples in Codebase

- **Navigation + language toggle**: `components/shell/main-nav.tsx`
- **Agent selection**: `components/agent-selection-dialog.tsx`
- **Server-side locale + provider mounting**: `app/(application)/layout.tsx`

## Troubleshooting

- **Translations not updating**: clear the `NEXT_LOCALE` cookie and reload.
- **Missing translations / `MISSING_MESSAGE` errors**: run `npm run check-messages` — it
  pinpoints which locale lacks which key.
- **Locale resets unexpectedly**: an invalid cookie value falls back to `defaultLocale`
  (`en`) in `proxy.ts`, `LanguageProvider`, and both layouts.
