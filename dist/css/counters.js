export const DISC_SYMBOL = '•';
export const CIRCLE_SYMBOL = '○';
export const SQUARE_SYMBOL = '▪';
export const KNOWN_COUNTER_STYLES = new Set([
    'decimal', 'decimal-leading-zero', 'lower-roman', 'upper-roman',
    'lower-alpha', 'upper-alpha', 'lower-latin', 'upper-latin',
    'disc', 'circle', 'square', 'none',
]);
/** Format an integer counter value with the given counter style. */
export function formatCounter(value, style) {
    const s = (style ?? 'decimal').trim().toLowerCase() || 'decimal';
    const n = Math.trunc(value);
    switch (s) {
        case 'decimal': return String(n);
        case 'decimal-leading-zero': {
            const sign = n < 0 ? '-' : '';
            return sign + String(Math.abs(n)).padStart(2, '0');
        }
        case 'lower-roman': return toRoman(n, false) ?? String(n);
        case 'upper-roman': return toRoman(n, true) ?? String(n);
        case 'lower-alpha':
        case 'lower-latin': return toAlpha(n, false) ?? String(n);
        case 'upper-alpha':
        case 'upper-latin': return toAlpha(n, true) ?? String(n);
        case 'disc': return DISC_SYMBOL;
        case 'circle': return CIRCLE_SYMBOL;
        case 'square': return SQUARE_SYMBOL;
        case 'none': return '';
        default: return String(n);
    }
}
const ROMAN_TABLE = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];
function toRoman(n, upper) {
    if (!Number.isFinite(n) || n < 1 || n > 3999)
        return null;
    let rest = n;
    let out = '';
    for (const [v, sym] of ROMAN_TABLE) {
        while (rest >= v) {
            out += sym;
            rest -= v;
        }
    }
    return upper ? out.toUpperCase() : out;
}
function toAlpha(n, upper) {
    if (!Number.isFinite(n) || n < 1)
        return null;
    let rest = n;
    let out = '';
    while (rest > 0) {
        rest -= 1;
        out = String.fromCharCode(97 + (rest % 26)) + out;
        rest = Math.floor(rest / 26);
    }
    return upper ? out.toUpperCase() : out;
}
/** Parse `counter-reset` / `counter-increment` value lists. */
export function parseCounterList(value, def) {
    const v = value.trim();
    if (!v)
        return null;
    if (/^none$/i.test(v))
        return [];
    const parts = v.split(/\s+/);
    const out = [];
    let i = 0;
    while (i < parts.length) {
        const name = parts[i];
        if (!/^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(name))
            return null;
        let num = def;
        if (i + 1 < parts.length && /^[+-]?\d+$/.test(parts[i + 1])) {
            num = parseInt(parts[i + 1], 10);
            i += 1;
        }
        out.push({ name: name.toLowerCase(), value: num });
        i += 1;
    }
    return out;
}
/**
 * Tracks CSS counters with element-scoped nesting.
 * `owner` is the element uid that created the scope level; exitElement()
 * pops levels owned by a leaving element so siblings don't leak counters.
 */
export class CounterScopes {
    stacks = new Map();
    owners = new Map();
    reset(name, value = 0, owner = null) {
        const key = name.toLowerCase();
        let stack = this.stacks.get(key);
        let own = this.owners.get(key);
        if (!stack || !own) {
            stack = [];
            own = [];
            this.stacks.set(key, stack);
            this.owners.set(key, own);
        }
        if (own.length > 0 && own[own.length - 1] === owner) {
            stack[stack.length - 1] = value;
        }
        else {
            stack.push(value);
            own.push(owner);
        }
    }
    increment(name, value = 1, owner = null) {
        void owner;
        const key = name.toLowerCase();
        const stack = this.stacks.get(key);
        if (!stack || stack.length === 0) {
            this.stacks.set(key, [value]);
            this.owners.set(key, [null]);
            return;
        }
        stack[stack.length - 1] += value;
    }
    applyReset(value, owner = null) {
        const specs = parseCounterList(value, 0);
        if (specs === null)
            return false;
        for (const s of specs)
            this.reset(s.name, s.value, owner);
        return true;
    }
    applyIncrement(value, owner = null) {
        const specs = parseCounterList(value, 1);
        if (specs === null)
            return false;
        for (const s of specs)
            this.increment(s.name, s.value, owner);
        return true;
    }
    getValue(name) {
        const stack = this.stacks.get(name.toLowerCase());
        if (!stack || stack.length === 0)
            return null;
        return stack[stack.length - 1];
    }
    getStack(name) {
        return [...(this.stacks.get(name.toLowerCase()) ?? [])];
    }
    /** Resolve `counter(name, style?)` — missing counters read as 0. */
    counter(name, style = 'decimal') {
        return formatCounter(this.getValue(name) ?? 0, style);
    }
    /** Resolve `counters(name, sep, style?)` joining every scope level. */
    counters(name, separator = '.', style = 'decimal') {
        const stack = this.stacks.get(name.toLowerCase()) ?? [0];
        const levels = stack.length > 0 ? stack : [0];
        return levels.map((v) => formatCounter(v, style)).join(separator);
    }
    /** Pop scope levels created by `owner` (call when leaving an element). */
    exitElement(owner) {
        for (const [key, own] of this.owners) {
            const stack = this.stacks.get(key);
            while (own.length > 0 && own[own.length - 1] === owner) {
                own.pop();
                stack.pop();
            }
        }
    }
    clear() { this.stacks.clear(); this.owners.clear(); }
}
//# sourceMappingURL=counters.js.map