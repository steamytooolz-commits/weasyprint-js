// Layout flow — mirrors layout/{block,inline,page}.py (MVP).
import type { Box } from '../formatting-structure/boxes.js';
import { toPx } from '../css/units.js';
import { fontSizePx, lineHeightPx, measureWidth } from './metrics.js';
import { wrapText } from '../text/line-break.js';
import { layoutFlexRow } from './flex.js';
import { layoutGridTracks } from './grid.js';
import { FloatManager } from './floats.js';
import type { FloatSide } from './floats.js';
import { resolveAbsolute } from './absolute.js';
import { distributeTableWidths } from './table-full.js';
import type { TableCell } from './table-full.js';
import { columnCount, columnWidth } from './columns.js';
import { textTransform, justifyLine } from '../draw/text.js';
import { parseBorderSide } from '../draw/border.js';
import { imageDisplaySize } from '../images/index.js';
import { evaluateLengthToPx } from '../css/math.js';

export interface PlacedLine {
  text: string; x: number; y: number;
  width: number; height: number;
  style: Record<string, string>;
}

export interface PlacedBlock {
  box: Box; y: number; height: number;
  lines: PlacedLine[]; background: string | null;
}

export interface FlowResult { blocks: PlacedBlock[]; height: number }

/** Module-level float state, reset per document flow. */
let activeFloats: FloatManager | null = null;
let activeFloatWidth = 0;

function floatsFor(cw: number): FloatManager {
  if (!activeFloats) {
    activeFloats = new FloatManager(cw);
    activeFloatWidth = cw;
  }
  return activeFloats;
}

function lengthPx(style: Record<string, string>, prop: string, ref: number, fontPx: number): number | null {
  const raw = style[prop];
  if (raw == null) return null;
  const t = raw.trim().toLowerCase();
  if (t === '' || t === 'auto' || t === 'none') return null;
  if (t.endsWith('%') && !/[+\-*/]/.test(t.slice(0, -1))) {
    const n = parseFloat(t);
    return Number.isFinite(n) ? (n / 100) * ref : null;
  }
  if (/calc\(|var\(|min\(|max\(|clamp\(/i.test(raw) || /[+\-*/]/.test(t)) {
    const px = evaluateLengthToPx(raw, { fontPx, refPx: ref });
    if (px != null && Number.isFinite(px)) return px;
    return null;
  }
  const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q|em|rem)?$/.exec(t);
  if (!m) return null;
  return toPx(parseFloat(m[1]), m[2] ?? 'px', { fontSize: fontPx }) ?? null;
}

function gapPx(style: Record<string, string>, cw: number, fontPx: number): number {
  const raw = style['column-gap'] ?? style['gap'] ?? '0';
  const t = raw.trim().toLowerCase();
  if (t === '' || t === 'normal' || t === 'none') return 0;
  // `gap` may be "row-gap column-gap"; use the last (column) value.
  const parts = t.split(/\s+/).filter(Boolean);
  const last = parts.length > 0 ? parts[parts.length - 1] : '0';
  if (last.endsWith('%')) {
    const n = parseFloat(last);
    return Number.isFinite(n) && n > 0 ? (n / 100) * cw : 0;
  }
  const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q|em|rem)?$/.exec(last);
  if (!m) return 0;
  const px = toPx(parseFloat(m[1]), m[2] ?? 'px', { fontSize: fontPx }) ?? 0;
  return Math.max(0, px);
}

function childBasisPx(child: Box, cw: number, equalShare: number, fontPx: number): number {
  const w = lengthPx(child.style, 'width', cw, fontPx);
  if (w != null && w >= 0) return w;
  const basis = lengthPx(child.style, 'flex-basis', cw, fontPx);
  if (basis != null && basis >= 0) return basis;
  return Math.max(0, equalShare);
}

function growOf(style: Record<string, string>): number {
  const raw = style['flex-grow'];
  if (raw == null) return 0;
  const n = parseFloat(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function shrinkOf(style: Record<string, string>): number {
  const raw = style['flex-shrink'];
  if (raw == null) return 1;
  const n = parseFloat(raw.trim());
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

function estimateFloatWidth(box: Box, cw: number, fontPx: number): number {
  const w = lengthPx(box.style, 'width', cw, fontPx);
  if (w != null && w > 0) return Math.min(cw, w);
  const full = collectText(box);
  if (full != null && full.trim() !== '') {
    return Math.min(cw, Math.max(24, measureWidth(full.slice(0, 48), box.style)));
  }
  return Math.min(cw, Math.max(48, cw / 3));
}

function marginPx(style: Record<string, string>, side: string, ref: number): number {
  const raw = style[`margin-${side}`] ?? '0';
  if (raw.trim().endsWith('%')) return (parseFloat(raw) / 100) * ref;
  const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q|em|rem)?$/.exec(raw.trim());
  if (!m) return 0;
  return toPx(parseFloat(m[1]), m[2] ?? 'px', { fontSize: fontSizePx(style) }) ?? 0;
}

export function flowDocument(root: Box, contentWidth: number, contentHeight = Number.POSITIVE_INFINITY): FlowResult {
  activeFloats = new FloatManager(contentWidth);
  activeFloatWidth = contentWidth;
  const blocks: PlacedBlock[] = [];
  let y = 0;
  const tops = root.tag === 'body' ? root.children : [root];
  for (const box of tops) y += flowBox(box, contentWidth, 0, y, blocks, fontSizePx(box.style));
  if (Number.isFinite(contentHeight) && contentHeight > 0) {
    applyFragmentation(blocks, contentHeight);
  }
  const height = blocks.reduce((m, b) => Math.max(m, b.y + b.height), y);
  return { blocks, height };
}

const PAGE_BREAK_VALUES = new Set(['page', 'always', 'recto', 'verso', 'left', 'right', 'column']);

/**
 * Fragmentation pass — mirrors layout/page.py break handling (subset):
 * break-before/after, break-inside: avoid, orphans/widows. Shifts blocks
 * (and their lines) down in flow space; never upwards.
 */
function applyFragmentation(blocks: PlacedBlock[], contentH: number): void {
  let shift = 0;
  let pendingAfter = false;
  for (const b of blocks) {
    const style = b.box.style;
    const before = (style['break-before'] ?? style['page-break-before'] ?? 'auto').trim().toLowerCase();
    const after = (style['break-after'] ?? style['page-break-after'] ?? 'auto').trim().toLowerCase();
    let y = b.y + shift;
    if ((pendingAfter || PAGE_BREAK_VALUES.has(before)) && b.height > 0) {
      const atTop = y % contentH === 0;
      if (!atTop) {
        const target = Math.ceil(y / contentH) * contentH;
        shift += target - y;
        y = target;
      }
    }
    pendingAfter = PAGE_BREAK_VALUES.has(after);
    const inside = (style['break-inside'] ?? style['page-break-inside'] ?? 'auto').trim().toLowerCase();
    if ((inside === 'avoid' || inside === 'avoid-page') && b.height > 0 && b.height < contentH) {
      const startPage = Math.floor(y / contentH);
      const endPage = Math.floor((y + b.height - 0.01) / contentH);
      if (endPage !== startPage) {
        const target = (startPage + 1) * contentH;
        shift += target - y;
        y = target;
      }
    }
    // Orphans/widows for line boxes spanning exactly two pages.
    if (b.lines.length >= 4 && b.height > 0 && b.height < contentH) {
      const boundary = (Math.floor(y / contentH) + 1) * contentH;
      const spansTwo = Math.floor(y / contentH) !== Math.floor((y + b.height - 0.01) / contentH);
      if (spansTwo) {
        const orphans = parseBreakCount(style['orphans'], 2);
        const widows = parseBreakCount(style['widows'], 2);
        const rel = b.lines.map((l) => l.y - b.y + y);
        const first = rel.filter((ly) => ly < boundary).length;
        const last = rel.length - first;
        if (first > 0 && first < orphans) {
          shift += boundary - y;
          y = boundary;
        } else if (last > 0 && last < widows) {
          const lh = b.lines[0]?.height ?? 1;
          const need = widows - last;
          if (first - need >= orphans && need * lh < contentH) {
            shift += need * lh;
            y += need * lh;
          }
        }
      }
    }
    const dy = y - b.y;
    if (dy !== 0) {
      b.y = y;
      for (const ln of b.lines) ln.y += dy;
    }
  }
}

function parseBreakCount(raw: string | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function backgroundOf(box: Box): string | null {
  const bgRaw = box.style['background-color'] ?? 'transparent';
  return bgRaw && bgRaw !== 'transparent' ? bgRaw : null;
}

function longestWord(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  let best = '';
  for (const w of words) if (w.length > best.length) best = w;
  return best || text;
}

function flowBox(box: Box, cw: number, x: number, y: number, out: PlacedBlock[], pf: number): number {
  if (box.type === 'text') return flowLines(box, box.text ?? '', cw, x, y, out);
  const fs = fontSizePx(box.style, pf);
  const mt = marginPx(box.style, 'top', cw);
  const mb = marginPx(box.style, 'bottom', cw);
  const startY = y;
  const own: PlacedLine[] = [];
  if (box.tag === 'img') return flowImage(box, cw, x, startY, mt, mb, out);
  const position = (box.style['position'] ?? 'static').trim().toLowerCase();
  if (position === 'absolute' || position === 'fixed') {
    return flowAbsolute(box, cw, x, startY, mb, fs, own, out);
  }
  const floats = floatsFor(activeFloatWidth > 0 ? activeFloatWidth : cw);
  let cur = floats.clearY(box.style['clear'] ?? 'none', y + mt);
  const floatSide = (box.style['float'] ?? 'none').trim().toLowerCase();
  if (floatSide === 'left' || floatSide === 'right') {
    return flowFloat(box, floatSide as FloatSide, cw, cur, mb, fs, floats, own, out);
  }
  const slot = floats.availableWidthAt(cur, 0);
  const effX = x + slot.x;
  const effW = Math.max(1, slot.width > 0 ? Math.min(Math.max(1, cw - x), slot.width - x) : cw - x);
  if (box.tag === 'table') {
    cur += flowTable(box, effW, effX, cur, out, fs);
  } else {
    const display = (box.style['display'] ?? '').trim().toLowerCase();
    const colN = columnCount(effW, box.style);
    if (display === 'flex') {
      cur += flowFlex(box, effW, effX, cur, out, fs);
    } else if (display === 'grid' || display === 'inline-grid') {
      cur += flowGrid(box, effW, effX, cur, out, fs);
    } else if (colN > 1) {
      cur += flowColumns(box, colN, effW, effX, cur, out, fs);
    } else {
      const full = collectText(box);
      if (full != null) {
        cur += flowTextLines(box, full, effW, effX, cur, own, fs);
      } else {
        for (const c of box.children) cur += flowBox(c, effW, effX, cur, out, fs);
        if (box.tag === 'hr') cur += 8;
      }
    }
  }
  const height = cur - startY + mb;
  out.push({ box, y: startY, height, lines: own, background: backgroundOf(box) });
  return height;
}

function flowTextLines(
  box: Box, raw: string, cw: number, x: number, y: number,
  own: PlacedLine[], fs: number,
): number {
  const lh = lineHeightPx(box.style, fs);
  const transformed = textTransform(raw, box.style['text-transform'] ?? 'none');
  const maxW = Math.max(1, cw);
  const lines = wrapText(transformed, {
    maxWidth: maxW, maxWidthFn: (t) => measureWidth(t, box.style),
    whiteSpace: box.style['white-space'] ?? 'normal',
  });
  const align = (box.style['text-align'] ?? 'left').trim().toLowerCase();
  const indent = textIndentPx(box.style, maxW, fs);
  lines.forEach((text, i) => {
    let lx = x + (i === 0 ? indent : 0);
    const w = measureWidth(text, box.style);
    const avail = Math.max(1, maxW - (i === 0 ? indent : 0));
    if (align === 'center') lx = x + (i === 0 ? indent : 0) + Math.max(0, (avail - w) / 2);
    else if (align === 'right' || ((box.style['direction'] ?? 'ltr') === 'rtl' && align === 'start')) {
      lx = x + (i === 0 ? indent : 0) + Math.max(0, avail - w);
    } else if (align === 'justify' && i < lines.length - 1) {
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        const j = justifyLine(words, maxW, (t) => measureWidth(t, box.style));
        void j.extraPerGap;
      }
    }
    own.push({ text, x: lx, y: y + i * lh, width: w, height: lh, style: box.style });
  });
  return lines.length * lh;
}

/** Replaced-element layout: reserve display height for <img>. */
function flowImage(
  box: Box, cw: number, x: number, startY: number,
  mt: number, mb: number, out: PlacedBlock[],
): number {
  void x;
  const natW = box.image?.wPx ?? attrSize(box.attrs['width'], 300);
  const natH = box.image?.hPx ?? attrSize(box.attrs['height'], 150);
  const size = imageDisplaySize(box.style, box.attrs, natW, natH, Math.max(1, cw));
  const height = mt + size.h + mb;
  out.push({ box, y: startY, height, lines: [], background: backgroundOf(box) });
  return height;
}

function attrSize(raw: string | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const n = parseFloat(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function textIndentPx(style: Record<string, string>, ref: number, fontPx: number): number {
  const raw = style['text-indent'];
  if (raw == null) return 0;
  return lengthPx(style, 'text-indent', ref, fontPx) ?? 0;
}

function flowAbsolute(
  box: Box, cw: number, x: number, startY: number, mb: number,
  fs: number, own: PlacedLine[], out: PlacedBlock[],
): number {
  const intrinsicW = lengthPx(box.style, 'width', cw, fs) ?? cw;
  const scratch: PlacedBlock[] = [];
  let intrinsicH = 0;
  for (const c of box.children) intrinsicH += flowBox(c, intrinsicW, 0, 0, scratch, fs);
  void scratch;
  const full = collectText(box);
  if (full != null) {
    const lh = lineHeightPx(box.style, fs);
    const t = textTransform(full, box.style['text-transform'] ?? 'none');
    intrinsicH += wrapText(t, {
      maxWidth: intrinsicW, maxWidthFn: (s) => measureWidth(s, box.style),
      whiteSpace: box.style['white-space'] ?? 'normal',
    }).length * lh;
  }
  const abs = resolveAbsolute(box.style, { w: cw, h: 0 }, { w: intrinsicW, h: intrinsicH });
  let cur = startY + abs.y;
  const aw = abs.w > 0 ? abs.w : cw;
  for (const c of box.children) cur += flowBox(c, aw, x + abs.x, cur, out, fs);
  if (full != null) cur += flowTextLines(box, full, aw, x + abs.x, cur, own, fs);
  if (box.tag === 'hr') cur += 8;
  out.push({ box, y: startY, height: Math.max(0, cur - startY) + mb, lines: own, background: backgroundOf(box) });
  return 0;
}

function flowFloat(
  box: Box, side: FloatSide, cw: number, cur: number, mb: number,
  fs: number, floats: FloatManager, own: PlacedLine[], out: PlacedBlock[],
): number {
  const fw = Math.max(1, estimateFloatWidth(box, cw, fs));
  const avail = floats.availableWidthAt(cur, 0);
  const fx = side === 'left' ? avail.x : Math.max(avail.x, cw - fw);
  let inner = cur;
  for (const c of box.children) inner += flowBox(c, fw, fx, inner, out, fs);
  const full = collectText(box);
  if (full != null) inner += flowTextLines(box, full, fw, fx, inner, own, fs);
  if (box.tag === 'hr') inner += 8;
  const fh = Math.max(1, inner - cur);
  floats.addFloat(side, cur, fw, fh);
  out.push({ box, y: cur, height: fh + mb, lines: own, background: backgroundOf(box) });
  return 0;
}

function flowLines(box: Box, text: string, cw: number, x: number, y: number, out: PlacedBlock[]): number {
  const fs = fontSizePx(box.style);
  const lh = lineHeightPx(box.style, fs);
  const lines = wrapText(text, {
    maxWidth: cw - x, maxWidthFn: (t) => measureWidth(t, box.style),
    whiteSpace: box.style['white-space'] ?? 'normal',
  });
  const placed: PlacedLine[] = lines.map((t, i) => ({
    text: t, x, y: y + i * lh, width: measureWidth(t, box.style), height: lh, style: box.style,
  }));
  out.push({ box, y, height: lines.length * lh, lines: placed, background: null });
  return lines.length * lh;
}

function flowFlex(box: Box, cw: number, x: number, y: number, out: PlacedBlock[], fs: number): number {
  const kids = box.children.filter((c) => (c.style['position'] ?? 'static').trim().toLowerCase() !== 'absolute');
  if (kids.length === 0) return 0;
  const gap = gapPx(box.style, cw, fs);
  const equalShare = Math.max(0, (cw - gap * (kids.length - 1)) / kids.length);
  const sizes = layoutFlexRow(
    kids.map((c) => ({
      box: c,
      basisPx: childBasisPx(c, cw, equalShare, fontSizePx(c.style, fs)),
      grow: growOf(c.style),
      shrink: shrinkOf(c.style),
      minPx: lengthPx(c.style, 'min-width', cw, fontSizePx(c.style, fs)) ?? 0,
      maxPx: lengthPx(c.style, 'max-width', cw, fontSizePx(c.style, fs)) ?? Infinity,
    })),
    cw,
    gap,
  );
  let rowH = 0;
  let cx = x;
  kids.forEach((c, i) => {
    const w = Math.max(1, sizes[i] ?? equalShare);
    const before = out.length;
    const h = flowBox(c, w, cx, y, out, fs);
    const dx = cx - x;
    if (dx !== 0) {
      for (let k = before; k < out.length; k++) {
        for (const ln of out[k].lines) ln.x += dx;
      }
    }
    rowH = Math.max(rowH, h);
    cx += w + gap;
  });
  return rowH;
}

function flowGrid(box: Box, cw: number, x: number, y: number, out: PlacedBlock[], fs: number): number {
  const kids = box.children.filter((c) => (c.style['position'] ?? 'static').trim().toLowerCase() !== 'absolute');
  if (kids.length === 0) return 0;
  const gap = gapPx(box.style, cw, fs);
  const spec = box.style['grid-template-columns'] ?? 'none';
  const tracks = layoutGridTracks(spec, cw, gap, kids.length);
  const nCols = Math.max(1, tracks.length);
  let totalH = 0;
  let rowH = 0;
  let cx = x;
  let col = 0;
  let rowY = y;
  for (const c of kids) {
    const w = Math.max(1, tracks[col] ?? cw / nCols);
    const h = flowBox(c, w, cx, rowY, out, fs);
    rowH = Math.max(rowH, h);
    col++;
    cx += w + gap;
    if (col >= nCols) {
      totalH += rowH;
      rowY += rowH;
      col = 0;
      cx = x;
      rowH = 0;
    }
  }
  totalH += rowH;
  return totalH;
}

function flowColumns(
  box: Box, count: number, cw: number, x: number, y: number, out: PlacedBlock[], fs: number,
): number {
  const n = Math.max(1, Math.floor(count));
  const gap = gapPx(box.style, cw, fs);
  const colW = Math.max(1, columnWidth(n, cw, gap));
  if (n === 1) {
    const full1 = collectText(box);
    if (full1 != null) {
      const own: PlacedLine[] = [];
      const h = flowTextLines(box, full1, colW, x, y, own, fs);
      // Merge lines into per-line anonymous blocks (caller adds container).
      for (const ln of own) {
        out.push({ box, y: ln.y, height: ln.height, lines: [ln], background: null });
      }
      return h;
    }
    let h = 0;
    for (const c of box.children) h += flowBox(c, colW, x, y + h, out, fs);
    return h;
  }
  // Pseudo text-only multicol: split wrapped lines round-robin across columns.
  const full = collectText(box);
  if (full != null) {
    const lh = lineHeightPx(box.style, fs);
    const t = textTransform(full, box.style['text-transform'] ?? 'none');
    const lines = wrapText(t, {
      maxWidth: colW, maxWidthFn: (s) => measureWidth(s, box.style),
      whiteSpace: box.style['white-space'] ?? 'normal',
    });
    const perCol = Math.ceil(lines.length / n);
    let maxH = 0;
    for (let k = 0; k < n; k++) {
      const slice = lines.slice(k * perCol, (k + 1) * perCol);
      const cx = x + k * (colW + gap);
      slice.forEach((text, i) => {
        out.push({
          box, y: y + i * lh, height: lh,
          lines: [{ text, x: cx, y: y + i * lh, width: measureWidth(text, box.style), height: lh, style: box.style }],
          background: null,
        });
      });
      maxH = Math.max(maxH, slice.length * lh);
    }
    return maxH;
  }
  const colY: number[] = Array.from({ length: n }, () => y);
  box.children.forEach((c, i) => {
    const k = i % n;
    const cx = x + k * (colW + gap);
    colY[k] += flowBox(c, colW, cx, colY[k], out, fs);
  });
  let maxH2 = 0;
  for (const cy of colY) maxH2 = Math.max(maxH2, cy - y);
  return maxH2;
}

function flowTable(box: Box, cw: number, x: number, y: number, out: PlacedBlock[], fs: number): number {
  let cur = y;
  for (const section of box.children) {
    const rows = section.tag === 'tr' ? [section] : section.children;
    const matrix: TableCell[][] = rows.map((row) => {
      const cells = row.children.filter((c) => c.type === 'table-cell');
      return cells.map((cell) => {
        const full = collectText(cell);
        const maxW = full != null && full.trim() !== '' ? measureWidth(full, cell.style) : 48;
        const minW = full != null && full.trim() !== ''
          ? Math.max(12, measureWidth(longestWord(full), cell.style))
          : 24;
        return { minPx: minW, maxPx: Math.max(minW, maxW) };
      });
    });
    const spacing = lengthPx(box.style, 'border-spacing', cw, fs) ?? 0;
    void parseBorderSide(box.style, 'top');
    const widths = distributeTableWidths(matrix, cw, spacing);
    rows.forEach((row, ri) => {
      const cells = row.children.filter((c) => c.type === 'table-cell');
      let rowH = 0;
      let cx = x;
      cells.forEach((cell, ci) => {
        const w = Math.max(1, widths[ri]?.[ci] ?? cw / Math.max(1, cells.length));
        rowH = Math.max(rowH, flowBox(cell, w, cx, cur, out, fs));
        cx += w + spacing;
      });
      cur += rowH;
    });
  }
  return cur - y;
}

function collectText(box: Box): string | null {
  if (!box.children.length) return null;
  if (!box.children.every((c) => c.type === 'text')) return null;
  return box.children.map((c) => c.text ?? '').join('');
}
