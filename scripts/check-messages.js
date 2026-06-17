#!/usr/bin/env node
/**
 * check-messages.js — en/de translation key-parity check (zero dependencies).
 *
 * Loads every locale file in /messages (driven by the locale list below, which
 * mirrors i18n/config.ts), deep-compares the key sets and prints any keys that
 * exist in one locale but not the others. Exits 1 on any mismatch so it can
 * run in CI and as a pre-merge gate.
 *
 * Usage: node scripts/check-messages.js  (or: npm run check-messages)
 */

const fs = require('fs');
const path = require('path');

// Keep in sync with i18n/config.ts (that file is TypeScript and this script
// must stay zero-dep, so the list is duplicated here on purpose).
const locales = ['en', 'de'];

const messagesDir = path.join(__dirname, '..', 'messages');

/** Recursively collect dot-separated leaf key paths from a messages object. */
function collectKeys(obj, prefix = '', out = []) {
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const keyPath = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            collectKeys(value, keyPath, out);
        } else {
            out.push(keyPath);
        }
    }
    return out;
}

function loadLocale(locale) {
    const file = path.join(messagesDir, `${locale}.json`);
    let raw;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (err) {
        console.error(`✖ Could not read ${file}: ${err.message}`);
        process.exit(1);
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error(`✖ Invalid JSON in ${file}: ${err.message}`);
        process.exit(1);
    }
}

const keySets = new Map(); // locale -> Set of key paths
for (const locale of locales) {
    keySets.set(locale, new Set(collectKeys(loadLocale(locale))));
}

// Union of all keys across locales.
const allKeys = new Set();
for (const keys of keySets.values()) {
    for (const key of keys) allKeys.add(key);
}

let mismatch = false;
for (const locale of locales) {
    const keys = keySets.get(locale);
    const missing = [...allKeys].filter((key) => !keys.has(key)).sort();
    if (missing.length > 0) {
        mismatch = true;
        console.error(`\n✖ messages/${locale}.json is missing ${missing.length} key(s):`);
        for (const key of missing) console.error(`    ${key}`);
    }
}

if (mismatch) {
    console.error(
        '\nFix: add the missing keys (with real translations, not placeholders) so every locale has the same key set.',
    );
    process.exit(1);
}

console.log(`✔ Message key parity OK: ${allKeys.size} keys across ${locales.join(', ')}.`);
