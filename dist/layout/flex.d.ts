export interface FlexItem {
    box: unknown;
    basisPx: number;
    grow: number;
    shrink: number;
    minPx: number;
    maxPx: number;
}
/**
 * Resolve final main sizes for a single flex row (no wrapping).
 * `containerWidth` is the inner main size of the flex container.
 * `gap` is the `gap`/`column-gap` between adjacent items.
 */
export declare function layoutFlexRow(items: FlexItem[], containerWidth: number, gap?: number): number[];
//# sourceMappingURL=flex.d.ts.map