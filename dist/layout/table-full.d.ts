export interface TableCell {
    minPx: number;
    maxPx: number;
}
/**
 * Distribute `availablePx` across columns.
 * - Columns are sized equally, clamped to each column's `[min, max]`
 *   (column min/max = max of its cells' min/max; missing cells ignored).
 * - `colspan` is ignored (each cell maps to a single column).
 * - `borderSpacing` is the horizontal spacing counted between columns.
 * Returns a matrix mirroring `cells` where each entry holds its column width.
 */
export declare function distributeTableWidths(cells: TableCell[][], availablePx: number, borderSpacing: number): number[][];
/** Row heights: maximum cell height per row (missing/empty rows → 0). */
export declare function tableRowHeights(rows: number[][]): number[];
//# sourceMappingURL=table-full.d.ts.map