export interface ContainingBlock {
    w: number;
    h: number;
}
export interface IntrinsicSize {
    w: number;
    h: number;
}
export interface AbsoluteBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
/**
 * Resolve an absolutely positioned box inside `containing`.
 * - `auto` width with both offsets set stretches to fill.
 * - Over-constrained `left+right+width` (LTR) keeps `left`+`width`.
 */
export declare function resolveAbsolute(style: Record<string, string>, containing: ContainingBlock, intrinsic: IntrinsicSize): AbsoluteBox;
//# sourceMappingURL=absolute.d.ts.map