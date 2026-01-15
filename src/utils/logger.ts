/**
 * Centralized logging utility for the Medical Companion PWA
 *
 * This logger wraps console methods and only outputs in development mode.
 * In production, all logging is disabled to keep the console clean.
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Log general information (only in development)
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log debug information (only in development)
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log warnings (always shown)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Log errors (always shown)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Log info messages (only in development)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Log with a group (only in development)
   */
  group: (label?: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * End a group (only in development)
   */
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },

  /**
   * Log a table (only in development)
   */
  table: (data: any) => {
    if (isDevelopment) {
      console.table(data);
    }
  },

  /**
   * Log timing information (only in development)
   */
  time: (label?: string) => {
    if (isDevelopment) {
      console.time(label);
    }
  },

  /**
   * End timing (only in development)
   */
  timeEnd: (label?: string) => {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  }
};

// Export a development-only assertion helper
export const assert = (condition: any, message?: string): void => {
  if (isDevelopment && !condition) {
    console.error('Assertion failed:', message);
  }
};