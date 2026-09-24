export interface FontFace {
    family: string;
    style: string;
    weight: number;
    src: string | null;
}
export declare function resolveFontFamily(spec: string): string[];
export declare function standardPdfFont(family: string, bold: boolean, italic: boolean): string;
export declare function fontWeightToNumber(w: string): number;
export declare function parseFontFaces(rules: {
    declarations: Record<string, string>;
}[]): FontFace[];
//# sourceMappingURL=fonts.d.ts.map