# weasyprint-js

The Awesome Document Factory for Node.js — a TypeScript port of Python
[WeasyPrint v70.0](https://github.com/Kozea/WeasyPrint) (BSD-3-Clause) for
`npm` / `npx`. HTML+CSS → PDF with **zero system dependencies** (no
Pango/Cairo needed).

> Status: advanced MVP. Block/inline layout, pagination, `@page` sizes +
> margin boxes (headers/footers, `counter(page)`), tables, flex/grid/floats/
> absolute/columns, backgrounds (incl. `background-image`), borders, opacity,
> box-shadow, real PNG/JPEG embedding, link annotations, PDF outlines,
> attachments, PDF metadata, inline `style=""`, presentational hints, CSS
> variables, `calc()`/`min()`/`max()`/`clamp()`, extended selectors
> (`+`/`~`, `:nth-child`, `:not()`…), `::before`/`::after` with
> `counter()`/`attr()`/quotes, fragmentation (`break-*`, orphans/widows),
> and a pure-TS TrueType metric engine for `@font-face` (paints with
> Standard-14 unless `@pdf-lib/fontkit` is installed, then embeds+subsets).
> Text shaping (HarfBuzz-class), SVG rendering, and real PDF/A bytes remain
> out of scope for dependency-free JS.

## Install

```sh
npm i weasyprint-js
```

Requires Node.js ≥ 18. No native modules, no system libraries.

## Library use

```ts
import { HTML, CSS } from 'weasyprint-js';

// One shot: HTML string -> PDF file (also returns the bytes).
const pdf: Buffer = await (await HTML.create('<h1>Hello</h1><p>world</p>')).writePdf('out.pdf');

// From a file / URL / stream (mirrors Python's filename/url/file_obj/string/guess):
const html = await HTML.create({ filename: 'in.html' });
// const html = await HTML.create({ url: 'https://example.com' });
// const html = await HTML.create({ string: '<p>hi</p>' });

// With author stylesheets + options:
const doc = await html.render({
  stylesheets: [CSS.fromString(`
    :root { --brand: rebeccapurple; }
    p { color: var(--brand); margin-top: calc(1em + 4px); }
    li:nth-child(2n) { color: gray; }
    h2::before { content: counter(chapter) ". "; }
    @page { @bottom-center { content: "Page " counter(page) " of " counter(pages); } }
  `)],
  presentationalHints: true,   // honor bgcolor/align/width/... attributes
  zoom: 1,                     // PDF units per CSS unit
});
console.log(doc.pages.length, doc.bookmarks);
await doc.writePdf(); // Uint8Array

// Images just work (PNG/JPEG via data:, file or http URLs):
await (await HTML.create('<img src="logo.png" width="120">')).writePdf('img.pdf');

// Links + headings become clickable links and a PDF outline:
await (await HTML.create('<a href="https://example.com">out</a><a href="#s">in</a><h1 id="s">S</h1>')).writePdf('links.pdf');

// Attachments + finisher hook (pdf-lib document):
await html.writePdf('a.pdf', {
  attachments: [{ source: Buffer.from('hi'), name: 'note.txt' }],
  finisher: (doc) => console.log('pages:', (doc as { getPageCount(): number }).getPageCount()),
});

// Page subset (mirrors Document.copy):
const firstTwo = doc.copy([1, 2]);
```

### Options (mirrors Python `DEFAULT_OPTIONS`)

| Option | Default | Notes |
|---|---|---|
| `stylesheets` | `null` | `CSS` objects, CSS strings, filenames or URLs |
| `mediaType` | `'print'` | used for `@media` evaluation |
| `baseUrl` | `null` | base for relative URLs (defaults to CWD / input URL) |
| `urlFetcher` | default | custom `URLFetcher` (timeout, protocols, redirects) |
| `title`/`author`/`subject`/`keywords`/`creator` | — | PDF info dictionary |
| `pdfVariant` | `null` | `PDF/A-1b`, `PDF/A-2b`, `PDF/A-3b`, `PDF/UA-1` (validated) |
| `pdfVersion` | `null` | validated, informational |
| `pdfTags` | `false` | tagged-PDF flag (passthrough) |
| `presentationalHints` | `false` | HTML `bgcolor`, `align`, `width`, … (opt-in, like Python) |
| `uncompressedPdf` | `false` | `useObjectStreams: false` |
| `optimizeImages`/`jpegQuality`/`dpi` | — | accepted, informational |
| `fullFonts`/`hinting`/`cacheFolder`/`outputIntent` | — | accepted, informational |
| `zoom` | `1` | re-flows layout at the scaled size |
| `finisher` | `null` | `(pdfLibDoc) => void` before saving |
| `attachments` | `null` | files embedded via `doc.attach()` |

Unknown option names log an error (like Python ≥ v70) instead of failing
silently.

## CLI (`npx`)

```sh
npx weasyprint-js in.html out.pdf --stylesheet style.css --title "Report"
echo "<h1>hi</h1>" | npx weasyprint-js - out.pdf
npx weasyprint-js in.html out.pdf --presentational-hints --zoom 1.2 \
  --attachment data.csv --pdf-variant "PDF/A-3b"
```

Options mirror `weasyprint/__main__.py`: `--stylesheet`, `--media-type`,
`--base-url`, `--encoding`, `--timeout`, `--allowed-protocols`,
`--no-http-redirects`, `--fail-on-http-errors`, `--uncompressed-pdf`,
`--title`, `--author`, `--subject`, `--keywords`, `--creator`,
`--pdf-variant`, `--pdf-version`, `--pdf-tags`, `--pdf-identifier`,
`--attachment`, `--zoom`, `--presentational-hints`, `--output-intent`,
`--optimize-images`, `--jpeg-quality`, `--dpi`, `--full-fonts`,
`--hinting`, `--cache-folder`, `-v`/`-d`/`-q`.

## What works vs Python WeasyPrint

| Area | This package | Python |
|---|---|---|
| Block/inline layout, pagination, `@page` sizes/margins | ✅ | ✅ |
| Tables, floats, flex row, grid, absolute, multicol | ✅ (subset) | ✅ full |
| `var()` + `calc()`/`min()`/`max()`/`clamp()` | ✅ | ✅ |
| Selectors: `+`/`~`, `:nth-child`, `:not()`, `:first-child`… | ✅ | ✅ (full 3/4) |
| `::before`/`::after`, `counter()`/`counters()`/`attr()`/quotes | ✅ | ✅ |
| `@page` margin boxes, `counter(page)`/`counter(pages)` | ✅ | ✅ (+ `string-set`) |
| `break-before/after/inside`, orphans/widows | ✅ (subset) | ✅ full |
| `background-image` (raster), `opacity`, `box-shadow` | ✅ | ✅ (+ gradients/SVG) |
| `@font-face` TTF metrics (embed needs `@pdf-lib/fontkit`) | ✅ partial | ✅ full |
| Colors: 148 named, hex 3/4/6/8, `rgb()`, `hsl()`, `hwb()`, alpha | ✅ | ✅ (+ lab/lch/CMYK) |
| `style=""`, `[hidden]`, UA + form stylesheets | ✅ | ✅ |
| Presentational hints (`bgcolor`, `align`, …) | ✅ opt-in | ✅ opt-in |
| PNG/JPEG embedding (data/file/http) | ✅ | ✅ (+GIF/TIFF/WebP) |
| SVG/GIF | ⚠️ placeholder box | ✅ rendered |
| External + `#fragment` links, heading outlines | ✅ | ✅ (+ bookmarks API) |
| Attachments, metadata, zoom, finisher, `Document.copy` | ✅ | ✅ |
| `text-decoration`, `letter-spacing`, `text-indent`, list markers | ✅ | ✅ |
| Text shaping/hyphenation, `@font-face` embedding | ⚠️ standard-14 + metrics | ✅ Pango/HarfBuzz |
| PDF/A OutputIntent bytes, PDF versions, forms, XMP/RDF, Factur-X | ⚠️ validated/passthrough | ✅ full |

## Python → JS module map

| Python (`weasyprint/`) | TS (`src/`) | Notes |
|---|---|---|
| `__init__.py` (HTML/CSS/Attachment) | `src/index.ts` | `HTML.create()` is async (fetch); `writePdf()` returns `Buffer` |
| `__main__.py` | `src/bin/weasyprint.ts` | commander instead of argparse |
| `document.py` | `src/document.ts` | + `copy()`, `zoom`, `bookmarks` |
| `urls.py` | `src/urls.ts` + `src/source.ts` | undici instead of requests |
| `logger.py` | `src/logger.ts` | |
| `html.py` (UA sheets) | `src/html.ts` | + form + `[hidden]` sheets |
| `formatting_structure/` | `src/formatting-structure/boxes.ts` | parse5 instead of tinyhtml5; inline styles + void elements |
| `css/tokens.py` | `src/css/tokens.ts` | css-tree instead of tinycss2 |
| `css/__init__.py` cascade | `src/css/cascade.ts` + `specificity.ts` | + inline styles + hints |
| `css/media_queries.py` | `src/css/media-queries.ts` | |
| `css/properties.py` | `src/css/properties.ts` | |
| `css/units.py` | `src/css/units.ts` | |
| `css/validation/*` | `src/css/validation.ts` | named colors, lengths, borders, flex/grid, lists |
| `text/constants.py` | `src/text/constants.ts` | |
| `text/line_break.py` | `src/text/line-break.ts` | greedy wrap |
| `text/fonts.py` + `ffi.py` (Pango) | `src/text/fonts.ts` | Standard-14 mapping |
| `layout/page.py` | `src/layout/page.ts` + `page-sizes.ts` | all ISO/US/JIS sizes |
| `layout/block.py` + `inline.py` | `src/layout/block.ts` + `metrics.ts` | flow + per-glyph metrics |
| `draw/color.py` | `src/draw/color.ts` | full Color 3 + `hsl`/`hwb` |
| `pdf/__init__.py` + `stream.py` | `src/pdf/build.ts` | pdf-lib replaces pydyf; images, links, outlines |
| `pdf/metadata.py` | `src/pdf/metadata.ts` | info dict |
| `pdf/variants.py` | `src/pdf/variants.ts` | validated |
| `pdf/anchors.py` + `links.py` | `src/pdf/anchors.ts` + `build.ts` | fragment map + annotations |
| `images/`, `svg/` | `src/images/`, `src/svg/` | sniff + sizing; SVG intrinsic size |

## Dev

```sh
npm install
npm test        # vitest
npm run build   # tsc -> dist/
npm run cli -- in.html out.pdf
```

## License

BSD-3-Clause. See [LICENSE](./LICENSE). The original Python WeasyPrint is
© Simon Sapin / Court Bouillon, also BSD-3-Clause.
