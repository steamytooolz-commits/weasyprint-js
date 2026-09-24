// CSS computed values — specified -> computed (font-size, line-height,
// font-weight, color/currentcolor, length canonicalization to px).
import { toPx, parseLength } from './units.js';
import { evaluateLengthToPx } from './math.js';

const ABSOLUTE_FONT_PX: Record<string, number> = {
  'xx-small': 9, 'x-small': 10, small: 13, medium: 16,
  large: 18, 'x-large': 24, 'xx-large': 32, 'xxx-large': 48,
};

const LENGTH_PROPS: ReadonlySet<string> = new Set([
  'font-size', 'width', 'height', 'min-width', 'min-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'top', 'right', 'bottom', 'left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'letter-spacing', 'word-spacing', 'text-indent',
  'border-spacing', 'column-gap', 'row-gap', 'gap',
  'flex-basis', 'outline-width',
]);

function parentFontPx(parentStyle: Record<string, string>): number {
  const raw = (parentStyle['font-size'] ?? '16px').trim().toLowerCase();
  const parsed = parseLength(raw);
  if (!parsed) {
    if (ABSOLUTE_FONT_PX[raw] != null) return ABSOLUTE_FONT_PX[raw];
    return 16;
  }
  const px = toPx(parsed.value, parsed.unit, { fontSize: 16, rootFontSize: 16 });
  if (px != null && Number.isFinite(px) && px > 0) return px;
  if (parsed.unit === '%') return (16 * parsed.value) / 100;
  return 16;
}

function canonicalPx(num: number, unit: string | null, fontPx: number): string | null {
  const px = toPx(num, unit, { fontSize: fontPx, rootFontSize: 16 });
  if (px == null || !Number.isFinite(px)) return null;
  const rounded = Math.round(px * 10000) / 10000;
  return `${rounded}px`;
}

function canonicalLength(value: string, fontPx: number): string | null {
  const parsed = parseLength(value.trim());
  if (!parsed) return null;
  if (parsed.unit === '%') return null; // percentages preserved by caller
  if (parsed.unit === null) {
    if (parsed.value === 0) return '0px';
    return null;
  }
  return canonicalPx(parsed.value, parsed.unit, fontPx);
}

function computeFontSize(value: string, parentStyle: Record<string, string>): string {
  const v = value.trim().toLowerCase();
  const parent = parentFontPx(parentStyle);
  if (ABSOLUTE_FONT_PX[v] != null) return `${ABSOLUTE_FONT_PX[v]}px`;
  if (v === 'smaller') return `${Math.round(parent * 0.8 * 10000) / 10000}px`;
  if (v === 'larger') return `${Math.round(parent * 1.2 * 10000) / 10000}px`;
  const parsed = parseLength(value.trim());
  if (!parsed) return value.trim();
  if (parsed.unit === '%') {
    return `${Math.round(((parent * parsed.value) / 100) * 10000) / 10000}px`;
  }
  if (parsed.unit === 'em' || parsed.unit === 'rem') {
    const base = parsed.unit === 'rem' ? 16 : parent;
    return `${Math.round(parsed.value * base * 10000) / 10000}px`;
  }
  const px = canonicalPx(parsed.value, parsed.unit, parent);
  return px ?? value.trim();
}

function computeLineHeight(value: string, fontPx: number): string {
  const v = value.trim().toLowerCase();
  if (v === 'normal') return 'normal';
  if (/^[+-]?(\d*\.?\d+)$/.test(v)) return v.replace(/^\+/, '');
  if (v.endsWith('%')) return v; // percentages preserved
  return canonicalLength(value, fontPx) ?? value.trim();
}

function computeFontWeight(value: string, parentStyle: Record<string, string>): string {
  const v = value.trim().toLowerCase();
  if (v === 'normal') return '400';
  if (v === 'bold') return '700';
  if (/^[1-9]00$/.test(v)) return v;
  if (v === 'bolder' || v === 'lighter') {
    const p = (parentStyle['font-weight'] ?? '400').trim().toLowerCase();
    const pn = p === 'normal' ? 400 : p === 'bold' ? 700 : parseInt(p, 10);
    if (!Number.isFinite(pn)) return v === 'bolder' ? '700' : '400';
    if (v === 'bolder') {
      if (pn < 400) return '400';
      if (pn < 600) return '700';
      return '900';
    }
    if (pn <= 500) return '100';
    if (pn <= 700) return '400';
    return '700';
  }
  return value.trim();
}

/** Compute one specified value to its computed form. Never throws. */
export function computeValue(
  prop: string,
  value: string,
  parentStyle: Record<string, string>,
): string {
  const p = prop.trim().toLowerCase();
  const v = value.trim();
  const vl = v.toLowerCase();
  if (!v) return '';
  // Custom properties stay unresolved here (substituted by the cascade with
  // full inheritance context); never canonicalize them.
  if (p.startsWith('--')) return v;
  // Percentages preserved (except font-size which resolves against parent).
  if (p === 'font-size') return computeFontSize(v, parentStyle);
  if (p === 'line-height') {
    const fpx = parentFontPx({ ...parentStyle, 'font-size': parentStyle['font-size'] ?? '16px' });
    void fpx;
    const selfPx = (() => {
      const fs = computeFontSize(parentStyle['font-size'] ?? '16px', {});
      const n = parseFloat(fs);
      return Number.isFinite(n) ? n : 16;
    })();
    return computeLineHeight(v, selfPx);
  }
  if (p === 'font-weight') return computeFontWeight(v, parentStyle);
  if (vl === 'currentcolor') {
    if (p === 'color') return (parentStyle['color'] ?? 'black').trim() || 'black';
    return (parentStyle['color'] ?? 'black').trim() || 'black';
  }
  if (vl.endsWith('%') && /^-?(\d*\.?\d+)%$/.test(vl)) return vl;
  if (LENGTH_PROPS.has(p)) {
    if (/^(auto|normal|none|min-content|max-content|fit-content|content)$/.test(vl)) return vl;
    const parent = parentFontPx(parentStyle);
    // calc()/min()/max()/clamp() without percentages resolve now; the rest
    // (anything with %) stays for layout, which knows the reference length.
    if (/calc\(|min\(|max\(|clamp\(/i.test(v) && !v.includes('%')) {
      const px = evaluateLengthToPx(v, { fontPx: parent, rootPx: 16 });
      if (px != null && Number.isFinite(px)) return `${Math.round(px * 10000) / 10000}px`;
    }
    const canon = canonicalLength(v, parent);
    if (canon !== null) return canon;
    return v;
  }
  if (p === 'color' || p.endsWith('-color')) return vl;
  return v;
}
