// Images — mirrors weasyprint/images.py + optimize_images / dpi handling
// (format sniffing subset): PNG via IHDR, JPEG via SOF markers, GIF via
// header, SVG via markup detection.

export interface ImageInfo {
  mime: string;
  widthPx: number;
  heightPx: number;
  dpi: number | null;
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function sniffPng(buf: Buffer): ImageInfo | null {
  if (buf.length < 24) {
    return null;
  }
  for (let i = 0; i < PNG_MAGIC.length; i += 1) {
    if (buf[i] !== PNG_MAGIC[i]) {
      return null;
    }
  }
  const widthPx = buf.readUInt32BE(16);
  const heightPx = buf.readUInt32BE(20);
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx === 0 || heightPx === 0) {
    return null;
  }
  return { mime: 'image/png', widthPx, heightPx, dpi: null };
}

function sniffJpeg(buf: Buffer): ImageInfo | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 4 <= buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buf.length) {
      return null;
    }
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) {
      return null;
    }
    const isSof =
      (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc);
    if (isSof) {
      if (offset + 9 > buf.length) {
        return null;
      }
      const heightPx = buf.readUInt16BE(offset + 5);
      const widthPx = buf.readUInt16BE(offset + 7);
      if (widthPx === 0 || heightPx === 0) {
        return null;
      }
      return { mime: 'image/jpeg', widthPx, heightPx, dpi: null };
    }
    offset += 2 + segLen;
  }
  return null;
}

function sniffGif(buf: Buffer): ImageInfo | null {
  if (buf.length < 10) {
    return null;
  }
  const header = buf.toString('ascii', 0, 6);
  if (header !== 'GIF87a' && header !== 'GIF89a') {
    return null;
  }
  const widthPx = buf.readUInt16LE(6);
  const heightPx = buf.readUInt16LE(8);
  if (widthPx === 0 || heightPx === 0) {
    return null;
  }
  return { mime: 'image/gif', widthPx, heightPx, dpi: null };
}

function sniffSvg(buf: Buffer): ImageInfo | null {
  const head = buf.toString('utf8', 0, Math.min(buf.length, 4096)).replace(/^﻿/, '').trimStart();
  if (!/^<\?xml/i.test(head) && !/^<svg[\s>/]/i.test(head)) {
    if (!/<svg[\s>/]/i.test(head.slice(0, 1024))) {
      return null;
    }
  } else if (!/<svg[\s>/]/i.test(head)) {
    return null;
  }
  const tag = /<svg\b[^>]*>/i.exec(head)?.[0] ?? head;
  const wMatch = /\bwidth\s*=\s*["']?\s*([\d.]+)/i.exec(tag);
  const hMatch = /\bheight\s*=\s*["']?\s*([\d.]+)/i.exec(tag);
  const vbMatch = /\bviewBox\s*=\s*["']([^"']+)["']/i.exec(tag);
  let vbW = NaN;
  let vbH = NaN;
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      vbW = parts[2];
      vbH = parts[3];
    }
  }
  const w = wMatch !== null ? parseFloat(wMatch[1]) : NaN;
  const h = hMatch !== null ? parseFloat(hMatch[1]) : NaN;
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { mime: 'image/svg+xml', widthPx: w, heightPx: h, dpi: null };
  }
  if (Number.isFinite(vbW) && Number.isFinite(vbH) && vbW > 0 && vbH > 0) {
    return { mime: 'image/svg+xml', widthPx: vbW, heightPx: vbH, dpi: null };
  }
  return { mime: 'image/svg+xml', widthPx: 300, heightPx: 150, dpi: null };
}

export function sniffImage(buf: Buffer): ImageInfo | null {
  return sniffPng(buf) ?? sniffJpeg(buf) ?? sniffGif(buf) ?? sniffSvg(buf);
}

/** Parse a `data:` URL into mime + bytes. Returns null when not a data URL. */
export function parseDataUrl(src: string): { mime: string; data: Buffer } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(src.trim());
  if (!m) return null;
  const mime = (m[1] ?? 'text/plain').trim().toLowerCase() || 'text/plain';
  const isBase64 = m[2] != null;
  const payload = m[3] ?? '';
  try {
    const data = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
    return { mime, data };
  } catch {
    return null;
  }
}

export interface ResolvedImage {
  buffer: Buffer;
  mime: string;
  wPx: number;
  hPx: number;
}

/**
 * Compute the CSS-px display size of a replaced element from (in priority
 * order) computed-style width/height, width/height attributes and the
 * intrinsic (natural) size — preserving aspect ratio when only one axis is
 * constrained, mirroring the CSS sizing algorithm subset used by WeasyPrint.
 */
export function imageDisplaySize(
  style: Record<string, string>,
  attrs: Record<string, string>,
  naturalW: number,
  naturalH: number,
  containingW: number,
): { w: number; h: number } {
  const cssW = lengthPx(style['width'], containingW);
  const cssH = lengthPx(style['height'], containingW);
  const attrW = attrPx(attrs['width']);
  const attrH = attrPx(attrs['height']);
  const w = cssW ?? attrW ?? null;
  const h = cssH ?? attrH ?? null;
  const ratio = naturalH > 0 ? naturalW / naturalH : 1;
  if (w != null && h != null) return { w: Math.max(1, w), h: Math.max(1, h) };
  if (w != null) {
    const hh = naturalH > 0 && naturalW > 0 ? w / ratio : w;
    return { w: Math.max(1, w), h: Math.max(1, hh) };
  }
  if (h != null) {
    const ww = naturalH > 0 ? h * ratio : h;
    return { w: Math.max(1, ww), h: Math.max(1, h) };
  }
  // Constrain oversized images to the containing block, like `max-width: 100%`.
  const maxW = parseMaxWidth(style['max-width'], containingW) ?? containingW;
  let dw = naturalW;
  let dh = naturalH;
  if (dw > maxW && maxW > 0) {
    dh = (dh * maxW) / dw;
    dw = maxW;
  }
  return { w: Math.max(1, dw), h: Math.max(1, dh) };
}

function attrPx(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (/^\d+(\.\d+)?$/.test(t)) {
    const n = parseFloat(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const m = /^(-?[0-9.]+)(px)?$/.exec(t);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function lengthPx(raw: string | undefined, ref: number): number | null {
  if (raw == null) return null;
  const t = raw.trim().toLowerCase();
  if (t === '' || t === 'auto' || t === 'none') return null;
  if (t.endsWith('%')) {
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? (n / 100) * ref : null;
  }
  const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q|em|rem)?$/.exec(t);
  if (!m) return null;
  const px = toPxSimple(parseFloat(m[1]), m[2] ?? 'px');
  return px != null && px >= 0 ? px : null;
}

function parseMaxWidth(raw: string | undefined, ref: number): number | null {
  if (raw == null) return null;
  const t = raw.trim().toLowerCase();
  if (t === '' || t === 'none') return null;
  return lengthPx(raw, ref);
}

function toPxSimple(value: number, unit: string): number | null {
  switch (unit.toLowerCase()) {
    case 'px': return value;
    case 'pt': return (value * 96) / 72;
    case 'pc': return value * 16;
    case 'in': return value * 96;
    case 'cm': return (value * 96) / 2.54;
    case 'mm': return (value * 96) / 25.4;
    case 'q': return (value * 96) / 2.54 / 40;
    case 'em':
    case 'rem': return value * 16;
    default: return null;
  }
}

export function targetDpiSize(naturalPx: number, dpi: number | null, maxDpi?: number): number {
  if (dpi === null || dpi === undefined || maxDpi === null || maxDpi === undefined) {
    return naturalPx;
  }
  if (!Number.isFinite(naturalPx) || !Number.isFinite(dpi) || !Number.isFinite(maxDpi)) {
    return naturalPx;
  }
  if (dpi <= 0 || maxDpi <= 0 || dpi <= maxDpi) {
    return naturalPx;
  }
  return Math.max(1, Math.round((naturalPx * maxDpi) / dpi));
}
