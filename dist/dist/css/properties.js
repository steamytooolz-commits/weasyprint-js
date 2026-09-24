// CSS properties table — mirrors weasyprint/css/properties.py (subset).
// Full validation lives in validation/*; this is the inheritable + initial
// value registry used by the cascade.
export const PROPERTIES = {
    'color': { initial: 'black', inherited: true },
    'font-family': { initial: 'sans-serif', inherited: true },
    'font-size': { initial: 'medium', inherited: true },
    'font-style': { initial: 'normal', inherited: true },
    'font-weight': { initial: 'normal', inherited: true },
    'line-height': { initial: 'normal', inherited: true },
    'text-align': { initial: 'start', inherited: true },
    'text-transform': { initial: 'none', inherited: true },
    'white-space': { initial: 'normal', inherited: true },
    'letter-spacing': { initial: 'normal', inherited: true },
    'word-spacing': { initial: 'normal', inherited: true },
    'direction': { initial: 'ltr', inherited: true },
    'visibility': { initial: 'visible', inherited: true },
    'orphans': { initial: '2', inherited: true },
    'widows': { initial: '2', inherited: true },
    'background-color': { initial: 'transparent', inherited: false },
    'display': { initial: 'inline', inherited: false },
    'position': { initial: 'static', inherited: false },
    'float': { initial: 'none', inherited: false },
    'clear': { initial: 'none', inherited: false },
    'width': { initial: 'auto', inherited: false },
    'height': { initial: 'auto', inherited: false },
    'margin-top': { initial: '0', inherited: false },
    'margin-right': { initial: '0', inherited: false },
    'margin-bottom': { initial: '0', inherited: false },
    'margin-left': { initial: '0', inherited: false },
    'padding-top': { initial: '0', inherited: false },
    'padding-right': { initial: '0', inherited: false },
    'padding-bottom': { initial: '0', inherited: false },
    'padding-left': { initial: '0', inherited: false },
    'border-top-width': { initial: 'medium', inherited: false },
    'border-top-style': { initial: 'none', inherited: false },
    'border-top-color': { initial: 'currentcolor', inherited: false },
    'page-break-before': { initial: 'auto', inherited: false },
    'page-break-after': { initial: 'auto', inherited: false },
    'page-break-inside': { initial: 'auto', inherited: false },
};
export function isInherited(prop) {
    return PROPERTIES[prop]?.inherited ?? false;
}
export function initialValue(prop) {
    return PROPERTIES[prop]?.initial ?? '';
}
//# sourceMappingURL=properties.js.map