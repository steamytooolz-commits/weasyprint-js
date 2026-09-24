import { describe, it, expect } from 'vitest';
import { HTML, CSS, VERSION, DEFAULT_OPTIONS } from '../src/index.js';
import { specificity, matches } from '../src/css/specificity.js';
import { parseStylesheet } from '../src/css/tokens.js';
import { evaluateMedia } from '../src/css/media-queries.js';
import { pageBoxFromRules } from '../src/layout/page.js';
import { parseColor } from '../src/draw/color.js';

describe('package surface (mirrors weasyprint/__init__.py)', () => {
  it('exposes VERSION + DEFAULT_OPTIONS', () => {
    expect(VERSION).toBe('0.1.0');
    expect(DEFAULT_OPTIONS.mediaType).toBe('print');
  });

  it('renders hello-world HTML to a valid PDF buffer', async () => {
    const html = await HTML.create('<h1>Hello</h1><p>world</p>');
    const buf = await html.writePdf();
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('applies author CSS color + page size', async () => {
    const html = await HTML.create('<p>red</p>');
    const css = CSS.fromString('p { color: red; } @page { size: A5; }');
    const doc = await html.render({ stylesheets: [css] });
    expect(doc.pages.length).toBeGreaterThanOrEqual(1);
    const buf = Buffer.from(await doc.writePdf());
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('paginates long content into multiple pages', async () => {
    const paras = Array.from({ length: 200 }, (_, i) => `<p>line ${i}</p>`).join('');
    const html = await HTML.create(`<body>${paras}</body>`);
    const doc = await html.render();
    expect(doc.pages.length).toBeGreaterThan(1);
  }, 30000);
});

describe('css tokens + specificity (mirrors css/tokens.py)', () => {
  it('parses style rules and !important', () => {
    const sheet = parseStylesheet('p { color: red !important; margin: 1px 2px; }');
    expect(sheet.rules.length).toBe(1);
    const rule = sheet.rules[0];
    expect(rule.type).toBe('style');
    if (rule.type === 'style') {
      expect(rule.selectors).toEqual(['p']);
      expect(rule.declarations[0]).toMatchObject({ prop: 'color', important: true });
    }
  });

  it('computes specificity', () => {
    expect(specificity('#a .b p')).toEqual([1, 1, 1]);
    expect(specificity('p')).toEqual([0, 0, 1]);
  });

  it('matches simple + descendant selectors', () => {
    const el = { uid: 2, tag: 'p', id: null, classes: ['x'], attrs: { class: 'x' }, parentUid: 1 };
    const parent = { uid: 1, tag: 'div', id: null, classes: [], attrs: {}, parentUid: null };
    const byUid = new Map([[1, parent], [2, el]]);
    expect(matches(el, 'p')).toBe(true);
    expect(matches(el, '.x')).toBe(true);
    expect(matches(el, 'div p', byUid)).toBe(true);
    expect(matches(el, 'span p', byUid)).toBe(false);
  });
});

describe('media queries + @page (mirrors css + layout/page.py)', () => {
  it('evaluates print vs screen', () => {
    expect(evaluateMedia('print', 'print')).toBe(true);
    expect(evaluateMedia('screen', 'print')).toBe(false);
    expect(evaluateMedia('print and (min-width: 100px)', 'print', { widthPx: 800, heightPx: 600 })).toBe(true);
  });

  it('sizes A4 landscape from @page', () => {
    const box = pageBoxFromRules([{ name: 'default', pseudo: null, declarations: { size: 'A4 landscape' } }]);
    expect(box.widthPx).toBeGreaterThan(box.heightPx);
  });
});

describe('draw/color.py', () => {
  it('parses hex + rgb()', () => {
    expect(parseColor('#ff0000')).toMatchObject({ r: 1, g: 0, b: 0 });
    expect(parseColor('rgb(0, 0, 255)')).toMatchObject({ b: 1 });
    expect(parseColor('transparent')).toBeNull();
  });
});
