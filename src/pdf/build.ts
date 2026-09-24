// PDF backend — mirrors weasyprint/pdf/{__init__,metadata,stream}.py
// Uses pdf-lib (replaces pydyf): paginate flowed blocks, draw text +
// backgrounds, embed raster images, add link annotations + outlines,
// set metadata and attachments.
import {
  PDFDocument, StandardFonts, rgb,
  PDFName, PDFString, PDFHexString, PDFNull,
  pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath,
} from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import { pxToPt } from '../css/units.js';
import { fontSizePx } from '../layout/metrics.js';
import { standardPdfFont, fontWeightToNumber, resolveFontFamily } from '../text/fonts.js';
import { matchFont, fontBufferOf } from '../text/ttf.js';
import type { ParsedFont } from '../text/ttf.js';
import { parseColor } from '../draw/color.js';
import { applyMetadata } from './metadata.js';
import { validateVariant } from './variants.js';
import { textTransform } from '../draw/text.js';
import { parseBorderSide, borderWidths } from '../draw/border.js';
import { imageDisplaySize } from '../images/index.js';
import { resolveContent, parseQuotes } from '../css/content.js';
import { CounterScopes } from '../css/counters.js';
import { LOGGER } from '../logger.js';
import type { PageBox } from '../layout/page.js';
import type { FlowResult, PlacedBlock } from '../layout/block.js';

export interface PdfAttachment {
  source: string | Uint8Array | ArrayBuffer;
  name: string;
}

export interface PdfBookmark {
  level: number;
  label: string;
  uid: number;
}

export interface BuildPdfOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[] | string;
  creator?: string;
  pdfVariant?: string | null;
  pdfVersion?: string | null;
  withMetadata?: boolean;
  uncompressed?: boolean;
  baseUrl?: string;
  bookmarks?: PdfBookmark[];
  attachments?: PdfAttachment[] | null;
  finisher?: ((doc: PDFDocument) => void | Promise<void>) | null;
}

export async function buildPdf(
  pageBox: PageBox, flow: FlowResult, opts: BuildPdfOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  validateVariant(opts.pdfVariant ?? null);
  if (opts.withMetadata !== false) {
    applyMetadata(doc, {
      title: opts.title,
      author: opts.author,
      subject: opts.subject,
      keywords: opts.keywords,
      creator: opts.creator,
      producer: 'weasyprint-js 0.1.0',
    });
  } else {
    if (opts.title) doc.setTitle(opts.title);
    if (opts.author) doc.setAuthor(opts.author);
    if (opts.subject) doc.setSubject(opts.subject);
    if (opts.keywords) doc.setKeywords(Array.isArray(opts.keywords) ? opts.keywords : [opts.keywords]);
    doc.setProducer('weasyprint-js 0.1.0');
    if (opts.creator) doc.setCreator(opts.creator);
  }

  const pageW = pxToPt(pageBox.widthPx);
  const pageH = pxToPt(pageBox.heightPx);
  const ml = pxToPt(pageBox.marginLeft);
  const mt = pxToPt(pageBox.marginTop);
  const contentH = pageBox.contentHeight;

  const fonts = new Map<string, Awaited<ReturnType<typeof doc.embedFont>>>();
  const getFont = async (name: string): Promise<Awaited<ReturnType<typeof doc.embedFont>>> => {
    let f = fonts.get(name);
    if (!f) { f = await doc.embedFont(mapFont(name)); fonts.set(name, f); }
    return f;
  };

  // Custom @font-face embedding: works when the host app installed
  // `@pdf-lib/fontkit` (pdf-lib subsets the font on save). Without it we
  // still lay out with real TTF advances but paint the closest Standard-14.
  let fontkitTried = false;
  let fontkit: unknown = null;
  const ensureFontkit = async (): Promise<unknown> => {
    if (fontkitTried) return fontkit;
    fontkitTried = true;
    try {
      const load = Function('return import("@pdf-lib/fontkit")') as () => Promise<unknown>;
      const mod = (await load()) as { default?: unknown };
      fontkit = (mod as { default?: unknown }).default ?? mod;
      doc.registerFontkit(fontkit as never);
      LOGGER.info('custom font embedding enabled via @pdf-lib/fontkit');
    } catch {
      fontkit = null;
    }
    return fontkit;
  };
  const customFonts = new Map<ParsedFont, Awaited<ReturnType<typeof doc.embedFont>>>();
  const resolvePdfFont = async (
    famSpec: string, weight: number, italic: boolean,
  ): Promise<Awaited<ReturnType<typeof doc.embedFont>>> => {
    const fams = resolveFontFamily(famSpec);
    const custom = matchFont(fams, weight, italic);
    if (custom) {
      let f = customFonts.get(custom);
      if (!f) {
        const buf = fontBufferOf(custom);
        if (buf && (await ensureFontkit())) {
          try {
            f = await doc.embedFont(buf);
            customFonts.set(custom, f);
          } catch (e) {
            LOGGER.warning(`Failed to embed font ${custom.family}: ${e instanceof Error ? e.message : e}`);
          }
        }
      }
      if (f) return f;
    }
    return getFont(standardPdfFont(fams[0] ?? 'sans-serif', weight >= 600, italic));
  };

  // Raster image embed cache (shared by <img> and background layers).
  const embeddedImages = new Map<Buffer, Awaited<ReturnType<typeof doc.embedPng>>>();
  const embedRaster = async (
    buffer: Buffer, mime: string,
  ): Promise<Awaited<ReturnType<typeof doc.embedPng>> | null> => {
    const hit = embeddedImages.get(buffer);
    if (hit) return hit;
    try {
      const img = mime === 'image/png' ? await doc.embedPng(buffer) : await doc.embedJpg(buffer);
      embeddedImages.set(buffer, img);
      return img;
    } catch (e) {
      LOGGER.warning(`Failed to embed image (${mime}): ${e instanceof Error ? e.message : e}`);
      return null;
    }
  };

  // Pre-create all pages up front so internal links can target any page.
  const pageCount = Math.max(1, Math.ceil(flow.height / contentH));
  const pages = Array.from({ length: pageCount }, () => doc.addPage([pageW, pageH]));
  const pageIndexAt = (y: number): number => Math.min(pageCount - 1, Math.max(0, Math.floor(y / contentH)));
  const pageTopOf = (idx: number): number => idx * contentH;

  // Anchor map: id/name -> { pageIndex, yPx } for internal `#fragment` links.
  const anchors = new Map<string, { pageIndex: number; yPx: number }>();
  for (const block of flow.blocks) {
    const id = block.box.attrs['id'];
    if (id) anchors.set(id, { pageIndex: pageIndexAt(block.y), yPx: block.y });
    if (block.box.tag === 'a' && block.box.attrs['name']) {
      anchors.set(block.box.attrs['name'], { pageIndex: pageIndexAt(block.y), yPx: block.y });
    }
  }
  // Heading uid -> position (for bookmarks/outlines).
  const uidPos = new Map<number, { pageIndex: number; yPx: number }>();
  for (const block of flow.blocks) {
    if (block.box.uid !== 0 && !uidPos.has(block.box.uid)) {
      uidPos.set(block.box.uid, { pageIndex: pageIndexAt(block.y), yPx: block.y });
    }
  }

  type PendingLink =
    | { kind: 'external'; url: string; rect: [number, number, number, number]; pageIndex: number }
    | { kind: 'internal'; id: string; rect: [number, number, number, number]; pageIndex: number };
  const pendingLinks: PendingLink[] = [];

  let listCounter = 0;
  const drawBlock = async (block: PlacedBlock): Promise<void> => {
    const pageIndex = pageIndexAt(block.y);
    const page = pages[pageIndex];
    const pageTop = pageTopOf(pageIndex);
    const opacityB = readOpacity(block.box.style);

    if (block.box.tag === 'img') {
      await drawImage(block, page, pageTop, opacityB);
      drawBordersClippedOn(page, pageIndex, block.box.style, block.y, block.height, opacityB);
      return;
    }
    drawBoxShadow(block, opacityB);
    if (block.background) {
      const c = parseColor(block.background);
      if (c) {
        let remaining = block.height;
        let by = block.y;
        while (remaining > 0) {
          const idx = pageIndexAt(by);
          const pg = pages[idx];
          const pTop = pageTopOf(idx);
          const onPage = Math.min(remaining, pTop + contentH - by);
          const rw = pxToPt(pageBox.contentWidth);
          const ryTop = pageH - mt - pxToPt(by - pTop) - pxToPt(onPage);
          pg.drawRectangle({
            x: ml, y: ryTop, width: rw, height: pxToPt(onPage),
            color: rgb(c.r, c.g, c.b), opacity: opacityB,
          });
          remaining -= onPage;
          by += onPage;
        }
      }
    }
    await drawBackgroundImage(block, opacityB);
    drawBordersClippedOn(page, pageIndex, block.box.style, block.y, block.height, opacityB);

    // List markers for <li>.
    if (block.box.tag === 'li' && block.lines.length > 0) {
      drawListMarker(block, page, pageTop);
    }

    for (const line of block.lines) {
      if (!line.text.trim() && block.box.tag !== 'a') continue;
      const li = pageIndexAt(line.y);
      const pg = pages[li];
      const pTop = pageTopOf(li);
      const style = line.style;
      const fsPx = fontSizePx(style);
      const fsPt = pxToPt(fsPx);
      const weightNum = fontWeightToNumber(style['font-weight'] ?? 'normal');
      const italic = (style['font-style'] ?? 'normal') !== 'normal';
      const font = await resolvePdfFont(style['font-family'] ?? 'sans-serif', weightNum, italic);
      const opacity = readOpacity(style);
      const col = parseColor(style['color'] ?? 'black') ?? { r: 0, g: 0, b: 0 };
      const xPt = ml + pxToPt(line.x);
      const yPt = pageH - mt - pxToPt(line.y - pTop) - fsPt * 0.8;
      const outText = textTransform(line.text, style['text-transform'] ?? 'none');
      const color = rgb(col.r, col.g, col.b);
      const lsPx = letterSpacingPx(style, fsPx);
      if (lsPx !== 0) {
        let cx = xPt;
        const stepPt = pxToPt(lsPx);
        for (const ch of outText) {
          pg.drawText(ch, { x: cx, y: yPt, size: fsPt, font, color, opacity });
          try {
            cx += (font.widthOfTextAtSize(ch, fsPt) as number) + stepPt;
          } catch {
            cx += fsPt * 0.5 + stepPt;
          }
        }
      } else if (outText) {
        pg.drawText(outText, { x: xPt, y: yPt, size: fsPt, font, color, opacity });
      }
      const deco = (style['text-decoration'] ?? '').toLowerCase();
      if (deco.includes('underline') && outText.trim()) {
        const wPt = pxToPt(line.width);
        pg.drawLine({
          start: { x: xPt, y: yPt - fsPt * 0.12 },
          end: { x: xPt + wPt, y: yPt - fsPt * 0.12 },
          thickness: Math.max(0.5, fsPt / 14), color, opacity,
        });
      } else if (deco.includes('line-through') && outText.trim()) {
        const wPt = pxToPt(line.width);
        pg.drawLine({
          start: { x: xPt, y: yPt + fsPt * 0.28 },
          end: { x: xPt + wPt, y: yPt + fsPt * 0.28 },
          thickness: Math.max(0.5, fsPt / 16), color, opacity,
        });
      }
      // Hyperlinks: every line of an <a href> box becomes a link annotation.
      const href = block.box.tag === 'a' ? (block.box.attrs['href'] ?? '').trim() : '';
      if (href && outText.trim()) {
        const wPt = pxToPt(line.width);
        const hPt = pxToPt(line.height);
        const rect: [number, number, number, number] = [xPt, yPt - fsPt * 0.2, xPt + Math.max(4, wPt), yPt + hPt * 0.9];
        if (href.startsWith('#')) {
          const id = href.slice(1);
          if (id) pendingLinks.push({ kind: 'internal', id, rect, pageIndex: li });
        } else if (/^(https?|ftp|mailto|tel):/i.test(href) || href.startsWith('//')) {
          pendingLinks.push({ kind: 'external', url: href, rect, pageIndex: li });
        } else if (opts.baseUrl) {
          try {
            pendingLinks.push({ kind: 'external', url: new URL(href, opts.baseUrl).href, rect, pageIndex: li });
          } catch {
            pendingLinks.push({ kind: 'external', url: href, rect, pageIndex: li });
          }
        }
      }
    }
  };

  const drawImage = async (
    block: PlacedBlock,
    page: ReturnType<typeof doc.addPage>,
    pageTop: number,
    opacity: number,
  ): Promise<void> => {
    const img = block.box.image;
    const natW = img?.wPx ?? 300;
    const natH = img?.hPx ?? 150;
    const size = imageDisplaySize(block.box.style, block.box.attrs, natW, natH, Math.max(1, pageBox.contentWidth));
    const mtPx = marginTopPx(block.box.style);
    const wPt = pxToPt(size.w);
    const hPt = pxToPt(size.h);
    const yPt = pageH - mt - pxToPt(block.y + mtPx - pageTop) - hPt;
    if (!img) {
      page.drawRectangle({
        x: ml, y: yPt, width: wPt, height: hPt,
        borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.75, opacity,
      });
      return;
    }
    if (img.mime === 'image/png' || img.mime === 'image/jpeg') {
      const embedded = await embedRaster(img.buffer, img.mime);
      if (embedded) {
        page.drawImage(embedded, { x: ml, y: yPt, width: wPt, height: hPt, opacity });
        return;
      }
    } else {
      LOGGER.info(`img placeholder for unsupported type ${img.mime} (${img.wPx}x${img.hPx})`);
    }
    page.drawRectangle({
      x: ml, y: yPt, width: wPt, height: hPt,
      borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.75, opacity,
    });
  };

  /** Solid outset box-shadow (blur renders unblurred — noted limitation). */
  const drawBoxShadow = (block: PlacedBlock, opacity: number): void => {
    const shadow = parseBoxShadow(block.box.style);
    if (!shadow || block.height <= 0) return;
    const rw = pxToPt(pageBox.contentWidth);
    let remaining = block.height;
    let by = block.y;
    while (remaining > 0) {
      const idx = pageIndexAt(by);
      const pg = pages[idx];
      const pTop = pageTopOf(idx);
      const onPage = Math.min(remaining, pTop + contentH - by);
      const topPt = pageH - mt - pxToPt(by - pTop);
      const xPt = ml + pxToPt(shadow.ox) - pxToPt(shadow.spread);
      // PDF y grows up: positive shadow oy moves the shadow down.
      const yPt = topPt - pxToPt(shadow.oy) - pxToPt(onPage) - pxToPt(shadow.spread);
      const wPt = rw + pxToPt(shadow.spread) * 2;
      const hPt = pxToPt(onPage) + pxToPt(shadow.spread) * 2;
      pg.drawRectangle({
        x: xPt, y: yPt, width: Math.max(0.5, wPt), height: Math.max(0.5, hPt),
        color: rgb(shadow.color.r, shadow.color.g, shadow.color.b),
        opacity: opacity * (shadow.blur > 0 ? 0.5 : 1),
      });
      remaining -= onPage;
      by += onPage;
    }
  };

  /** Paint the `background-image` layer (first url() layer, raster only). */
  const drawBackgroundImage = async (block: PlacedBlock, opacity: number): Promise<void> => {
    const bg = block.box.bgImage;
    if (!bg || block.height <= 0) return;
    if (bg.mime !== 'image/png' && bg.mime !== 'image/jpeg') return;
    const style = block.box.style;
    const repeat = (style['background-repeat'] ?? 'repeat').trim().toLowerCase().split(/\s+/)[0] ?? 'repeat';
    const { tw, th } = bgTileSize(
      style['background-size'] ?? 'auto',
      Math.max(1, pageBox.contentWidth), Math.max(1, block.height), bg.wPx, bg.hPx,
    );
    if (tw <= 0 || th <= 0) return;
    const { ox, oy } = bgOrigin(
      style['background-position'] ?? '0% 0%',
      Math.max(1, pageBox.contentWidth), Math.max(1, block.height), tw, th,
    );
    const embedded = await embedRaster(bg.buffer, bg.mime);
    if (!embedded) return;
    const xs = tileOffsets(repeat === 'repeat' || repeat === 'repeat-x', ox, pageBox.contentWidth, tw);
    const ys = tileOffsets(repeat === 'repeat' || repeat === 'repeat-y', oy, block.height, th);
    const rwPt = pxToPt(pageBox.contentWidth);
    let remaining = block.height;
    let by = block.y;
    while (remaining > 0) {
      const idx = pageIndexAt(by);
      const pg = pages[idx];
      const pTop = pageTopOf(idx);
      const onPage = Math.min(remaining, pTop + contentH - by);
      const fragTopPt = pageH - mt - pxToPt(by - pTop);
      const fragBotPt = fragTopPt - pxToPt(onPage);
      withClip(pg, ml, fragBotPt, rwPt, pxToPt(onPage), () => {
        for (const tx of xs) {
          for (const ty of ys) {
            const tileTopFlow = block.y + ty;
            const tileTopPt = pageH - mt - pxToPt(tileTopFlow - pTop);
            pg.drawImage(embedded, {
              x: ml + pxToPt(tx),
              y: tileTopPt - pxToPt(th),
              width: pxToPt(tw),
              height: pxToPt(th),
              opacity,
            });
          }
        }
      });
      remaining -= onPage;
      by += onPage;
    }
  };

  const drawListMarker = (
    block: PlacedBlock, page: ReturnType<typeof doc.addPage>, pageTop: number,
  ): void => {
    const first = block.lines[0];
    const style = block.box.style;
    // Real counter snapshots win; flow-order counting is the fallback.
    const snap = block.box.listMarker;
    const type = ((snap?.type ?? style['list-style-type'] ?? 'disc') as string).trim().toLowerCase();
    const value = snap?.value ?? (++listCounter);
    const fsPx = fontSizePx(style);
    const fsPt = pxToPt(fsPx);
    const col = parseColor(style['color'] ?? 'black') ?? { r: 0, g: 0, b: 0 };
    const color = rgb(col.r, col.g, col.b);
    const yPt = pageH - mt - pxToPt(first.y - pageTop) - fsPt * 0.55;
    const xPt = ml + pxToPt(first.x);
    const opacity = readOpacity(style);
    if (type === 'none') return;
    if (type === 'decimal' || type === 'decimal-leading-zero' || type.endsWith('roman') || type.endsWith('alpha') || type.endsWith('latin') || type === 'upper-roman' || type === 'lower-roman') {
      const label = markerLabel(type, value);
      page.drawText(label, {
        x: xPt - pxToPt(8) - pxToPt(String(label).length * fsPx * 0.5),
        y: pageH - mt - pxToPt(first.y - pageTop) - fsPt * 0.8,
        size: fsPt, color, opacity,
      });
      return;
    }
    const mx = xPt - pxToPt(10);
    if (type === 'square') {
      page.drawRectangle({ x: mx - 2.5, y: yPt - 2.5, width: 5, height: 5, color, opacity });
    } else if (type === 'circle') {
      page.drawCircle({ x: mx, y: yPt, size: 2.5, borderColor: color, borderWidth: 0.9, opacity });
    } else {
      page.drawCircle({ x: mx, y: yPt, size: 2.5, color, opacity });
    }
  };

  const drawBordersForSegmentOn = (
    pg: ReturnType<typeof doc.addPage>,
    segPageTop: number,
    style: Record<string, string>,
    segY: number,
    segH: number,
    isFirst: boolean,
    isLast: boolean,
    opacity = 1,
  ): void => {
    const widths = borderWidths(style);
    if (widths.top + widths.right + widths.bottom + widths.left <= 0) return;
    const rx = ml;
    const rw = pxToPt(pageBox.contentWidth);
    const segTopPt = pageH - mt - pxToPt(segY - segPageTop);
    const segBottomPt = pageH - mt - pxToPt(segY - segPageTop + segH);
    const sides = [
      { name: 'top', show: isFirst },
      { name: 'right', show: true },
      { name: 'bottom', show: isLast },
      { name: 'left', show: true },
    ] as const;
    for (const side of sides) {
      if (!side.show) continue;
      const parsed = parseBorderSide(style, side.name);
      if (parsed.widthPx <= 0) continue;
      if (parsed.style === 'none' || parsed.style === 'hidden') continue;
      const col = parseColor(parsed.color) ?? { r: 0, g: 0, b: 0 };
      const wPt = pxToPt(parsed.widthPx);
      const color = rgb(col.r, col.g, col.b);
      if (side.name === 'top') {
        pg.drawRectangle({ x: rx, y: segTopPt - wPt / 2, width: rw, height: wPt, color, opacity });
      } else if (side.name === 'bottom') {
        pg.drawRectangle({ x: rx, y: segBottomPt - wPt / 2, width: rw, height: wPt, color, opacity });
      } else if (side.name === 'left') {
        pg.drawRectangle({ x: rx - wPt / 2, y: segBottomPt, width: wPt, height: segTopPt - segBottomPt, color, opacity });
      } else {
        pg.drawRectangle({ x: rx + rw - wPt / 2, y: segBottomPt, width: wPt, height: segTopPt - segBottomPt, color, opacity });
      }
    }
  };

  const drawBordersClippedOn = (
    pg: ReturnType<typeof doc.addPage>,
    pgIndex: number,
    style: Record<string, string>,
    top: number,
    height: number,
    opacity = 1,
  ): void => {
    if (height <= 0) {
      drawBordersForSegmentOn(pg, pageTopOf(pgIndex), style, top, 0, true, true, opacity);
      return;
    }
    let remaining = height;
    let by = top;
    while (remaining > 0) {
      const idx = pageIndexAt(by);
      const target = pages[idx];
      const pTop = pageTopOf(idx);
      const onPage = Math.min(remaining, pTop + contentH - by);
      drawBordersForSegmentOn(
        target, pTop, style, by, onPage,
        by === top, by + onPage >= top + height, opacity,
      );
      remaining -= onPage;
      by += onPage;
    }
  };

  // Reset ordered-list numbering at each list container.
  for (const block of flow.blocks) {
    await drawBlock(block);
  }

  await drawMarginBoxes(doc, pages, pageBox, resolvePdfFont);
  addLinkAnnotations(doc, pages, pendingLinks, anchors, pageH, mt, contentH);
  await addOutlines(doc, pages, opts.bookmarks ?? [], uidPos, pageH, mt, contentH);

  if (opts.attachments) {
    for (const att of opts.attachments) {
      try {
        await doc.attach(att.source as never, att.name);
      } catch (e) {
        LOGGER.warning(`Failed to attach ${att.name}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  if (opts.finisher) await opts.finisher(doc);

  return doc.save({ useObjectStreams: !opts.uncompressed });
}

function readOpacity(style: Record<string, string>): number {
  const raw = style['opacity'];
  if (raw == null) return 1;
  const n = parseFloat(raw.trim());
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

interface BoxShadow {
  ox: number; oy: number; blur: number; spread: number;
  color: { r: number; g: number; b: number };
}

/** Parse the first outset `box-shadow` layer (inset unsupported). */
function parseBoxShadow(style: Record<string, string>): BoxShadow | null {
  const raw = style['box-shadow'];
  if (!raw) return null;
  const first = raw.split(/,(?![^(]*\))/)[0]?.trim() ?? '';
  if (!first || /^none$/i.test(first)) return null;
  if (/\binset\b/i.test(first)) return null;
  const parts = first.split(/\s+/).filter(Boolean);
  const lens: number[] = [];
  const rest: string[] = [];
  for (const p of parts) {
    const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q)?$/.exec(p);
    if (m) {
      const n = parseFloat(m[1]);
      const u = (m[2] ?? 'px').toLowerCase();
      const k = u === 'px' ? 1 : u === 'pt' ? 96 / 72 : u === 'pc' ? 16
        : u === 'in' ? 96 : u === 'cm' ? 96 / 2.54 : u === 'mm' ? 96 / 25.4
        : u === 'q' ? 96 / 2.54 / 40 : 1;
      lens.push(n * k);
    } else {
      rest.push(p);
    }
  }
  if (lens.length < 2) return null;
  const color = parseColor(rest.join(' ') || 'black') ?? { r: 0, g: 0, b: 0 };
  return {
    ox: lens[0], oy: lens[1], blur: lens[2] ?? 0, spread: lens[3] ?? 0,
    color: { r: color.r, g: color.g, b: color.b },
  };
}

function letterSpacingPx(style: Record<string, string>, fontPx: number): number {
  const raw = style['letter-spacing'];
  if (!raw) return 0;
  const t = raw.trim().toLowerCase();
  if (t === '' || t === 'normal' || t === 'none') return 0;
  const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q|em|rem)?$/.exec(t);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return 0;
  const u = (m[2] ?? 'px').toLowerCase();
  const k = u === 'px' ? 1 : u === 'pt' ? 96 / 72 : u === 'pc' ? 16
    : u === 'in' ? 96 : u === 'cm' ? 96 / 2.54 : u === 'mm' ? 96 / 25.4
    : u === 'q' ? 96 / 2.54 / 40 : u === 'em' || u === 'rem' ? fontPx : 1;
  return n * k;
}

function marginTopPx(style: Record<string, string>): number {
  const raw = style['margin-top'] ?? '0';
  const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q|em|rem)?$/.exec(raw.trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return 0;
  const u = (m[2] ?? 'px').toLowerCase();
  if (u === 'px') return n;
  if (u === 'pt') return (n * 96) / 72;
  if (u === 'in') return n * 96;
  return n;
}

type AnyPage = ReturnType<PDFDocument['addPage']>;

const MARGIN_BOX_NAMES = [
  'top-left-corner', 'top-left', 'top-center', 'top-right', 'top-right-corner',
  'bottom-left-corner', 'bottom-left', 'bottom-center', 'bottom-right', 'bottom-right-corner',
  'left-top', 'left-middle', 'left-bottom', 'right-top', 'right-middle', 'right-bottom',
] as const;

/** Paint @page margin boxes (running headers/footers, page numbers). */
async function drawMarginBoxes(
  doc: PDFDocument,
  pages: AnyPage[],
  pageBox: PageBox,
  resolveFont: (fam: string, weight: number, italic: boolean) => Promise<PDFFont>,
): Promise<void> {
  const defs = pageBox.marginBoxes ?? {};
  const names = (Object.keys(defs) as string[]).filter((n) =>
    (MARGIN_BOX_NAMES as readonly string[]).includes(n),
  );
  if (names.length === 0) return;
  const pageW = pxToPt(pageBox.widthPx);
  const pageH = pxToPt(pageBox.heightPx);
  const mT = pxToPt(pageBox.marginTop);
  const mB = pxToPt(pageBox.marginBottom);
  const mL = pxToPt(pageBox.marginLeft);
  const mR = pxToPt(pageBox.marginRight);
  const midW = Math.max(0, pageW - mL - mR);
  const midH = Math.max(0, pageH - mT - mB);
  const scopes = new CounterScopes();
  const quotes = parseQuotes(undefined);
  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    const ctx = { number: p + 1, count: pages.length };
    for (const name of names) {
      const style = defs[name] ?? {};
      const content = style['content'] ?? 'normal';
      let resolved: { text: string } | null = null;
      try {
        resolved = resolveContent(content, { counters: scopes, attrs: {}, quotes, quoteDepth: 0 }, ctx);
      } catch {
        resolved = null;
      }
      if (!resolved || !resolved.text) continue;
      const text = resolved.text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const rect = marginRect(name, pageW, pageH, mT, mB, mL, mR, midW, midH);
      if (!rect) continue;
      const fsPx = fontSizePx({ 'font-size': style['font-size'] ?? '10px' });
      const fsPt = pxToPt(fsPx);
      const weightNum = fontWeightToNumber(style['font-weight'] ?? 'normal');
      const italic = (style['font-style'] ?? 'normal') !== 'normal';
      const font = await resolveFont(style['font-family'] ?? 'sans-serif', weightNum, italic);
      const opacity = readOpacity(style);
      const col = parseColor(style['color'] ?? 'black') ?? { r: 0, g: 0, b: 0 };
      const align = (style['text-align'] ??
        (name.includes('center') || name.includes('middle') ? 'center' : name.includes('right') ? 'right' : 'left')
      ).trim().toLowerCase();
      let wPt = fsPt * text.length * 0.5;
      try {
        wPt = font.widthOfTextAtSize(text, fsPt) as number;
      } catch { /* keep estimate */ }
      let x = rect.x;
      if (align === 'center') x = rect.x + Math.max(0, (rect.w - wPt) / 2);
      else if (align === 'right' || align === 'end') x = rect.x + Math.max(0, rect.w - wPt);
      // Vertical: top row → top, middle row → centered, bottom row → baseline up.
      let y: number;
      if (name.startsWith('top')) y = rect.yTop - fsPt * 1.0;
      else if (name.startsWith('bottom')) y = rect.yTop - rect.h + fsPt * 0.25;
      else y = rect.yTop - rect.h / 2 - fsPt * 0.35;
      page.drawText(text, { x, y, size: fsPt, font, color: rgb(col.r, col.g, col.b), opacity });
    }
  }
}

/** Margin-box rectangle in PDF points: { x, yTop, w, h }. */
function marginRect(
  name: string, pageW: number, pageH: number,
  mT: number, mB: number, mL: number, mR: number, midW: number, midH: number,
): { x: number; yTop: number; w: number; h: number } | null {
  const thirdW = midW / 3;
  const thirdH = midH / 3;
  switch (name) {
    case 'top-left-corner': return { x: 0, yTop: pageH, w: mL, h: mT };
    case 'top-left': return { x: mL, yTop: pageH, w: thirdW, h: mT };
    case 'top-center': return { x: mL + thirdW, yTop: pageH, w: thirdW, h: mT };
    case 'top-right': return { x: mL + thirdW * 2, yTop: pageH, w: thirdW, h: mT };
    case 'top-right-corner': return { x: pageW - mR, yTop: pageH, w: mR, h: mT };
    case 'bottom-left-corner': return { x: 0, yTop: mB, w: mL, h: mB };
    case 'bottom-left': return { x: mL, yTop: mB, w: thirdW, h: mB };
    case 'bottom-center': return { x: mL + thirdW, yTop: mB, w: thirdW, h: mB };
    case 'bottom-right': return { x: mL + thirdW * 2, yTop: mB, w: thirdW, h: mB };
    case 'bottom-right-corner': return { x: pageW - mR, yTop: mB, w: mR, h: mB };
    case 'left-top': return { x: 0, yTop: pageH - mT, w: mL, h: thirdH };
    case 'left-middle': return { x: 0, yTop: pageH - mT - thirdH, w: mL, h: thirdH };
    case 'left-bottom': return { x: 0, yTop: pageH - mT - thirdH * 2, w: mL, h: thirdH };
    case 'right-top': return { x: pageW - mR, yTop: pageH - mT, w: mR, h: thirdH };
    case 'right-middle': return { x: pageW - mR, yTop: pageH - mT - thirdH, w: mR, h: thirdH };
    case 'right-bottom': return { x: pageW - mR, yTop: pageH - mT - thirdH * 2, w: mR, h: thirdH };
    default: return null;
  }
}

type PendingLink =
  | { kind: 'external'; url: string; rect: [number, number, number, number]; pageIndex: number }
  | { kind: 'internal'; id: string; rect: [number, number, number, number]; pageIndex: number };

function addLinkAnnotations(
  doc: PDFDocument,
  pages: AnyPage[],
  links: PendingLink[],
  anchors: Map<string, { pageIndex: number; yPx: number }>,
  pageH: number,
  mt: number,
  contentH: number,
): void {
  if (links.length === 0) return;
  const ctx = doc.context;
  for (const link of links) {
    const page = pages[link.pageIndex];
    if (!page) continue;
    const [x1, y1, x2, y2] = link.rect;
    let action: unknown = null;
    if (link.kind === 'external') {
      action = {
        Type: PDFName.of('Action'),
        S: PDFName.of('URI'),
        URI: PDFHexString.fromText(link.url),
      };
    } else {
      const target = anchors.get(link.id);
      if (!target) {
        LOGGER.warning(`Unresolved internal link #${link.id}`);
        continue;
      }
      const targetPage = pages[target.pageIndex];
      if (!targetPage) continue;
      const yPt = pageH - mt - (target.yPx - target.pageIndex * contentH);
      action = {
        S: PDFName.of('GoTo'),
        D: ctx.obj([targetPage.ref, PDFName.of('XYZ'), PDFNull, yPt, PDFNull]),
      };
    }
    try {
      const annot = ctx.obj({
        Type: PDFName.of('Annot'),
        Subtype: PDFName.of('Link'),
        Rect: [x1, y1, x2, y2],
        Border: [0, 0, 0],
        A: action as never,
      });
      const ref = ctx.register(annot);
      page.node.addAnnot(ref);
    } catch (e) {
      LOGGER.warning(`Failed to add link annotation: ${e instanceof Error ? e.message : e}`);
    }
  }
}

async function addOutlines(
  doc: PDFDocument,
  pages: AnyPage[],
  bookmarks: PdfBookmark[],
  uidPos: Map<number, { pageIndex: number; yPx: number }>,
  pageH: number,
  mt: number,
  contentH: number,
): Promise<void> {
  const items = bookmarks
    .map((b) => {
      const pos = uidPos.get(b.uid);
      if (!pos) return null;
      return { title: b.label, level: b.level, pageIndex: pos.pageIndex, yPx: pos.yPx };
    })
    .filter((x): x is { title: string; level: number; pageIndex: number; yPx: number } => x != null);
  if (items.length === 0) return;
  try {
    const ctx = doc.context;
    interface Node { title: string; pageIndex: number; yPx: number; children: Node[] }
    const roots: Node[] = [];
    const stack: { level: number; node: Node }[] = [];
    for (const it of items) {
      const node: Node = { title: it.title, pageIndex: it.pageIndex, yPx: it.yPx, children: [] };
      while (stack.length > 0 && stack[stack.length - 1].level >= it.level) stack.pop();
      if (stack.length === 0) roots.push(node);
      else stack[stack.length - 1].node.children.push(node);
      stack.push({ level: it.level, node });
    }
    const outlinesRef = ctx.nextRef();
    const refs: Array<{ ref: ReturnType<typeof ctx.nextRef>; node: Node; parentRef: unknown; prevRef: unknown; nextRef: unknown; firstRef: unknown; lastRef: unknown; count: number }> = [];
    const flat: Node[] = [];
    const walkFlat = (n: Node): void => { flat.push(n); for (const c of n.children) walkFlat(c); };
    for (const r of roots) walkFlat(r);
    const refByNode = new Map<Node, ReturnType<typeof ctx.nextRef>>();
    for (const n of flat) refByNode.set(n, ctx.nextRef());

    const countOf = (n: Node): number => {
      let c = n.children.length;
      for (const ch of n.children) c += countOf(ch);
      return c;
    };
    const assign = (list: Node[], parentRef: unknown): void => {
      list.forEach((n, i) => {
        const kids = n.children;
        const entry = {
          ref: refByNode.get(n)!,
          node: n,
          parentRef,
          prevRef: i > 0 ? refByNode.get(list[i - 1]) : null,
          nextRef: i < list.length - 1 ? refByNode.get(list[i + 1]) : null,
          firstRef: kids.length > 0 ? refByNode.get(kids[0]) : null,
          lastRef: kids.length > 0 ? refByNode.get(kids[kids.length - 1]) : null,
          count: countOf(n),
        };
        refs.push(entry);
        if (kids.length > 0) assign(kids, entry.ref);
      });
    };
    assign(roots, outlinesRef);
    for (const e of refs) {
      const targetPage = pages[e.node.pageIndex];
      if (!targetPage) continue;
      const yPt = pageH - mt - (e.node.yPx - e.node.pageIndex * contentH);
      const dict: Record<string, unknown> = {
        Title: PDFString.of(e.node.title),
        Parent: e.parentRef as never,
        Dest: ctx.obj([targetPage.ref, PDFName.of('XYZ'), PDFNull, yPt, PDFNull]),
      };
      if (e.prevRef) dict['Prev'] = e.prevRef as never;
      if (e.nextRef) dict['Next'] = e.nextRef as never;
      if (e.firstRef) {
        dict['First'] = e.firstRef as never;
        dict['Last'] = e.lastRef as never;
        dict['Count'] = e.count;
      }
      ctx.assign(e.ref, ctx.obj(dict as never));
    }
    const outlinesDict = ctx.obj({
      Type: PDFName.of('Outlines'),
      First: refByNode.get(roots[0]) as never,
      Last: refByNode.get(roots[roots.length - 1]) as never,
      Count: flat.length,
    });
    ctx.assign(outlinesRef, outlinesDict);
    doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
    void pages;
  } catch (e) {
    LOGGER.warning(`Failed to add PDF outlines: ${e instanceof Error ? e.message : e}`);
  }
}

/** Run drawing ops clipped to a rectangle (PDF points). */
function withClip(
  page: AnyPage, x: number, y: number, w: number, h: number, fn: () => void,
): void {
  page.pushOperators(pushGraphicsState(), moveTo(x, y), lineTo(x + w, y), lineTo(x + w, y + h), lineTo(x, y + h), closePath(), clip(), endPath());
  try {
    fn();
  } finally {
    page.pushOperators(popGraphicsState());
  }
}

/** Background tile size in px from `background-size`. */
function bgTileSize(
  size: string, areaW: number, areaH: number, natW: number, natH: number,
): { tw: number; th: number } {
  const t = size.trim().toLowerCase();
  if (t === '' || t === 'auto') return { tw: natW, th: natH };
  if (t === 'contain' || t === 'cover') {
    const s = t === 'contain'
      ? Math.min(areaW / natW, areaH / natH)
      : Math.max(areaW / natW, areaH / natH);
    return { tw: Math.max(1, natW * s), th: Math.max(1, natH * s) };
  }
  const parts = t.split(/\s+/).filter(Boolean);
  const dim = (v: string | undefined, ref: number): number | null => {
    if (v == null || v === 'auto') return null;
    if (v.endsWith('%')) {
      const n = parseFloat(v);
      return Number.isFinite(n) ? (n / 100) * ref : null;
    }
    const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q)?$/.exec(v);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const u = m[2] ?? 'px';
    const k = u === 'px' ? 1 : u === 'pt' ? 96 / 72 : u === 'pc' ? 16
      : u === 'in' ? 96 : u === 'cm' ? 96 / 2.54 : u === 'mm' ? 96 / 25.4
      : u === 'q' ? 96 / 2.54 / 40 : 1;
    return n * k * 1; // px already
  };
  let tw = dim(parts[0], areaW);
  let th = dim(parts[1], areaH);
  if (tw == null && th == null) return { tw: natW, th: natH };
  if (tw == null) tw = (th as number) * (natW / natH);
  if (th == null) th = (tw as number) * (natH / natW);
  return { tw: Math.max(1, tw as number), th: Math.max(1, th as number) };
}

/** Background origin offset in px from `background-position`. */
function bgOrigin(
  pos: string, areaW: number, areaH: number, tw: number, th: number,
): { ox: number; oy: number } {
  const parts = pos.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const px = parts[0] ?? '0%';
  const py = parts[1] ?? 'center';
  return { ox: bgPosAxis(px, areaW, tw, true), oy: bgPosAxis(py, areaH, th, false) };
}

function bgPosAxis(token: string, area: number, tile: number, isX: boolean): number {
  const kw: Record<string, number> = isX
    ? { left: 0, center: 0.5, right: 1 }
    : { top: 0, center: 0.5, bottom: 1 };
  if (token in kw) return (area - tile) * kw[token];
  // center is shared
  if (token === 'center') return (area - tile) * 0.5;
  if (token.endsWith('%')) {
    const n = parseFloat(token);
    return Number.isFinite(n) ? ((area - tile) * n) / 100 : 0;
  }
  const m = /^(-?[0-9.]+)(px|pt|pc|in|cm|mm|q)?$/.exec(token);
  if (m) {
    const n = parseFloat(m[1]);
    const u = m[2] ?? 'px';
    const k = u === 'px' ? 1 : u === 'pt' ? 96 / 72 : u === 'pc' ? 16
      : u === 'in' ? 96 : u === 'cm' ? 96 / 2.54 : u === 'mm' ? 96 / 25.4
      : u === 'q' ? 96 / 2.54 / 40 : 1;
    return n * k;
  }
  return 0;
}

/** Tile offsets covering [0, area) starting from origin o with size t. */
function tileOffsets(tiled: boolean, o: number, area: number, t: number): number[] {
  if (!tiled) return [o];
  const out: number[] = [];
  const start = Math.floor((0 - o) / t) * t + o;
  for (let x = start; x < area; x += t) {
    out.push(x);
    if (out.length > 1000) break; // degenerate guard
  }
  return out.length > 0 ? out : [o];
}

function markerLabel(type: string, n: number): string {  if (type === 'decimal-leading-zero') return `${String(n).padStart(2, '0')}.`;
  if (type === 'lower-roman' || type === 'upper-roman') {
    const r = toRoman(n);
    return `${type.startsWith('upper') ? r : r.toLowerCase()}.`;
  }
  if (type === 'lower-alpha' || type === 'lower-latin') return `${alphaLabel(n, false)}.`;
  if (type === 'upper-alpha' || type === 'upper-latin') return `${alphaLabel(n, true)}.`;
  return `${n}.`;
}

function toRoman(n: number): string {
  const table: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rest = Math.max(1, Math.min(3999, n));
  for (const [v, s] of table) {
    while (rest >= v) { out += s; rest -= v; }
  }
  return out;
}

function alphaLabel(n: number, upper: boolean): string {
  let out = '';
  let rest = Math.max(1, n);
  while (rest > 0) {
    rest -= 1;
    out = String.fromCharCode((upper ? 65 : 97) + (rest % 26)) + out;
    rest = Math.floor(rest / 26);
  }
  return out;
}

function mapFont(name: string): Parameters<PDFDocument['embedFont']>[0] {
  switch (name) {
    case 'Courier': return StandardFonts.Courier;
    case 'Courier-Bold': return StandardFonts.CourierBold;
    case 'Courier-Oblique': return StandardFonts.CourierOblique;
    case 'Courier-BoldOblique': return StandardFonts.CourierBoldOblique;
    case 'Times-Roman': return StandardFonts.TimesRoman;
    case 'Times-Bold': return StandardFonts.TimesRomanBold;
    case 'Times-Italic': return StandardFonts.TimesRomanItalic;
    case 'Times-BoldItalic': return StandardFonts.TimesRomanBoldItalic;
    case 'Helvetica-Bold': return StandardFonts.HelveticaBold;
    case 'Helvetica-Oblique': return StandardFonts.HelveticaOblique;
    case 'Helvetica-BoldOblique': return StandardFonts.HelveticaBoldOblique;
    default: return StandardFonts.Helvetica;
  }
}
