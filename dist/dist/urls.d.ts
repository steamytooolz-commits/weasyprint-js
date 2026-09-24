export interface FetcherOptions {
    timeout?: number;
    allowedProtocols?: Set<string> | null;
    allowRedirects?: boolean;
    failOnErrors?: boolean;
}
export declare class URLFetcher {
    timeout: number;
    allowedProtocols: Set<string>;
    allowRedirects: boolean;
    failOnErrors: boolean;
    constructor(opts?: FetcherOptions);
    fetch(url: string): Promise<{
        buffer: Buffer;
        mimeType: string;
        finalUrl: string;
    }>;
}
export declare function guessMime(p: string): string;
/** Resolve a possibly-relative URL against a base URL. */
export declare function resolveUrl(ref: string, baseUrl: string): string;
//# sourceMappingURL=urls.d.ts.map