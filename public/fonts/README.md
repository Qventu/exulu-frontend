# Local Fonts

This directory contains local font files to avoid dependency on Google Fonts during Docker builds.

## Fonts Included

- **Inter** - Main sans-serif font family
  - `Inter-Light.woff2` - Light weight (300)
  - `Inter-Regular.woff2` - Regular weight (400)
  - `Inter-Bold.woff2` - Bold weight (700)

- **JetBrains Mono** - Monospace font family
  - `JetBrainsMono-Regular.woff2` - Regular weight

- **Merriweather** - Serif font family
  - `Merriweather-Regular.woff2` - Regular weight

## Usage

These fonts are configured in `frontend/lib/fonts.ts` and used throughout the application via CSS variables:

- `--font-sans` - Inter (main font)
- `--font-mono` - JetBrains Mono
- `--font-serif` - Merriweather
- `--font-serif-alt` - Source Serif 4

## Benefits

- No external dependencies during build
- Faster page loads
- Better privacy (no Google Fonts tracking)
- Consistent font loading across environments 