// Logger — mirrors weasyprint/logger.py
// Python uses `logging.getLogger('weasyprint')` + PROGRESS_LOGGER.
// Here we provide a tiny leveled logger with the same channel names.
let level = 'warn';
const order = ['debug', 'info', 'warn', 'error'];
function shouldLog(l) {
    return order.indexOf(l) >= order.indexOf(level);
}
function emit(l, channel, ...args) {
    if (!shouldLog(l))
        return;
    const prefix = l === 'debug' ? 'DEBUG' : l === 'info' ? 'INFO' : l === 'warn' ? 'WARNING' : 'ERROR';
    // eslint-disable-next-line no-console
    console.error(`${prefix}: ${channel} ${args.map(String).join(' ')}`);
}
export const LOGGER = {
    get level() { return level; },
    setLevel(l) { level = l; },
    debug: (...a) => emit('debug', 'weasyprint', ...a),
    info: (...a) => emit('info', 'weasyprint', ...a),
    warning: (...a) => emit('warn', 'weasyprint', ...a),
    warn: (...a) => emit('warn', 'weasyprint', ...a),
    error: (...a) => emit('error', 'weasyprint', ...a),
};
export const PROGRESS_LOGGER = {
    info: (...a) => emit('info', 'weasyprint.progress', ...a),
};
//# sourceMappingURL=logger.js.map