export interface ParsedFont {
    family: string;
    subfamily: string;
    weight: number;
    italic: boolean;
    unitsPerEm: number;
    ascent: number;
    descent: number;
    advances: Map<number, number>;
    cmap: Map<number, number>;
    numGlyphs: number;
}
export declare function registerFont(buffer: Buffer): ParsedFont | null;
export declare function clearFonts(): void;
export declare function registeredFamilies(): string[];
/** Best match for a family list + weight/style (nearest-weight fallback). */
export declare function matchFont(families: string[], weight: number, italic: boolean): ParsedFont | null;
export declare function fontBufferOf(parsed: ParsedFont): Buffer | null;
/** Advance width of one char in font units (0 when missing). */
export declare function glyphAdvance(parsed: ParsedFont, ch: string): number;
/** Sum advances for text → CSS px at fontSizePx. */
export declare function measureParsed(parsed: ParsedFont, text: string, fontSizePx: number): number;
export declare function __parseCmap4ForTest(view: DataView, buf: Buffer, offset: number, out: Map<number, number>): void;
//# sourceMappingURL=ttf.d.ts.map