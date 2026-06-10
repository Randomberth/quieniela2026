type LogLevel = 'error' | 'warning' | 'info'
type LogOperation = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'AUTH'
type LogEntity = 'auth' | 'matches' | 'predictions' | 'leaderboard' | 'profile'

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

class ErrorLogger {
  private logs: ErrorLog[] = []

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
        break
      case 'warning':
        console.warn(prefix, data)
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
    this.saveToStorage()
    console.info('[LOGGER] Logs limpiados')
  }

  exportToJSON(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

export const errorLogger = new ErrorLogger()