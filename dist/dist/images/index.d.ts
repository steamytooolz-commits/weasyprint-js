export interface ImageInfo {
    mime: string;
    widthPx: number;
    heightPx: number;
    dpi: number | null;
}
export declare function sniffImage(buf: Buffer): ImageInfo | null;
/** Parse a `data:` URL into mime + bytes. Returns null when not a data URL. */
export declare function parseDataUrl(src: string): {
    mime: string;
    data: Buffer;
} | null;
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
export declare function imageDisplaySize(style: Record<string, string>, attrs: Record<string, string>, naturalW: number, naturalH: number, containingW: number): {
    w: number;
    h: number;
};
export declare function targetDpiSize(naturalPx: number, dpi: number | null, maxDpi?: number): number;
//# sourceMappingURL=index.d.ts.map