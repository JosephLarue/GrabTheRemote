# Fonts for the share cards

Used by `next/og` (`src/lib/fonts.ts`) to draw the og:image cards with the site's typography. The pages
themselves load the same families through `next/font/google`.

| File | Family | Source | Licence |
| --- | --- | --- | --- |
| `BagelFatOne-Regular.ttf` | Bagel Fat One | https://fonts.google.com/specimen/Bagel+Fat+One | SIL Open Font License 1.1 |
| `Nunito-Black.ttf` | Nunito (900) | https://fonts.google.com/specimen/Nunito | SIL Open Font License 1.1 |

Both are subset to Latin (`pyftsubset --unicodes="U+0020-007E,U+00A0-00FF,U+0152,U+0153,U+2018-201A,U+201C-201E,U+2026,U+2013,U+2014"`),
so an accented room name or tagline renders but Korean or Cyrillic text would fall back to boxes.
