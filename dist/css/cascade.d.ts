import type { ElementRef, CascadeEntry, PageRule, FontFaceRule } from './types.js';
export type { ElementRef, CascadeEntry, PageRule, FontFaceRule };
export interface CascadeResult {
    matched: Map<number, Map<string, CascadeEntry>>;
    origins: Map<string, 'ua' | 'user' | 'author'>;
    pageRules: PageRule[];
    fontFaces: FontFaceRule[];
    /** Per-element ::before/::after specified declarations (for generated boxes). */
    pseudos: {
        before: Map<number, Map<string, CascadeEntry>>;
        after: Map<number, Map<string, CascadeEntry>>;
    };
}
type Origin = 'ua' | 'user' | 'author';
export declare function buildCascade(elements: ElementRef[], sheets: Array<{
    css: string;
    origin: Origin;
    media?: string | null;
}>, opts?: {
    mediaType?: string;
    presentationalHints?: boolean;
}): CascadeResult;
export declare function parsePageRule(prelude: string, block: string): PageRule;
export declare function declMap(block: string): Record<string, string>;
/** Resolve inheritance for one element. */
export declare function computedStyle(matched: Map<number, Map<string, CascadeEntry>>, elements: ElementRef[], uid: number, memo?: Map<number, Record<string, string>>): Record<string, string>;
/**
 * Computed style for a ::before/::after pseudo-element: the originating
 * element's computed style as base, overlaid with the pseudo's own
 * declarations run through computeValue. Returns null when no rules apply.
 */
export declare function computedPseudoStyle(pseudos: CascadeResult['pseudos'], uid: number, kind: 'before' | 'after', elementStyle: Record<string, string>): Record<string, string> | null;
//# sourceMappingURL=cascade.d.ts.map