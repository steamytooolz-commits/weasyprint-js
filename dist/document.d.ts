import type { Box } from './formatting-structure/boxes.js';
import type { ElementRef } from './css/types.js';
import type { PageBox } from './layout/page.js';
import { type FlowResult } from './layout/block.js';
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
    attachments?: Array<{
        source: Buffer | Uint8Array | string;
        name: string;
    }> | null;
    /** PDF/UA tagged output flag (passed through to the PDF backend). */
    pdfTags?: boolean;
}
export declare class Document {
    root: Box;
    elements: ElementRef[];
    pageBox: PageBox;
    flow: FlowResult;
    opts: Record<string, unknown>;
    pages: PageInfo[];
    bookmarks: Bookmark[];
    constructor(root: Box, elements: ElementRef[], pageBox: PageBox, flow: FlowResult, opts?: Record<string, unknown>, bookmarks?: Bookmark[]);
    /**
     * Return a new Document with only the given 1-based page numbers,
     * mirroring `Document.copy()` page subsets in Python.
     */
    copy(pageNumbers?: number[] | null): Document;
    writePdf(opts?: WritePdfOptions): Promise<Uint8Array>;
}
//# sourceMappingURL=document.d.ts.map