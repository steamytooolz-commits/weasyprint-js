export interface Declaration {
    prop: string;
    value: string;
    important: boolean;
}
export interface StyleRule {
    type: 'style';
    selectors: string[];
    declarations: Declaration[];
    media: string | null;
    order: number;
}
export interface AtRule {
    type: 'at';
    name: string;
    prelude: string;
    block: string | null;
    media: string | null;
    order: number;
}
export type CssRule = StyleRule | AtRule;
export interface ParsedStylesheet {
    rules: CssRule[];
}
export declare function parseStylesheet(css: string, media?: string | null): ParsedStylesheet;
/** Expand `margin: a b c d`-style shorthands into longhands. */
export declare function expandShorthands(decls: Declaration[]): Declaration[];
//# sourceMappingURL=tokens.d.ts.map