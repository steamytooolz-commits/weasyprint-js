import type { ElementRef } from './types.js';
export interface SiblingCtx {
    byUid: Map<number, ElementRef>;
    childrenOf: Map<number | null, number[]>;
    indexOf: Map<number, number>;
}
/** Build sibling order from document-order element refs. */
export declare function buildSiblingCtx(elements: ElementRef[]): SiblingCtx;
/** Compute (id, class/attr, element) specificity. */
export declare function specificity(selector: string): [number, number, number];
/** Small selector matcher: type, #id, .class, [attr], pseudos, combinators. */
export declare function matches(el: ElementRef, selector: string, byUid?: Map<number, ElementRef>, sibCtx?: SiblingCtx | null): boolean;
export declare function matchesCompound(el: ElementRef, compound: string, ctx?: SiblingCtx | {
    byUid: Map<number, ElementRef>;
    childrenOf: Map<number | null, number[]>;
    indexOf: Map<number, number>;
} | null): boolean;
/** an+b matching for :nth-* (1-based). Supports odd/even/N. */
export declare function nth(pos: number, expr: string): boolean;
//# sourceMappingURL=specificity.d.ts.map