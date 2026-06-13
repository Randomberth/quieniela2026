export type LogLevel = 'error' | 'warning' | 'info'
export type LogOperation = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'AUTH' | 'RATE_LIMIT' | 'ERROR'
export type LogEntity = 'auth' | 'matches' | 'predictions' | 'leaderboard' | 'profile' | 'global'

export interface ErrorLog {
  id: string
  timestamp: string
  level: LogLevel
  operation: LogOperation
  entity: LogEntity
  statusCode?: number
  message: string
  stack?: string
  userId?: string
  metadata?: Record<string, unknown>
  resolved: boolean
}

type LogInput = Omit<ErrorLog, 'id' | 'timestamp' | 'resolved'>

const STORAGE_KEY = 'quiniela_error_logs'
const MAX_LOGS = 100

/**
 * Sentry-compatible breadcrumb. Attached to error logs for
 * easy correlation when Sentry SDK is added later.
 */
export interface SentryBreadcrumb {
  type: 'error' | 'navigation' | 'http';
  category: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
  level: 'error' | 'warning' | 'info';
}

class ErrorLogger {
  private logs: ErrorLog[] = []
  private breadcrumbs: SentryBreadcrumb[] = []

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        this.logs = JSON.parse(stored)
      }
    } catch {
      this.logs = []
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs))
    } catch {
      console.warn('[LOGGER] No se pudo guardar en localStorage')
    }
  }

  private purgeOldLogs() {
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS)
    }
  }

  /**
   * Add a Sentry-compatible breadcrumb for error context.
   * When Sentry SDK is configured, feed these via Sentry.addBreadcrumb().
   */
  addBreadcrumb(breadcrumb: Omit<SentryBreadcrumb, 'timestamp'>) {
    const full: SentryBreadcrumb = {
      ...breadcrumb,
      timestamp: Date.now(),
    }
    this.breadcrumbs.push(full)
    // Keep only last 50 breadcrumbs
    if (this.breadcrumbs.length > 50) {
      this.breadcrumbs = this.breadcrumbs.slice(-50)
    }
  }

  getBreadcrumbs(): SentryBreadcrumb[] {
    return [...this.breadcrumbs]
  }

  private consoleLog(log: ErrorLog) {
    const prefix = `[${log.level.toUpperCase()}] ${log.entity}.${log.operation}`
    const data = {
      timestamp: log.timestamp,
      statusCode: log.statusCode,
      message: log.message,
      userId: log.userId,
      logId: log.id,
      metadata: log.metadata,
    }

    switch (log.level) {
      case 'error':
        console.error(prefix, data)
        this.addBreadcrumb({
          type: 'error',
          category: `${log.entity}.${log.operation}`,
          message: log.message,
          data: {
            statusCode: log.statusCode,
            userId: log.userId,
            logId: log.id,
          },
          level: 'error',
        })
        break
      case 'warning':
        console.warn(prefix, data)
        this.addBreadcrumb({
          type: 'error',
          category: `${log.entity}.${log.operation}`,
          message: log.message,
          data: { logId: log.id },
          level: 'warning',
        })
        break
      case 'info':
        console.info(prefix, data)
        break
    }
  }

  private add(input: LogInput) {
    const log: ErrorLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      resolved: false,
      ...input,
    }

    this.logs.unshift(log)
    this.purgeOldLogs()
    this.saveToStorage()
    this.consoleLog(log)
  }

  error(input: Omit<LogInput, 'level'>) {
    this.add({ ...input, level: 'error' })
  }

  warn(input: Omit<LogInput, 'level'>) {
    this.add({ ...input, level: 'warning' })
  }

  info(input: Omit<LogInput, 'level'>) {
    this.add({ ...input, level: 'info' })
  }

  /**
   * Sentry-compatible exception capture.
   * Feed into Sentry.captureException() when Sentry is integrated.
   */
  captureException(error: Error, context?: Record<string, unknown>) {
    const log: LogInput = {
      level: 'error',
      operation: 'READ',
      entity: 'matches',
      message: error.message,
      stack: error.stack,
      metadata: {
        ...context,
        breadcrumbs: this.getBreadcrumbs(),
        cause: (error as Error & { cause?: unknown }).cause,
      },
    }
    this.add(log)
  }

  /**
   * Get logs in a Sentry-compatible format for bulk attachment
   */
  getSentryCompatibleLogs() {
    return this.logs.filter(l => l.level === 'error').map(log => ({
      message: log.message,
      timestamp: log.timestamp,
      level: log.level,
      fingerprint: [log.entity, log.operation, log.statusCode?.toString() || 'unknown'],
      extra: {
        id: log.id,
        userId: log.userId,
        metadata: log.metadata,
        breadcrumbs: this.breadcrumbs.filter(b => b.level === 'error'),
      },
    }))
  }

  getLogs(): ErrorLog[] {
    return [...this.logs]
  }

  getErrors(): ErrorLog[] {
    return this.logs.filter(l => l.level === 'error')
  }

  getWarnings(): ErrorLog[] {
    return this.logs.filter(l => l.level === 'warning')
  }

  clearLogs() {
    this.logs = []
    this.breadcrumbs = []
    this.saveToStorage()
    console.info('[LOGGER] Logs limpiados')
  }

  exportToJSON(): string {
    return JSON.stringify({
      logs: this.logs,
      breadcrumbs: this.breadcrumbs,
      exportedAt: new Date().toISOString(),
    }, null, 2)
  }
}

export const errorLogger = new ErrorLogger()
