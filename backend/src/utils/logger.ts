const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (...args: any[]) => { if (isDevelopment) console.log(...args); },
  debug: (...args: any[]) => { if (isDevelopment) console.debug(...args); },
  warn: (...args: any[]) => { console.warn(...args); },
  error: (...args: any[]) => { console.error(...args); },
};
