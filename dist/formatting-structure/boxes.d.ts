import type { ElementRef, CascadeEntry } from '../css/types.js';
import type { CascadeResult } from '../css/cascade.js';
export type BoxType = 'block' | 'inline' | 'text' | 'table' | 'table-row' | 'table-cell' | 'list-item';
export interface Box {
    uid: number;
    type: BoxType;
    tag: string;
    text: string | null;
    children: Box[];
    style: Record<string, string>;
    attrs: Record<string, string>;
    /** Resolved raster image (attached in HTML.render after style cascade). */
    image?: {
        buffer: Buffer;
        mime: string;
        wPx: number;
        hPx: number;
    } | null;
    /** Resolved CSS background image (fetched in HTML.render). */
    bgImage?: {
        buffer: Buffer;
        mime: string;
        wPx: number;
        hPx: number;
    } | null;
    /** Snapshot list-marker for <li> (value from list-item counter). */
    listMarker?: {
        value: number;
        type: string;
    } | null;
    /** Computed ::before/::after styles (content resolved in counter walk). */
    pseudoBefore?: Record<string, string> | null;
    pseudoAfter?: Record<string, string> | null;
}
export interface BuiltTree {
    elements: ElementRef[];
    root: Box;
    byUid: Map<number, ElementRef>;
}
export declare function buildTree(html: string): BuiltTree;
/** Attach computed styles to every box (mutates in place). */
export declare function attachStyles(root: Box, elements: ElementRef[], matched: Map<number, Map<string, CascadeEntry>>, pseudos?: CascadeResult['pseudos']): void;
/**
 * Counter assignment + ::before/::after generation (document order walk).
 * Mirrors the counter/content side of formatting_structure/build.py.
 */
export declare function resolveCountersAndGenerated(root: Box): void;
/** Remove display:none subtrees (and display:none generated boxes). */
export declare function pruneDisplayNone(root: Box): Box | null;
//# sourceMappingURL=boxes.d.ts.map