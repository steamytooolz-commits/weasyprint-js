// Absolute positioning — resolve `left/right/top/bottom/width/height`.

export interface ContainingBlock {
  w: number;
  h: number;
}

export interface IntrinsicSize {
  w: number;
  h: number;
}

export interface AbsoluteBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function parseAbsLength(raw: string | undefined, reference: number): number | null {
  if (raw == null) return null;
  const t = raw.trim().toLowerCase();
  if (t === '' || t === 'auto') return null;
  let m = /^(-?[0-9]*\.?[0-9]+)%$/.exec(t);
  if (m) {
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return null;
    return (n / 100) * reference;
  }
  m = /^(-?[0-9]*\.?[0-9]+)(px|pt|pc|in|cm|mm|q|em|rem)?$/.exec(t);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] ?? 'px').toLowerCase();
  switch (unit) {
    case 'px': return n;
    case 'pt': return (n * 96) / 72;
    case 'pc': return n * 16;
    case 'in': return n * 96;
    case 'cm': return (n * 96) / 2.54;
    case 'mm': return (n * 96) / 25.4;
    case 'q': return (n * 96) / 25.4 / 4;
    case 'em':
    case 'rem': return n * 16;
    default: return null;
  }
}

/**
 * Resolve an absolutely positioned box inside `containing`.
 * - `auto` width with both offsets set stretches to fill.
 * - Over-constrained `left+right+width` (LTR) keeps `left`+`width`.
 */
export function resolveAbsolute(
  style: Record<string, string>,
  containing: ContainingBlock,
  intrinsic: IntrinsicSize,
): AbsoluteBox {
  const cw = Number.isFinite(containing.w) ? containing.w : 0;
  const ch = Number.isFinite(containing.h) ? containing.h : 0;
  const iw = Number.isFinite(intrinsic.w) && intrinsic.w > 0 ? intrinsic.w : 0;
  const ih = Number.isFinite(intrinsic.h) && intrinsic.h > 0 ? intrinsic.h : 0;

  const left = parseAbsLength(style['left'], cw);
  const right = parseAbsLength(style['right'], cw);
  const top = parseAbsLength(style['top'], ch);
  const bottom = parseAbsLength(style['bottom'], ch);
  let w = parseAbsLength(style['width'], cw);
  let h = parseAbsLength(style['height'], ch);

  if (w == null) {
    if (left != null && right != null) w = Math.max(0, cw - left - right);
    else w = iw;
  }
  if (h == null) {
    if (top != null && bottom != null) h = Math.max(0, ch - top - bottom);
    else h = ih;
  }
  w = Math.max(0, w);
  h = Math.max(0, h);

  let x: number;
  if (left != null) x = left;
  else if (right != null) x = cw - right - w;
  else x = 0;

  let y: number;
  if (top != null) y = top;
  else if (bottom != null) y = ch - bottom - h;
  else y = 0;

  return { x, y, w, h };
}
