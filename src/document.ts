// Document model — mirrors weasyprint/document.py (Document/Page).
import type { Box } from './formatting-structure/boxes.js';
import type { ElementRef } from './css/types.js';
import type { PageBox } from './layout/page.js';
import { flowDocument, type FlowResult } from './layout/block.js';
import { buildPdf } from './pdf/build.js';

export interface PageInfo {
  number: number;
  widthPt: number;
  heightPt: number;
}

export interface Bookmark {
  level: number;
  label: string;
  /** Element uid of the heading (resolved to a page at PDF build time). */
  uid: number;
}

export interface WritePdfOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string | string[];
  creator?: string;
  pdfVariant?: string | null;
  pdfVersion?: string | null;
  uncompressedPdf?: boolean;
  /** PDF units per CSS unit (default 1). Scales page + content like Python. */
  zoom?: number;
  /** Post-build hook receiving the pdf-lib document before saving. */
  finisher?: ((doc: unknown) => void | Promise<void>) | null;
  attachments?: Array<{ source: Buffer | Uint8Array | string; name: string }> | null;
  /** PDF/UA tagged output flag (passed through to the PDF backend). */
  pdfTags?: boolean;
}

export class Document {
  root: Box;
  elements: ElementRef[];
  pageBox: PageBox;
  flow: FlowResult;
  opts: Record<string, unknown>;
  pages: PageInfo[];
  bookmarks: Bookmark[];

  constructor(
    root: Box,
    elements: ElementRef[],
    pageBox: PageBox,
    flow: FlowResult,
    opts: Record<string, unknown> = {},
    bookmarks: Bookmark[] = [],
  ) {
    this.root = root;
    this.elements = elements;
    this.pageBox = pageBox;
    this.flow = flow;
    this.opts = opts;
    this.bookmarks = bookmarks;
    this.pages = pagesFor(flow.height, pageBox);
  }

  /**
   * Return a new Document with only the given 1-based page numbers,
   * mirroring `Document.copy()` page subsets in Python.
   */
  copy(pageNumbers: number[] | null = null): Document {
    if (pageNumbers == null) {
      return new Document(this.root, this.elements, this.pageBox, this.flow, { ...this.opts }, [...this.bookmarks]);
    }
    const wanted = new Set(pageNumbers);
    const perPage = this.pageBox.contentHeight;
    const blocks = this.flow.blocks.filter((b) => {
      const idx = Math.floor(b.y / perPage) + 1;
      return wanted.has(idx);
    });
    const height = blocks.reduce((m, b) => Math.max(m, b.y + b.height), 0);
    const sub = new Document(this.root, this.elements, this.pageBox, { blocks, height }, { ...this.opts }, [...this.bookmarks]);
    const kept = [...wanted].filter((n) => n >= 1 && n <= this.pages.length).sort((a, b) => a - b);
    sub.pages = kept.map((n, i) => ({ ...this.pages[n - 1], number: i + 1 }));
    return sub;
  }

  async writePdf(opts: WritePdfOptions = {}): Promise<Uint8Array> {
    const zoom = opts.zoom ?? 1;
    let pageBox = this.pageBox;
    let flow = this.flow;
    if (Number.isFinite(zoom) && zoom !== 1 && zoom > 0) {
      pageBox = {
        ...this.pageBox,
        widthPx: this.pageBox.widthPx * zoom,
        heightPx: this.pageBox.heightPx * zoom,
        marginTop: this.pageBox.marginTop * zoom,
        marginRight: this.pageBox.marginRight * zoom,
        marginBottom: this.pageBox.marginBottom * zoom,
        marginLeft: this.pageBox.marginLeft * zoom,
        contentWidth: this.pageBox.contentWidth * zoom,
        contentHeight: this.pageBox.contentHeight * zoom,
      };
      flow = flowDocument(this.root, pageBox.contentWidth, pageBox.contentHeight);
    }
    return buildPdf(pageBox, flow, {
      title: opts.title,
      author: opts.author,
      subject: opts.subject,
      keywords: opts.keywords,
      creator: opts.creator,
      pdfVariant: opts.pdfVariant,
      pdfVersion: opts.pdfVersion,
      uncompressed: opts.uncompressedPdf,
      finisher: opts.finisher as never,
      attachments: opts.attachments as never,
      bookmarks: this.bookmarks,
    });
  }
}

function pagesFor(flowHeight: number, pageBox: PageBox): PageInfo[] {
  const count = Math.max(1, Math.ceil(flowHeight / pageBox.contentHeight));
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    widthPt: (pageBox.widthPx * 72) / 96,
    heightPt: (pageBox.heightPx * 72) / 96,
  }));
}
