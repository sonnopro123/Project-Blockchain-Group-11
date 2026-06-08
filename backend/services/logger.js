/**
 * Centralized logging service.
 * Formats log messages and writes them to console and log files.
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const COMBINED_LOG_PATH = path.join(LOGS_DIR, 'combined.log');
const ERROR_LOG_PATH = path.join(LOGS_DIR, 'error.log');

function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Core logging function
 * @param {string} level - 'info' | 'warn' | 'error'
 * @param {string} message - The main log message
 * @param {Error|null} error - Optional error object for stack trace
 */
function writeLog(level, message, error = null) {
  let logStr = `[${getTimestamp()}] [${level.toUpperCase()}] ${message}`;
  if (error) {
    logStr += `\nStack Trace:\n${error.stack || error}`;
  }
  logStr += '\n';

  // Output to console with levels
  if (level === 'error') {
    console.error(logStr.trim());
  } else if (level === 'warn') {
    console.warn(logStr.trim());
  } else {
    console.log(logStr.trim());
  }

  try {
    // Append to combined.log
    fs.appendFileSync(COMBINED_LOG_PATH, logStr, 'utf8');

    // Append to error.log if it is an error level
    if (level === 'error') {
      fs.appendFileSync(ERROR_LOG_PATH, logStr, 'utf8');
    }
  } catch (fsError) {
    console.error(`[LOGGER ERROR] Failed to write log to disk: ${fsError.message}`);
  }
}

module.exports = {
  info: (msg) => writeLog('info', msg),
  warn: (msg) => writeLog('warn', msg),
  error: (msg, err = null) => writeLog('error', msg, err)
};
