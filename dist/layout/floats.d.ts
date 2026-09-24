export type FloatSide = 'left' | 'right';
export declare class FloatManager {
    private readonly widthPx;
    private readonly floats;
    constructor(widthPx: number);
    addFloat(side: FloatSide, y: number, w: number, h: number): void;
    private overlaps;
    /**
     * Available horizontal space for a block starting at `y` with height `h`.
     * Returns the x-offset of the content edge and the usable width after
     * excluding overlapping left/right floats.
     */
    availableWidthAt(y: number, h: number): {
        x: number;
        width: number;
    };
    /** Push `y` past floats required by `clear` (`left`/`right`/`both`). */
    clearY(clear: string, y: number): number;
}
//# sourceMappingURL=floats.d.ts.map