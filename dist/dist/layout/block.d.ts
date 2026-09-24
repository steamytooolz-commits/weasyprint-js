import type { Box } from '../formatting-structure/boxes.js';
export interface PlacedLine {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    style: Record<string, string>;
}
export interface PlacedBlock {
    box: Box;
    y: number;
    height: number;
    lines: PlacedLine[];
    background: string | null;
}
export interface FlowResult {
    blocks: PlacedBlock[];
    height: number;
}
export declare function flowDocument(root: Box, contentWidth: number, contentHeight?: number): FlowResult;
//# sourceMappingURL=block.d.ts.map