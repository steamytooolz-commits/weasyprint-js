// Full table width/height distribution — automatic table layout subset.
/**
 * Distribute `availablePx` across columns.
 * - Columns are sized equally, clamped to each column's `[min, max]`
 *   (column min/max = max of its cells' min/max; missing cells ignored).
 * - `colspan` is ignored (each cell maps to a single column).
 * - `borderSpacing` is the horizontal spacing counted between columns.
 * Returns a matrix mirroring `cells` where each entry holds its column width.
 */
export function distributeTableWidths(cells, availablePx, borderSpacing) {
    if (cells.length === 0)
        return [];
    const available = Number.isFinite(availablePx) && availablePx > 0 ? availablePx : 0;
    const spacing = Number.isFinite(borderSpacing) && borderSpacing > 0 ? borderSpacing : 0;
    let nCols = 0;
    for (const row of cells)
        nCols = Math.max(nCols, row.length);
    if (nCols === 0)
        return cells.map(() => []);
    const colMin = new Array(nCols).fill(0);
    const colMax = new Array(nCols).fill(Infinity);
    const hasCell = new Array(nCols).fill(false);
    for (let c = 0; c < nCols; c++) {
        let mn = 0;
        let mx = 0;
        let seen = false;
        for (const row of cells) {
            const cell = row[c];
            if (cell == null)
                continue;
            seen = true;
            const cmin = Number.isFinite(cell.minPx) && cell.minPx > 0 ? cell.minPx : 0;
            let cmax = Number.isFinite(cell.maxPx) ? cell.maxPx : Infinity;
            if (cmax < cmin)
                cmax = cmin;
            if (cmin > mn)
                mn = cmin;
            if (cmax > mx)
                mx = cmax;
        }
        colMin[c] = mn;
        hasCell[c] = seen;
        colMax[c] = seen ? Math.max(mx, mn) : Infinity;
    }
    const totalSpacing = spacing * Math.max(0, nCols - 1);
    const forCols = Math.max(0, available - totalSpacing);
    const sumMin = colMin.reduce((a, b) => a + b, 0);
    let widths;
    if (sumMin >= forCols) {
        // Not enough space: columns overflow at their minima.
        widths = colMin.slice();
    }
    else {
        widths = new Array(nCols).fill(forCols / nCols);
        const frozen = new Array(nCols).fill(false);
        for (let iter = 0; iter < nCols + 1; iter++) {
            let frozenSum = 0;
            let unfrozenCount = 0;
            for (let i = 0; i < nCols; i++) {
                if (frozen[i])
                    frozenSum += widths[i];
                else
                    unfrozenCount++;
            }
            if (unfrozenCount === 0)
                break;
            const fair = (forCols - frozenSum) / unfrozenCount;
            const violating = [];
            for (let i = 0; i < nCols; i++) {
                if (frozen[i])
                    continue;
                if (fair < colMin[i] - 1e-9 || fair > colMax[i] + 1e-9)
                    violating.push(i);
            }
            if (violating.length === 0) {
                for (let i = 0; i < nCols; i++) {
                    if (!frozen[i])
                        widths[i] = fair;
                }
                break;
            }
            for (const i of violating) {
                if (fair < colMin[i])
                    widths[i] = colMin[i];
                else
                    widths[i] = colMax[i];
                frozen[i] = true;
            }
        }
    }
    void hasCell;
    return cells.map((row) => row.map((_, c) => widths[c] ?? 0));
}
/** Row heights: maximum cell height per row (missing/empty rows → 0). */
export function tableRowHeights(rows) {
    return rows.map((row) => {
        if (row.length === 0)
            return 0;
        let max = 0;
        for (const v of row) {
            if (Number.isFinite(v) && v > max)
                max = v;
        }
        return max;
    });
}
//# sourceMappingURL=table-full.js.map