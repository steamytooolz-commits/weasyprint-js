export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare const LOGGER: {
    readonly level: LogLevel;
    setLevel(l: LogLevel): void;
    debug: (...a: unknown[]) => void;
    info: (...a: unknown[]) => void;
    warning: (...a: unknown[]) => void;
    warn: (...a: unknown[]) => void;
    error: (...a: unknown[]) => void;
};
export declare const PROGRESS_LOGGER: {
    info: (...a: unknown[]) => void;
};
//# sourceMappingURL=logger.d.ts.map