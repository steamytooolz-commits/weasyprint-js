export declare const SPACE_CHARACTERS: Set<string>;
export declare const PANGO_WHITESPACE: Set<string>;
export declare const ZERO_WIDTH: Set<string>;
/** CSS `white-space` collapsing modes. */
export type WhiteSpace = 'normal' | 'pre' | 'nowrap' | 'pre-wrap' | 'break-spaces' | 'pre-line';
export declare function preserveSpaces(ws: WhiteSpace): boolean;
export declare function preserveLines(ws: WhiteSpace): boolean;
export declare function wrapAllowed(ws: WhiteSpace): boolean;
//# sourceMappingURL=constants.d.ts.map