import { URLFetcher } from './urls.js';
import { type SourceInput } from './source.js';
import type { ElementRef } from './css/types.js';
import { Document } from './document.js';
import type { Bookmark } from './document.js';
export declare const VERSION = "0.1.0";
export declare const __version__ = "0.1.0";
export interface RenderOptions {
    stylesheets?: Array<CSS | string> | null;
    mediaType?: string;
    baseUrl?: string | null;
    urlFetcher?: URLFetcher;
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string | string[];
    creator?: string;
    pdfVariant?: string | null;
    pdfVersion?: string | null;
    presentationalHints?: boolean;
    outputIntent?: string;
    optimizeImages?: boolean;
    jpegQuality?: number;
    dpi?: number;
    fullFonts?: boolean;
    hinting?: boolean;
    cacheFolder?: string;
    uncompressedPdf?: boolean;
    /** PDF units per CSS unit (default 1). Mirrors Python `zoom`. */
    zoom?: number;
    /** Post-build hook receiving the pdf-lib document before saving. */
    finisher?: ((doc: unknown) => void | Promise<void>) | null;
    /** Files to embed: `{ source: Buffer, name: string }`. Mirrors `attachments`. */
    attachments?: Array<{
        source: Buffer | Uint8Array | string;
        name: string;
    }> | null;
    /** Emit a tagged (accessible) PDF structure flag. Mirrors `pdf_tags`. */
    pdfTags?: boolean;
}
export declare const DEFAULT_OPTIONS: {
    stylesheets: RenderOptions["stylesheets"];
    mediaType: string;
    baseUrl: string | null;
    uncompressedPdf: boolean;
    presentationalHints: boolean;
    optimizeImages: boolean;
    jpegQuality: number;
    dpi: number | null;
    fullFonts: boolean;
    hinting: boolean;
    zoom: number;
    pdfVariant: string | null;
    pdfVersion: string | null;
    pdfTags: boolean;
    attachments: RenderOptions["attachments"];
};
export type HtmlInput = string | Buffer | URL | SourceInput;
export declare class HTML {
    baseUrl: string;
    htmlString: string;
    urlFetcher: URLFetcher;
    mediaType: string;
    private constructor();
    static create(input: HtmlInput, opts?: {
        baseUrl?: string | null;
        urlFetcher?: URLFetcher;
        mediaType?: string;
    }): Promise<HTML>;
    collectCss(extra?: Array<CSS | string>): Promise<Array<{
        css: string;
        origin: 'author';
    }>>;
    render(opts?: RenderOptions): Promise<Document>;
    writePdf(target?: string | null, opts?: RenderOptions): Promise<Buffer>;
}
export declare class CSS {
    cssText: string;
    baseUrl: string | null;
    private constructor();
    static create(input: string | Buffer | URL | SourceInput, opts?: {
        baseUrl?: string | null;
        urlFetcher?: URLFetcher;
    }): Promise<CSS>;
    static fromString(css: string, baseUrl?: string | null): CSS;
}
export declare class Attachment {
    source: Buffer;
    name: string | null;
    constructor(source: Buffer, name?: string | null);
}
export { computedStyle } from './css/cascade.js';
export type { ElementRef };
export { Document } from './document.js';
export type { Bookmark };
//# sourceMappingURL=index.d.ts.map