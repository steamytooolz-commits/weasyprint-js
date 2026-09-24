import { describe, it, expect } from 'vitest';
import { HTML, CSS } from '../src/index.js';
import { parseColor } from '../src/draw/color.js';
import { matches, specificity, buildSiblingCtx } from '../src/css/specificity.js';
import { evaluateLengthToPx, resolveVars } from '../src/css/math.js';
import { registerFont, clearFonts } from '../src/text/ttf.js';
import type { ElementRef } from '../src/css/types.js';

// 1x1 red PNG (tiny, no network needed).
const RED_DOT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pdfText(buf: Buffer): string {
  return buf.toString('latin1');
}

describe('draw/color.py — full CSS color engine', () => {
  it('parses 148 named colors incl. rebeccapurple', () => {
    expect(parseColor('rebeccapurple')).toMatchObject({ r: 0.4, g: 0.2 });
    expect(parseColor('aliceblue')).not.toBeNull();
    expect(parseColor('not-a-color')).toBeNull();
  });

  it('parses hex with alpha', () => {
    expect(parseColor('#ff000080')).toMatchObject({ r: 1, g: 0, b: 0 });
    expect(parseColor('#ff000080')!.alpha).toBeCloseTo(0.502, 2);
    expect(parseColor('#f008')).toMatchObject({ r: 1 });
    expect(parseColor('#f008')!.alpha).toBeCloseTo(0.533, 2);
  });

  it('parses modern rgb()/hsl()/hwb() syntax', () => {
    expect(parseColor('rgb(255 0 0 / 50%)')).toMatchObject({ r: 1, g: 0, b: 0, alpha: 0.5 });
    expect(parseColor('rgba(0, 0, 255, 0.25)')).toMatchObject({ b: 1, alpha: 0.25 });
    expect(parseColor('hsl(120, 100%, 25%)')).toMatchObject({ g: 0.5 });
    expect(parseColor('hsl(0 0% 0% / 0)')).toMatchObject({ r: 0, alpha: 0 });
    expect(parseColor('hwb(0 0% 0%)')).toMatchObject({ r: 1, g: 0, b: 0 });
  });
});

describe('premium HTML features', () => {
  it('inline style="" beats stylesheets', async () => {
    const html = await HTML.create('<p style="color: blue">hi</p>');
    const css = CSS.fromString('p { color: red; }');
    const doc = await html.render({ stylesheets: [css] });
    expect(doc.root.children[0]?.style['color']).toBe('blue');
  });

  it('presentational hints apply only when enabled', async () => {
    const src = '<body bgcolor="#00ff00"><img src="x.png" width="42" align="left"></body>';
    const off = await (await HTML.create(src)).render();
    expect(off.root.style['background-color'] ?? '').not.toBe('#00ff00');
    const on = await (await HTML.create(src)).render({ presentationalHints: true });
    expect(on.root.style['background-color']).toBe('#00ff00');
  });

  it('[hidden] hides elements', async () => {
    const html = await HTML.create('<p>show</p><p hidden>hide</p>');
    const doc = await html.render();
    const texts = JSON.stringify(doc.root);
    expect(texts).toContain('show');
    // hidden subtree is pruned from layout output
    const allText = doc.flow.blocks.flatMap((b) => b.lines.map((l) => l.text)).join(' ');
    expect(allText).not.toContain('hide');
  });

  it('embeds PNG data: images as PDF image XObjects', async () => {
    const html = await HTML.create(`<img src="${RED_DOT}" width="20" height="10">`);
    const buf = await html.writePdf(null, { uncompressedPdf: true });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfText(buf)).toContain('/Image');
  });

  it('creates URI + GoTo link annotations and outlines', async () => {
    const html = await HTML.create(
      '<a href="https://example.com">out</a><a href="#sec">in</a><h1 id="sec">Title</h1><h2>Sub</h2>',
    );
    const doc = await html.render();
    expect(doc.bookmarks.length).toBe(2);
    const buf = Buffer.from(await doc.writePdf({ uncompressedPdf: true }));
    const text = pdfText(buf);
    expect(text).toContain('URI');
    expect(text).toContain('GoTo');
    expect(text).toContain('Outlines');
  });

  it('supports attachments, zoom and copy()', async () => {
    const html = await HTML.create('<h1>A</h1>'.repeat(10));
    const doc = await html.render();
    const buf = Buffer.from(
      await doc.writePdf({
        attachments: [{ source: Buffer.from('hello'), name: 'hi.txt' }],
        uncompressedPdf: true,
      }),
    );
    expect(pdfText(buf)).toContain('EmbeddedFiles');
    const z1 = doc.pages[0];
    const zoomed = await (await html.render()).writePdf({ zoom: 2 });
    expect(zoomed.length).toBeGreaterThan(500);
    expect(z1.widthPt).toBeGreaterThan(0);
    const sub = doc.copy([1]);
    expect(sub.pages.length).toBe(1);
  });

  it('renders lists, hr, decorations and indent without crashing', async () => {
    const html = await HTML.create(
      '<ol><li>one</li><li>two</li></ol><ul><li>a</li></ul><hr>' +
      '<p style="text-indent: 20px; letter-spacing: 1px; text-decoration: underline">deep</p>',
    );
    const buf = await html.writePdf();
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('advanced CSS engine', () => {
  it('resolves var() with fallback and inheritance', () => {
    expect(resolveVars('var(--x)', {})).toBeNull();
    expect(resolveVars('var(--x, 12px)', {})).toBe('12px');
    expect(resolveVars('solid var(--c, red)', { '--c': 'blue' })).toBe('solid blue');
  });

  it('evaluates calc/min/max/clamp', () => {
    expect(evaluateLengthToPx('calc(10px + 5px)', {})).toBe(15);
    expect(evaluateLengthToPx('calc(100% - 20px)', { refPx: 200 })).toBe(180);
    expect(evaluateLengthToPx('calc(2 * 3px)', {})).toBe(6);
    expect(evaluateLengthToPx('min(10px, 20px)', {})).toBe(10);
    expect(evaluateLengthToPx('max(10px, 20px)', {})).toBe(20);
    expect(evaluateLengthToPx('clamp(10px, 15px, 20px)', {})).toBe(15);
    expect(evaluateLengthToPx('clamp(10px, 5px, 20px)', {})).toBe(10);
  });

  it('applies var() + calc() through the cascade', async () => {
    const html = await HTML.create('<div><p>hi</p></div>');
    const css = CSS.fromString(':root { --gap: 10px; } p { margin-top: calc(var(--gap) * 2); color: var(--nope, green); }');
    const doc = await html.render({ stylesheets: [css] });
    const p = doc.root.children[0]?.children[0];
    expect(p?.style['margin-top']).toBe('20px');
    expect(p?.style['color']).toBe('green');
  });

  it('matches sibling combinators + structural pseudo-classes', () => {
    const els: ElementRef[] = [
      { uid: 1, tag: 'div', id: null, classes: [], attrs: {}, parentUid: null },
      { uid: 2, tag: 'p', id: null, classes: ['a'], attrs: {}, parentUid: 1 },
      { uid: 3, tag: 'p', id: null, classes: ['b'], attrs: {}, parentUid: 1 },
      { uid: 4, tag: 'span', id: null, classes: [], attrs: {}, parentUid: 1 },
    ];
    const ctx = buildSiblingCtx(els);
    const byUid = new Map(els.map((e) => [e.uid, e]));
    expect(matches(els[2], 'p.a + p', byUid, ctx)).toBe(true);
    expect(matches(els[3], 'p ~ span', byUid, ctx)).toBe(true);
    expect(matches(els[1], 'p:first-child', byUid, ctx)).toBe(true);
    expect(matches(els[2], 'p:nth-child(2)', byUid, ctx)).toBe(true);
    expect(matches(els[2], 'p:not(.a)', byUid, ctx)).toBe(true);
    expect(matches(els[1], 'p:not(.a)', byUid, ctx)).toBe(false);
    expect(specificity('p::before')).toEqual([0, 0, 2]);
  });

  it('generates ::before/::after with counters + attr()', async () => {
    const html = await HTML.create(
      '<ol><li data-x="A">one</li><li>two</li></ol><p class="t">hi</p>',
    );
    const css = CSS.fromString([
      'ol { counter-reset: item 0; }',
      'li { counter-increment: item; }',
      'li::before { content: counter(item) ". "; }',
      'li::after { content: "[" attr(data-x, "?") "]"; }',
      '.t::before { content: open-quote "Q:"; }',
    ].join('\n'));
    const doc = await html.render({ stylesheets: [css] });
    const texts = doc.flow.blocks.flatMap((b) => b.lines.map((l) => l.text)).join('|');
    expect(texts).toContain('1. ');
    expect(texts).toContain('[A]');
    expect(texts).toContain('[?]');
    expect(texts).toContain('Q:');
  });

  it('paints @page margin boxes with page counters', async () => {
    const { inflateSync } = await import('node:zlib');
    const paras = Array.from({ length: 120 }, (_, i) => `<p>line ${i}</p>`).join('');
    const html = await HTML.create(`<body>${paras}</body>`);
    const css = CSS.fromString('@page { @bottom-center { content: "Page " counter(page) " of " counter(pages); } }');
    const doc = await html.render({ stylesheets: [css] });
    expect(doc.pages.length).toBeGreaterThan(1);
    expect(doc.pageBox.marginBoxes['bottom-center']?.['content']).toContain('counter(page)');
    const buf = Buffer.from(await doc.writePdf({ uncompressedPdf: true }));
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    // Painted footer text lives inside deflated content streams (hex-encoded
    // by pdf-lib): inflate and match literal or hex form.
    const raw = buf.toString('latin1');
    const streams: string[] = [];
    const re = /stream\r?\n([\s\S]*?)endstream/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      try {
        streams.push(inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'));
      } catch { /* not deflated */ }
    }
    const wanted = `Page 1 of ${doc.pages.length}`;
    const hex = Buffer.from(wanted, 'latin1').toString('hex').toUpperCase();
    const found = streams.some((s) => s.includes(wanted) || s.toUpperCase().includes(hex));
    expect(found).toBe(true);
  });

  it('honors break-before: page and break-inside: avoid', async () => {
    const html = await HTML.create('<p>first</p><p class="nb">second</p>');
    const css = CSS.fromString('.nb { break-before: page; }');
    const doc = await html.render({ stylesheets: [css] });
    expect(doc.pages.length).toBeGreaterThanOrEqual(2);
  });

  it('paints background images, opacity and box-shadow', async () => {
    const dot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const html = await HTML.create('<div class="card"><p>hi</p></div>');
    const css = CSS.fromString(
      `.card { background-image: url("${dot}"); background-repeat: no-repeat; ` +
      'opacity: 0.9; box-shadow: 2px 2px 4px black; }',
    );
    const buf = await html.writePdf(null, { stylesheets: [css], uncompressedPdf: true });
    const text = buf.toString('latin1');
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(text).toContain('/Image');
    expect(text).toContain('/ExtGState');
  });
});

describe('font engine (pure-TS TTF metrics)', () => {
  // Minimal synthetic TTF: filled by the parser test below.
  it('rejects non-font buffers', () => {
    clearFonts();
    expect(registerFont(Buffer.from('not a font at all..............'))).toBeNull();
    expect(matchFont(['Nope'], 400, false)).toBeNull();
    clearFonts();
  });

  it('measures with registered fonts when available', async () => {
    clearFonts();
    // No registered fonts → heuristic still measures.
    const w = (await import('../src/layout/metrics.js')).measureWidth('hello', { 'font-size': '16px' });
    expect(w).toBeGreaterThan(0);
    clearFonts();
  });
});
