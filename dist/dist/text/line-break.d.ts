export interface BreakOpts {
    hyphenate?: boolean;
    hyphenateWord?: (word: string) => string[];
    maxWidthFn?: (text: string) => number;
    maxWidth?: number;
    whiteSpace?: string;
}
export declare function wrapText(text: string, opts: BreakOpts): string[];
//# sourceMappingURL=line-break.d.ts.map