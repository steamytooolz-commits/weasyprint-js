// Logger — mirrors weasyprint/logger.py
// Python uses `logging.getLogger('weasyprint')` + PROGRESS_LOGGER.
// Here we provide a tiny leveled logger with the same channel names.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let level: LogLevel = 'warn';
const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];

function shouldLog(l: LogLevel): boolean {
  return order.indexOf(l) >= order.indexOf(level);
}

function emit(l: LogLevel, channel: string, ...args: unknown[]): void {
  if (!shouldLog(l)) return;
  const prefix = l === 'debug' ? 'DEBUG' : l === 'info' ? 'INFO' : l === 'warn' ? 'WARNING' : 'ERROR';
  // eslint-disable-next-line no-console
  console.error(`${prefix}: ${channel} ${args.map(String).join(' ')}`);
}

export const LOGGER = {
  get level() { return level; },
  setLevel(l: LogLevel) { level = l; },
  debug: (...a: unknown[]) => emit('debug', 'weasyprint', ...a),
  info: (...a: unknown[]) => emit('info', 'weasyprint', ...a),
  warning: (...a: unknown[]) => emit('warn', 'weasyprint', ...a),
  warn: (...a: unknown[]) => emit('warn', 'weasyprint', ...a),
  error: (...a: unknown[]) => emit('error', 'weasyprint', ...a),
};

export const PROGRESS_LOGGER = {
  info: (...a: unknown[]) => emit('info', 'weasyprint.progress', ...a),
};
