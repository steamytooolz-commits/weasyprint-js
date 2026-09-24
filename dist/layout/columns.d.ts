/** Resolve the used column count for a container of `width` px. */
export declare function columnCount(width: number, style: Record<string, string>): number;
/** Used column width for `count` equal columns with `gapPx` between them. */
export declare function columnWidth(count: number, containerPx: number, gapPx: number): number;
/**
 * Balance items into `count` columns by height (order-preserving greedy:
 * each item goes to the currently shortest column).
 */
export declare function distributeToColumns<T>(items: T[], heights: number[], count: number): T[][];
//# sourceMappingURL=columns.d.ts.map