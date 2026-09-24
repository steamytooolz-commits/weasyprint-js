import { PDFDocument } from 'pdf-lib';
import type { PageBox } from '../layout/page.js';
import type { FlowResult } from '../layout/block.js';
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
export declare function buildPdf(pageBox: PageBox, flow: FlowResult, opts?: BuildPdfOptions): Promise<Uint8Array>;
//# sourceMappingURL=build.d.ts.map