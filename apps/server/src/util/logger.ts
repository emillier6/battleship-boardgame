export const logger = {
  info: (...args: unknown[]) => console.log('[info]', ...args),
  warn: (...args: unknown[]) => console.warn('[warn]', ...args),
  error: (...args: unknown[]) => console.error('[error]', ...args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) console.log('[debug]', ...args);
  },
};
