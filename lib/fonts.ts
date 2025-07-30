import localFont from 'next/font/local'

// Inter font family - main sans-serif font
export const inter = localFont({
  src: [
    {
      path: '../public/fonts/Inter-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/Inter-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Inter-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
})

// JetBrains Mono font family - monospace font
export const jetbrainsMono = localFont({
  src: '../public/fonts/JetBrainsMono-Regular.woff2',
  variable: '--font-mono',
  display: 'swap',
})

// Merriweather font family - serif font
export const merriweather = localFont({
  src: '../public/fonts/Merriweather-Regular.woff2',
  variable: '--font-serif',
  display: 'swap',
})

// Combined font variables for use in layouts
export const fontVariables = [
  inter.variable,
  jetbrainsMono.variable,
  merriweather.variable,
].join(' ') 