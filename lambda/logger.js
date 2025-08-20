const logEvent = (level, message, data = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    requestId: data.requestId || 'unknown',
    ...data
  };
  console.log(JSON.stringify(logEntry));
};

module.exports = {
  info: (message, data) => logEvent('INFO', message, data),
  error: (message, data) => logEvent('ERROR', message, data),
  warn: (message, data) => logEvent('WARN', message, data),
  debug: (message, data) => logEvent('DEBUG', message, data)
};
