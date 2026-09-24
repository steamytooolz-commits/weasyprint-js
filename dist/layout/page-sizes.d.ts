export declare const ALL_PAGE_SIZES: Record<string, [number, number]>;
export declare const PAGE_SIZE_NAMES: string[];
export interface ParsedPageSize {
    wMm: number;
    hMm: number;
    landscape: boolean;
}
/**
 * Parse a CSS `@page` `size` value.
 * Handles named sizes (`a4`, `letter`, `jis-b4`, `dl`, …),
 * explicit lengths (`8.5in 11in`, `210mm 297mm`) and
 * `landscape` / `portrait` keywords in any position.
 */
export declare function parsePageSize(sizeStr: string): ParsedPageSize;
//# sourceMappingURL=page-sizes.d.ts.map