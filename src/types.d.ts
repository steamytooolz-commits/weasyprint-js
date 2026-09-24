declare module 'css-tree' {
  export function parse(css: string, options?: unknown): unknown;
  export function walk(ast: unknown, cb: (node: never) => void): void;
  export function generate(node: unknown): string;
}
