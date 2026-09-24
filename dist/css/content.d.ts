import { CounterScopes } from './counters.js';
export interface ContentCtx {
    counters: CounterScopes;
    attrs: Record<string, string>;
    quotes: string[];
    quoteDepth: number;
}
export interface ResolvedContent {
    text: string;
    quoteDepth: number;
}
/**
 * Resolve a computed `content` value to text. Returns null for
 * normal/none/unresolvable. `pageNumber`/`pageCount` resolve
 * counter(page)/counter(pages) (margin-box context); otherwise those
 * contribute ''.
 */
export declare function resolveContent(value: string, ctx: ContentCtx, page?: {
    number: number;
    count: number;
}): ResolvedContent | null;
/** Parse the `quotes` property into open/close pairs. */
export declare function parseQuotes(value: string | undefined): string[];
//# sourceMappingURL=content.d.ts.map