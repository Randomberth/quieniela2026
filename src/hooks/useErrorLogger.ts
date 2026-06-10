import { useState, useEffect } from 'react'
import { errorLogger } from '@/lib/logger'
import type { ErrorLog } from '@/lib/logger'

export function useErrorLogger() {
  const [logs, setLogs] = useState<ErrorLog[]>([])

  useEffect(() => {
    setLogs(errorLogger.getLogs())

    const handleStorage = () => {
      setLogs(errorLogger.getLogs())
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const refreshLogs = () => {
    setLogs(errorLogger.getLogs())
  }

  const exportLogs = () => {
    const json = errorLogger.exportToJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quiniela-logs-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearLogs = () => {
    errorLogger.clearLogs()
    refreshLogs()
  }

  return {
    logs,
    errors: errorLogger.getErrors(),
    warnings: errorLogger.getWarnings(),
    exportLogs,
    clearLogs,
    refreshLogs,
  }
}