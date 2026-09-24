export declare const DEFAULT_DPI = 96;
export declare function pxToPt(px: number): number;
export declare function ptToPx(pt: number): number;
export declare function mmToPx(mm: number): number;
export declare function cmToPx(cm: number): number;
export declare function inchToPxinch(inch: number): number;
export declare function toPx(value: number, unit: string | null, opts?: {
    fontSize?: number;
    rootFontSize?: number;
    dpi?: number;
}): number | null;
export declare function parseLength(text: string, opts?: {
    fontSize?: number;
    rootFontSize?: number;
}): {
    value: number;
    unit: string | null;
} | null;
//# sourceMappingURL=units.d.ts.map