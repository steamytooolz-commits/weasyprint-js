import type { CounterScopes } from './counters.js';
import type { TargetCollector } from './targets.js';
export interface AttrRef {
    name: string;
    fallback: string | null;
}
export interface CounterRef {
    name: string;
    style: string;
}
export interface CountersRef {
    name: string;
    separator: string;
    style: string;
}
export interface TargetCounterRef {
    target: string;
    counter: string;
    style: string;
}
export interface ContentContext {
    attrs?: Record<string, string>;
    counters?: CounterScopes | null;
    targets?: TargetCollector | null;
    quotes?: string[];
    quoteDepth?: number;
}
export declare function unquote(s: string): string;
export declare function splitArgs(inner: string): string[];
export declare function parseAttr(raw: string): AttrRef | null;
export declare function parseCounter(raw: string): CounterRef | null;
export declare function parseCounters(raw: string): CountersRef | null;
export declare function parseTargetCounter(raw: string): TargetCounterRef | null;
/** Resolve an attr()/url target to a plain id or URL string. */
export declare function resolveTargetId(rawTarget: string, ctx: ContentContext): string;
export type ContentToken = {
    kind: 'string';
    value: string;
} | {
    kind: 'url';
    value: string;
} | {
    kind: 'counter';
    raw: string;
} | {
    kind: 'counters';
    raw: string;
} | {
    kind: 'target-counter';
    raw: string;
} | {
    kind: 'attr';
    raw: string;
} | {
    kind: 'open-quote';
} | {
    kind: 'close-quote';
} | {
    kind: 'no-open-quote';
} | {
    kind: 'no-close-quote';
};
/** Split a `content` value into typed tokens. Returns null if invalid. */
export declare function tokenizeContent(value: string): ContentToken[] | null;
/** Resolve one attr() against element attributes. */
export declare function resolveAttr(raw: string, attrs: Record<string, string>): string;
/** Resolve a `content` declaration to display text. */
export declare function resolveContentList(style: Record<string, string>, context?: ContentContext): string;
//# sourceMappingURL=functions.d.ts.map