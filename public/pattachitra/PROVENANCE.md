# Pattachitra theme — asset provenance and source notes

OpenOdia's visual direction is a **contemporary digital interpretation** inspired by
Odisha's Pattachitra painting tradition. It is not an artwork made by a traditional
Pattachitra artist, and nothing here is presented as a traditional painting or as the
work of any named artist or community.

## Inspiration

The Odisha section of [Wikipedia: Pattachitra](https://en.wikipedia.org/wiki/Pattachitra)
and its images informed the floral borders, red grounds, bold outlined motifs, peacocks,
and Jagannath-inspired ornament. The direction stays with the Odisha examples rather than
blending in the separate Bengal tradition.

Images studied as style references (**not** reproduced on the site):

- [Odisha Pattachitra depicting Radha and Krishna](https://commons.wikimedia.org/wiki/File:Odisha_Pattachitara_Depicting_Unconditional_Love_between_Radha_Krushna.jpg)
- [Pattachitra of Lord Jagannath](https://commons.wikimedia.org/wiki/File:Easy_Pattachitra_of_Lord_Jagarnath.jpg)
- [Palm-leaf manuscript detail, Odisha, late 18th century — Cleveland Museum of Art](https://en.wikipedia.org/wiki/File:Left_detail,_India,_Orissa,_late_18th_century_-_The_Monkeys_and_Bears_Fight_Ravana_and_His_Demons_(verso)_-_1979.21.b_-_Cleveland_Museum_of_Art_(cropped).jpg)
  — the source of the page's palm-leaf ochre, `#CFAA6E`.

## Assets served from this directory

| File | What it is | Origin |
| --- | --- | --- |
| `ceremonial-frame.webp` | The painted hero panel: floral border, peacocks, lower ornament | Original AI-generated illustration, guided by the references above. Contains **no letter** — the glyph is drawn as vector on top, which keeps it deterministic and correct. Encoded from the 1122×1402 source PNG at quality 80 (3.1 MB → 377 KB). |
| `border.svg` | The repeating painted divider | Original vector, drawn for this theme |
| `odia-o.svg` | The exact `ଓ` (U+0B13) contour, untouched | Noto Sans Oriya, weight 600 — see below |
| `odia-o-provenance.json` | How that contour was extracted | Machine-readable record of the extraction |
| `OFL-NotoSansOriya.txt` | SIL Open Font License 1.1 | Ships with Noto Sans Oriya |

## The letter

The hero letter is the **exact** `ଓ`, **U+0B13**, weight 600 contour from
[Noto Sans Oriya](https://github.com/google/fonts/tree/main/ofl/notosansoriya),
extracted with fontTools `SVGPathPen` using a uniform scale and a Y-axis coordinate
conversion. **No contour edits, no redrawing, no generated substitute.** The untouched
contour is `odia-o.svg`; the same path string is embedded in
`src/components/OdiaGlyph.tsx`, where the gold gradient, floral engraving pattern, and
offset depth layer are added as presentation only.

Noto Sans Oriya is licensed under the SIL Open Font License 1.1 (`OFL-NotoSansOriya.txt`).
The web font itself is loaded from Google Fonts; only the single derived outline above is
vendored.

## Motion

The painted panel never moves. Three slow, independent, compositor-only animations run on
top of it:

- the letter turns between −5° and +5° on the Y axis with ±0.5° in-plane roll, over 22s;
- a highlight crosses the letter over 18s;
- a warm light moves across the panel over 26s.

No pointer-following and nothing randomised. The letter occupies the panel's 20–73%
vertical band, so the peacock heads and the lower ornament stay clear through the whole
loop. A hidden tab pauses the animation rather than removing it, so returning to the tab
doesn't snap the letter back to the start of its turn; `prefers-reduced-motion: reduce`
removes all three outright. There is no on-page motion control — the OS preference is the
control.

## Attribution

The independent communities linked from this site — Odisha AI, OdiaGenAI, GDG Cloud
Bhubaneswar, TFUG Bhubaneswar — are run by their own organisers. OpenOdia points at them
and does not operate, represent, or speak for any of them.

## Design record

The approved mockup and its review history live in the maintainer's local
`.lavish/homepage-revamp/` directory, which is gitignored — this file is the checked-in
record, and is meant to stand on its own. The production implementation is
`src/styles/pattachitra.css`, `src/components/OdiaGlyph.tsx`, `src/routes/index.tsx`, and
`src/routes/tutorials.tsx`.
