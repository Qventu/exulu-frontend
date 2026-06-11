"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { LOCALE_COOKIE, Locale, defaultLocale, locales } from '@/i18n/config';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLocale = defaultLocale,
  initialMessages
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
  initialMessages: any;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState(initialMessages);

  useEffect(() => {
    // Read locale from cookie on mount
    const cookieLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${LOCALE_COOKIE}=`))
      ?.split('=')[1];

    if (cookieLocale && locales.includes(cookieLocale as Locale)) {
      setLocaleState(cookieLocale as Locale);
      loadMessages(cookieLocale as Locale);
    }
  }, []);

  const loadMessages = async (newLocale: Locale) => {
    const newMessages = await import(`../messages/${newLocale}.json`);
    setMessages(newMessages.default);
  };

  const setLocale = async (newLocale: Locale) => {
    // Set cookie with 1 year expiry
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    document.cookie = `${LOCALE_COOKIE}=${newLocale}; expires=${expiryDate.toUTCString()}; path=/`;

    // Load new messages
    await loadMessages(newLocale);

    // Update state
    setLocaleState(newLocale);

    // Reload the page to apply server-side changes
    window.location.reload();
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
