// Media queries — mirrors weasyprint/css/media_queries.py (subset).
// Supports `print | screen | all` + `(width/height ...)` conditions used
// for @media and @import filtering.

export type MediaType = 'print' | 'screen' | 'all';

export function parseMediaQuery(media: string | null | undefined): {
  types: string[]; conditions: string;
} {
  if (!media) return { types: ['all'], conditions: '' };
  const parts = media.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return { types: parts.length ? parts : ['all'], conditions: media };
}

export function evaluateMedia(
  query: string | null | undefined,
  mediaType: string,
  viewport: { widthPx: number; heightPx: number } = { widthPx: 800, heightPx: 600 },
): boolean {
  if (!query) return true;
  const ors = query.split(',').map((s) => s.trim().toLowerCase());
  return ors.some((one) => evaluateSingle(one, mediaType, viewport));
}

function evaluateSingle(one: string, mediaType: string, vp: { widthPx: number; heightPx: number }): boolean {
  let rest = one;
  let negate = false;
  if (rest.startsWith('not ')) { negate = true; rest = rest.slice(4).trim(); }
  rest = rest.replace(/^only\s+/, '');
  const m = /^(all|print|screen|[a-z-]+)?\s*(.*)$/.exec(rest);
  const type = (m?.[1] ?? 'all').trim() || 'all';
  const conds = (m?.[2] ?? '').trim();
  let ok = type === 'all' || type === mediaType;
  if (ok && conds) {
    const feats = conds.split(/\s+and\s+/);
    for (const f of feats) {
      const fm = /^\(\s*([a-z-]+)\s*(?::\s*([^)]+))?\)$/.exec(f.trim());
      if (!fm) continue;
      const name = fm[1];
      const val = (fm[2] ?? '').trim();
      if (!evalFeature(name, val, vp)) { ok = false; break; }
    }
  }
  return negate ? !ok : ok;
}

function lengthToPx(v: string): number {
  const m = /^(-?[0-9.]+)(px|pt|in|cm|mm|pc|q|em|rem)?$/.exec(v.trim());
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  const u = (m[2] ?? 'px').toLowerCase();
  const k: Record<string, number> = {
    px: 1, pt: 96 / 72, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, em: 16, rem: 16,
  };
  return n * (k[u] ?? 1);
}

function evalFeature(name: string, val: string, vp: { widthPx: number; heightPx: number }): boolean {
  switch (name) {
    case 'width': return vp.widthPx === lengthToPx(val);
    case 'min-width': return vp.widthPx >= lengthToPx(val);
    case 'max-width': return vp.widthPx <= lengthToPx(val);
    case 'height': return vp.heightPx === lengthToPx(val);
    case 'min-height': return vp.heightPx >= lengthToPx(val);
    case 'max-height': return vp.heightPx <= lengthToPx(val);
    case 'orientation': return val === 'portrait' ? vp.heightPx >= vp.widthPx : vp.widthPx > vp.heightPx;
    default: return true; // unknown features pass (like WeasyPrint lenient mode)
  }
}
