import { URLFetcher } from './urls.js';
export type SourceInput = {
    guess: string | Buffer | URL;
} | {
    filename: string;
} | {
    url: string;
} | {
    fileObj: NodeJS.ReadableStream | Buffer;
} | {
    string: string | Buffer;
};
export interface ResolvedSource {
    buffer: Buffer;
    baseUrl: string;
    mimeType: string;
}
export declare function selectSource(input: string | Buffer | URL | SourceInput, opts?: {
    baseUrl?: string | null;
    fetcher?: URLFetcher;
}): Promise<ResolvedSource>;
export declare function defaultBaseUrl(): string;
//# sourceMappingURL=source.d.ts.map