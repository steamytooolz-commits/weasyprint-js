// Minimal TrueType/OpenType metric parser — mirrors the metric side of
// weasyprint/text/fonts.py without Pango/fontconfig. Reads head, hhea,
// maxp, hmtx and cmap (formats 4 and 12) to map characters to advances.
// No shaping, no kerning, no woff — measurement-grade only, pure TS.

export interface ParsedFont {
  family: string;
  subfamily: string;
  weight: number;
  italic: boolean;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  advances: Map<number, number>; // glyphId -> advance (font units)
  cmap: Map<number, number>; // charCode -> glyphId
  numGlyphs: number;
}

interface FontEntry {
  parsed: ParsedFont;
  buffer: Buffer;
  familyNorm: string;
}

const registry: FontEntry[] = [];

export function registerFont(buffer: Buffer): ParsedFont | null {
  try {
    const parsed = parseTtf(buffer);
    if (!parsed) return null;
    registry.push({ parsed, buffer, familyNorm: parsed.family.toLowerCase() });
    return parsed;
  } catch {
    return null;
  }
}

export function clearFonts(): void {
  registry.length = 0;
}

export function registeredFamilies(): string[] {
  return [...new Set(registry.map((r) => r.parsed.family))];
}

/** Best match for a family list + weight/style (nearest-weight fallback). */
export function matchFont(
  families: string[], weight: number, italic: boolean,
): ParsedFont | null {
  const norm = families.map((f) => f.trim().replace(/^["']|["']$/g, '').toLowerCase());
  for (const fam of norm) {
    const cands = registry.filter((r) => r.familyNorm === fam);
    if (cands.length === 0) continue;
    let best: FontEntry | null = null;
    let bestScore = Infinity;
    for (const c of cands) {
      let score = Math.abs(c.parsed.weight - weight);
      if (c.parsed.italic !== italic) score += 500;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    if (best) return best.parsed;
  }
  return null;
}

export function fontBufferOf(parsed: ParsedFont): Buffer | null {
  return registry.find((r) => r.parsed === parsed)?.buffer ?? null;
}

/** Advance width of one char in font units (0 when missing). */
export function glyphAdvance(parsed: ParsedFont, ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  const gid = parsed.cmap.get(code) ?? 0;
  return parsed.advances.get(gid) ?? parsed.advances.get(0) ?? 0;
}

/** Sum advances for text → CSS px at fontSizePx. */
export function measureParsed(parsed: ParsedFont, text: string, fontSizePx: number): number {
  let units = 0;
  for (const ch of text) units += glyphAdvance(parsed, ch);
  return (units / parsed.unitsPerEm) * fontSizePx;
}

// ---- parser ----

function parseTtf(buf: Buffer): ParsedFont | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = (o: number): number => view.getUint32(o, false);
  const u16 = (o: number): number => view.getUint16(o, false);
  const i16 = (o: number): number => view.getInt16(o, false);
  if (buf.length < 12) return null;
  const sfnt = u32(0);
  // 0x00010000 (TTF), 'OTTO' (CFF outlines — metrics tables still present),
  // 'true', 'typ1'. wOFF/wOFF2 are different containers (unsupported).
  if (sfnt !== 0x00010000 && sfnt !== 0x4f54544f && sfnt !== 0x74727565 && sfnt !== 0x74797031) {
    return null;
  }
  const numTables = u16(4);
  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    if (o + 16 > buf.length) return null;
    const tag = buf.toString('ascii', buf.byteOffset + o, buf.byteOffset + o + 4);
    tables.set(tag, { offset: u32(o + 8), length: u32(o + 12) });
  }
  const head = tables.get('head');
  const hhea = tables.get('hhea');
  const maxp = tables.get('maxp');
  const hmtx = tables.get('hmtx');
  const cmap = tables.get('cmap');
  if (!head || !hhea || !maxp || !hmtx || !cmap) return null;

  const unitsPerEm = u16(head.offset + 18) || 2048;
  const numGlyphs = u16(maxp.offset + 4);
  if (numGlyphs === 0 || numGlyphs > 65535) return null;
  const ascent = i16(hhea.offset + 4);
  const descent = i16(hhea.offset + 6);
  const numHMetrics = u16(hhea.offset + 34);

  const advances = new Map<number, number>();
  let o = hmtx.offset;
  let lastAdvance = 0;
  const n = Math.min(numHMetrics, numGlyphs);
  for (let gid = 0; gid < n; gid++) {
    if (o + 4 > buf.length) break;
    lastAdvance = u16(o);
    advances.set(gid, lastAdvance);
    o += 4;
  }
  for (let gid = n; gid < numGlyphs; gid++) advances.set(gid, lastAdvance);

  const cmapMap = parseCmap(view, buf, cmap.offset);
  const { family, subfamily } = parseName(view, buf, tables.get('name'));
  const macStyle = head.offset + 44 <= buf.length ? view.getUint8(head.offset + 44) : 0;
  const bold = (macStyle & 1) !== 0;
  const italicFlag = (macStyle & 2) !== 0;
  const weight = /bold/i.test(subfamily) ? 700 : /light/i.test(subfamily) ? 300 : bold ? 700 : 400;
  return {
    family: family || 'Unknown',
    subfamily: subfamily || 'Regular',
    weight,
    italic: italicFlag || /italic|oblique/i.test(subfamily),
    unitsPerEm, ascent, descent, advances, cmap: cmapMap, numGlyphs,
  };
}

function parseCmap(view: DataView, buf: Buffer, offset: number): Map<number, number> {
  const out = new Map<number, number>();
  const u16 = (o: number): number => view.getUint16(o, false);
  const u32 = (o: number): number => view.getUint32(o, false);
  if (offset + 4 > buf.length) return out;
  const numSubs = u16(offset + 2);
  let best4 = -1;
  let best12 = -1;
  for (let i = 0; i < numSubs; i++) {
    const o = offset + 4 + i * 8;
    if (o + 8 > buf.length) break;
    const platform = u16(o);
    const encoding = u16(o + 2);
    const subOffset = offset + u32(o + 4);
    if (subOffset + 2 > buf.length) continue;
    const format = u16(subOffset);
    // Prefer Windows Unicode BMP (3,1) then (3,10), then Mac Roman fallback.
    if (format === 4 && best4 < 0) best4 = subOffset;
    if (format === 12 && best12 < 0) best12 = subOffset;
    void platform; void encoding;
  }
  if (best12 >= 0) parseCmap12(view, buf, best12, out);
  else if (best4 >= 0) parseCmap4(view, buf, best4, out);
  return out;
}

function parseCmap12(view: DataView, buf: Buffer, offset: number, out: Map<number, number>): void {
  const u32 = (o: number): number => view.getUint32(o, false);
  if (offset + 16 > buf.length) return;
  const numGroups = u32(offset + 12);
  for (let i = 0; i < numGroups; i++) {
    const o = offset + 16 + i * 12;
    if (o + 12 > buf.length) break;
    const start = u32(o);
    const end = u32(o + 4);
    const glyph = u32(o + 8);
    for (let c = start; c <= end && c - start < 4096; c++) {
      if (!out.has(c)) out.set(c, glyph + (c - start));
    }
  }
}

function parseName(
  view: DataView, buf: Buffer, table: { offset: number; length: number } | undefined,
): { family: string; subfamily: string } {
  const fallback = { family: '', subfamily: '' };
  if (!table) return fallback;
  const u16 = (o: number): number => view.getUint16(o, false);
  const base = table.offset;
  if (base + 6 > buf.length) return fallback;
  const count = u16(base + 2);
  const storage = base + u16(base + 4);
  let family = '';
  let subfamily = '';
  for (let i = 0; i < count; i++) {
    const o = base + 6 + i * 12;
    if (o + 12 > buf.length) break;
    const platform = u16(o);
    const encoding = u16(o + 2);
    const nameId = u16(o + 6);
    const len = u16(o + 8);
    const strOff = storage + u16(o + 10);
    if (strOff + len > buf.length) continue;
    if (nameId !== 1 && nameId !== 2 && nameId !== 16 && nameId !== 17) continue;
    let text = '';
    try {
      if (platform === 3 || platform === 0) {
        // UTF-16BE.
        const bytes = buf.subarray(strOff, strOff + len);
        const chars: string[] = [];
        for (let j = 0; j + 1 < len; j += 2) {
          chars.push(String.fromCharCode((bytes[j] << 8) | bytes[j + 1]));
        }
        text = chars.join('');
      } else {
        text = buf.toString('latin1', strOff, strOff + len);
      }
    } catch {
      continue;
    }
    void encoding;
    if ((nameId === 1 || nameId === 16) && !family) family = text;
    if ((nameId === 2 || nameId === 17) && !subfamily) subfamily = text;
  }
  return { family: family.replace(/\0/g, ''), subfamily: subfamily.replace(/\0/g, '') };
}

function parseCmap4(view: DataView, buf: Buffer, offset: number, out: Map<number, number>): void {
  __parseCmap4ForTest(view, buf, offset, out);
}

// Re-export a real format-4 parser (kept separate for clarity/testing).
export function __parseCmap4ForTest(view: DataView, buf: Buffer, offset: number, out: Map<number, number>): void {
  const u16 = (o: number): number => view.getUint16(o, false);
  if (offset + 14 > buf.length) return;
  const segCount = u16(offset + 6) / 2;
  if (!Number.isFinite(segCount) || segCount <= 0 || segCount > 256) return;
  const endBase = offset + 14;
  const startBase = endBase + segCount * 2 + 2;
  const deltaBase = startBase + segCount * 2;
  const rangeBase = deltaBase + segCount * 2;
  for (let s = 0; s < segCount; s++) {
    if (rangeBase + s * 2 + 2 > buf.length) break;
    const end = u16(endBase + s * 2);
    const start = u16(startBase + s * 2);
    const delta = u16(deltaBase + s * 2);
    const rangeOffset = u16(rangeBase + s * 2);
    if (start === 0xffff && end === 0xffff) break;
    for (let c = start; c <= end; c++) {
      if (out.has(c)) continue;
      if (rangeOffset === 0) {
        out.set(c, (c + delta) & 0xffff);
      } else {
        const glyphAddr = rangeBase + s * 2 + rangeOffset + (c - start) * 2;
        if (glyphAddr + 2 > buf.length) break;
        const gid = u16(glyphAddr);
        out.set(c, gid === 0 ? 0 : (gid + delta) & 0xffff);
      }
    }
  }
}
