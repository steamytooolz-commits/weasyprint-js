export type MediaType = 'print' | 'screen' | 'all';
export declare function parseMediaQuery(media: string | null | undefined): {
    types: string[];
    conditions: string;
};
export declare function evaluateMedia(query: string | null | undefined, mediaType: string, viewport?: {
    widthPx: number;
    heightPx: number;
}): boolean;
//# sourceMappingURL=media-queries.d.ts.map