export interface BorderSide {
    widthPx: number;
    style: string;
    color: string;
}
export declare function parseBorderSide(style: Record<string, string>, side: string): BorderSide;
export declare function borderWidths(style: Record<string, string>): {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
export declare function shouldDraw(side: BorderSide): boolean;
//# sourceMappingURL=border.d.ts.map