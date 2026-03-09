type LogLevel = "debug" | "info" | "warn" | "error"

function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  const output = JSON.stringify(entry)

  switch (level) {
    case "error":
      console.error(output)
      break
    case "warn":
      console.warn(output)
      break
    default:
      console.log(output)
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log("debug", message, context),

  info: (message: string, context?: Record<string, unknown>) =>
    log("info", message, context),

  warn: (message: string, context?: Record<string, unknown>) =>
    log("warn", message, context),

  error: (message: string, err?: unknown, context?: Record<string, unknown>) => {
    const errorContext: Record<string, unknown> = { ...context }
    if (err instanceof Error) {
      errorContext.error = err.message
      errorContext.stack = err.stack
    } else if (err !== undefined) {
      errorContext.error = String(err)
    }
    log("error", message, errorContext)
  },
}
