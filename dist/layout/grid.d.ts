export interface GridPlacement {
    colStart: number;
    colEnd: number;
    rowStart: number;
    rowEnd: number;
}
export declare function layoutGridTracks(spec: string, containerPx: number, gap: number, count: number): number[];
export declare function parseGridPlacement(style: Record<string, string>): GridPlacement;
//# sourceMappingURL=grid.d.ts.map