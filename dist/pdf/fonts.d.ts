export interface EmbeddedFont {
    family: string;
    bold: boolean;
    italic: boolean;
    data?: Uint8Array;
}
export declare const STANDARD_FONTS: string[];
export declare function pickStandardFont(family: string, bold: boolean, italic: boolean): string;
export declare function subsetNote(): string;
//# sourceMappingURL=fonts.d.ts.map