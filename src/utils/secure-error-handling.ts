/**
 * Secure error handling utilities.
 * 
 * Prevents information disclosure through error messages by:
 * 1. Sanitizing error messages before displaying to users
 * 2. Categorizing errors for appropriate user feedback
 * 3. Logging detailed errors internally without exposing details
 * 4. Providing user-friendly error messages
 */

import { errorLogger } from '@/lib/logger';
import type { LogOperation, LogEntity } from '@/lib/logger';
import { detectRateLimitFromError, handleRateLimitError } from './rate-limiting';
import { sanitizeInput } from './validation';

// ─── Error Categories ────────────────────────────────────────────

export const ErrorCategory = {
  // Authentication & Authorization
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  
  // Input Validation
  VALIDATION: 'validation',
  
  // Business Logic
  BUSINESS_LOGIC: 'business_logic',
  
  // Resource State
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  LOCKED: 'locked',
  
  // Rate Limiting
  RATE_LIMIT: 'rate_limit',
  
  // Network & Server
  NETWORK: 'network',
  SERVER: 'server',
  
  // Unknown
  UNKNOWN: 'unknown',
} as const;

export type ErrorCategory = typeof ErrorCategory[keyof typeof ErrorCategory];

// ─── Sensitive Information Patterns ──────────────────────────────

/** Patterns that indicate sensitive information in error messages */
const SENSITIVE_PATTERNS = [
  // Database/SQL information
  /sql/i,
  /database/i,
  /table/i,
  /column/i,
  /constraint/i,
  /foreign key/i,
  /primary key/i,
  /pg_/i,
  
  // Server/Infrastructure details
  /server/i,
  /host/i,
  /port/i,
  /endpoint/i,
  /api key/i,
  /secret/i,
  /token/i,
  /password/i,
  
  // File system paths
  /\/home\//i,
  /\/root\//i,
  /\/etc\//i,
  /\.env/i,
  /\.git/i,
  
  // Stack trace indicators
  /at\s+.*\(.*\)/,
  /:\d+:\d+/,
  /\s+in\s+/,
  
  // Internal error codes
  /PGRST/i,
  /JWT/i,
  /OAuth/i,
];

/** Error messages that should be completely hidden from users */
const HIDDEN_ERRORS = [
  'database connection failed',
  'internal server error',
  'unexpected error',
  'null value',
  'undefined',
];

// ─── Error Sanitization ──────────────────────────────────────────

/**
 * Check if error message contains sensitive information.
 */
export function containsSensitiveInfo(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Check for hidden errors
  for (const hiddenError of HIDDEN_ERRORS) {
    if (lowerMessage.includes(hiddenError.toLowerCase())) {
      return true;
    }
  }
  
  // Check for sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }
  
  // Check for potential stack traces
  if (message.includes('\n') && (message.includes('at ') || message.includes('Error:'))) {
    return true;
  }
  
  return false;
}

/**
 * Sanitize error message to prevent information disclosure.
 * Returns safe message for user display and logs the original internally.
 */
export function sanitizeErrorMessage(
  error: unknown,
  context: string = 'unknown'
): { userMessage: string; internalMessage: string; category: ErrorCategory } {
  // Convert error to string message
  let originalMessage = 'Unknown error';
  let stack: string | undefined;
  
  if (typeof error === 'string') {
    originalMessage = error;
  } else if (error instanceof Error) {
    originalMessage = error.message;
    stack = error.stack;
  } else if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    originalMessage = String(err.message || err.error || 'Unknown error');
  }
  
  // Check for rate limiting first
  const rateLimitInfo = detectRateLimitFromError(error);
  if (rateLimitInfo.isRateLimited) {
    const userMessage = handleRateLimitError(error, context);
    return {
      userMessage,
      internalMessage: `Rate limit exceeded: ${originalMessage}`,
      category: ErrorCategory.RATE_LIMIT,
    };
  }
  
  // Check if message contains sensitive information
  const hasSensitiveInfo = containsSensitiveInfo(originalMessage);
  
  // Categorize error
  const category = categorizeError(originalMessage, error);
  
  // Generate user-friendly message based on category
  let userMessage: string;
  
  if (hasSensitiveInfo) {
    // Hide sensitive errors completely
    userMessage = getUserFriendlyMessage(category, context);
  } else {
    // Use sanitized version of original message
    const sanitized = sanitizeInput(originalMessage, 200);
    userMessage = getUserFriendlyMessage(category, context, sanitized);
  }
  
  // Log the error internally (with full details)
  logErrorInternally(originalMessage, stack, category, context, hasSensitiveInfo);
  
  return {
    userMessage,
    internalMessage: originalMessage,
    category,
  };
}

/**
 * Categorize error based on message content and structure.
 */
function categorizeError(message: string, originalError: unknown): ErrorCategory {
  const lowerMessage = message.toLowerCase();
  
  // Check Supabase error codes
  if (originalError && typeof originalError === 'object') {
    const err = originalError as Record<string, unknown>;
    const code = String(err.code || '').toLowerCase();
    
    if (code.includes('auth') || code.includes('jwt')) {
      return ErrorCategory.AUTHENTICATION;
    } else if (code.includes('permission') || code.includes('denied')) {
      return ErrorCategory.AUTHORIZATION;
    } else if (code.includes('constraint') || code.includes('unique')) {
      return ErrorCategory.CONFLICT;
    } else if (code.includes('null') || code.includes('missing')) {
      return ErrorCategory.VALIDATION;
    }
  }
  
  // Check message content
  if (lowerMessage.includes('not found') || lowerMessage.includes('does not exist')) {
    return ErrorCategory.NOT_FOUND;
  } else if (lowerMessage.includes('already exists') || lowerMessage.includes('duplicate')) {
    return ErrorCategory.CONFLICT;
  } else if (lowerMessage.includes('locked') || lowerMessage.includes('expired')) {
    return ErrorCategory.LOCKED;
  } else if (lowerMessage.includes('invalid') || lowerMessage.includes('validation')) {
    return ErrorCategory.VALIDATION;
  } else if (lowerMessage.includes('auth') || lowerMessage.includes('login') || lowerMessage.includes('password')) {
    return ErrorCategory.AUTHENTICATION;
  } else if (lowerMessage.includes('permission') || lowerMessage.includes('access denied')) {
    return ErrorCategory.AUTHORIZATION;
  } else if (lowerMessage.includes('network') || lowerMessage.includes('timeout') || lowerMessage.includes('offline')) {
    return ErrorCategory.NETWORK;
  } else if (lowerMessage.includes('server') || lowerMessage.includes('internal')) {
    return ErrorCategory.SERVER;
  } else if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
    return ErrorCategory.RATE_LIMIT;
  }
  
  return ErrorCategory.UNKNOWN;
}

/**
 * Get user-friendly error message based on category.
 */
function getUserFriendlyMessage(
  category: ErrorCategory,
  context: string,
  originalMessage?: string
): string {
  const contextMap: Record<string, string> = {
    predictions: 'pronóstico',
    authentication: 'autenticación',
    profile: 'perfil',
    matches: 'partido',
    leaderboard: 'leaderboard',
  };
  
  const contextName = contextMap[context] || context;
  
  switch (category) {
    case ErrorCategory.AUTHENTICATION:
      return 'Error de autenticación. Verifica tus credenciales.';
    
    case ErrorCategory.AUTHORIZATION:
      return 'No tienes permiso para realizar esta acción.';
    
    case ErrorCategory.VALIDATION:
      if (originalMessage && originalMessage.length < 100) {
        return originalMessage;
      }
      return `Datos inválidos para ${contextName}.`;
    
    case ErrorCategory.NOT_FOUND:
      return `${contextName.charAt(0).toUpperCase() + contextName.slice(1)} no encontrado.`;
    
    case ErrorCategory.CONFLICT:
      return `El ${contextName} ya existe o está en conflicto.`;
    
    case ErrorCategory.LOCKED:
      return `El ${contextName} está bloqueado o ha expirado.`;
    
    case ErrorCategory.BUSINESS_LOGIC:
      if (originalMessage && originalMessage.length < 100) {
        return originalMessage;
      }
      return `No se puede completar la acción para ${contextName}.`;
    
    case ErrorCategory.NETWORK:
      return 'Error de conexión. Verifica tu conexión a internet.';
    
    case ErrorCategory.SERVER:
      return 'Error temporal del servidor. Intenta nuevamente en unos momentos.';
    
    case ErrorCategory.RATE_LIMIT:
      return 'Demasiadas solicitudes. Espera un momento antes de intentar nuevamente.';
    
    case ErrorCategory.UNKNOWN:
    default:
      return 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}

/**
 * Log error internally without exposing details to users.
 */
function logErrorInternally(
  message: string,
  stack: string | undefined,
  category: ErrorCategory,
  context: string,
  hasSensitiveInfo: boolean
): void {
  // Helper to map context string to LogEntity
  const mapContextToEntity = (ctx: string): LogEntity => {
    if (ctx.includes('auth') || ctx.includes('sign') || ctx.includes('login') || ctx.includes('logout')) {
      return 'auth';
    } else if (ctx.includes('match') || ctx.includes('fixture')) {
      return 'matches';
    } else if (ctx.includes('predict') || ctx.includes('bet')) {
      return 'predictions';
    } else if (ctx.includes('leader') || ctx.includes('score')) {
      return 'leaderboard';
    } else if (ctx.includes('profile') || ctx.includes('user')) {
      return 'profile';
    }
    return 'global';
  };

  const logPayload = {
    operation: 'ERROR' as LogOperation,
    entity: mapContextToEntity(context),
    message: `[${category}] ${message}`,
    metadata: {
      category,
      context,
      hasSensitiveInfo,
      stack: hasSensitiveInfo ? 'REDACTED' : stack?.slice(0, 500),
      timestamp: new Date().toISOString(),
    },
  };
  
  if (category === ErrorCategory.SERVER || category === ErrorCategory.UNKNOWN) {
    errorLogger.error(logPayload);
  } else if (category === ErrorCategory.RATE_LIMIT || category === ErrorCategory.NETWORK) {
    errorLogger.warn(logPayload);
  } else {
    errorLogger.info(logPayload);
  }
}

// ─── Safe Error Handling Wrappers ────────────────────────────────

/**
 * Wrap an async function with secure error handling.
 * Returns user-friendly error messages and logs internally.
 */
export async function withSecureErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const { userMessage } = sanitizeErrorMessage(error, context);
    return { success: false, error: userMessage };
  }
}

/**
 * Wrap a sync function with secure error handling.
 */
export function withSecureErrorHandlingSync<T>(
  fn: () => T,
  context: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    const { userMessage } = sanitizeErrorMessage(error, context);
    return { success: false, error: userMessage };
  }
}

// ─── React Hook for Secure Error Handling ────────────────────────

import { useState, useCallback } from 'react';

interface UseSecureErrorHandlingReturn {
  error: string | null;
  clearError: () => void;
  handleError: (error: unknown, context: string) => string;
  wrapAsync: <T>(
    fn: () => Promise<T>,
    context: string
  ) => Promise<{ success: true; data: T } | { success: false; error: string }>;
}

/**
 * React hook for secure error handling in components.
 */
export function useSecureErrorHandling(): UseSecureErrorHandlingReturn {
  const [error, setError] = useState<string | null>(null);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const handleError = useCallback((error: unknown, context: string): string => {
    const { userMessage } = sanitizeErrorMessage(error, context);
    setError(userMessage);
    return userMessage;
  }, []);
  
  const wrapAsync = useCallback(async <T,>(
    fn: () => Promise<T>,
    context: string
  ): Promise<{ success: true; data: T } | { success: false; error: string }> => {
    try {
      const data = await fn();
      setError(null);
      return { success: true, data };
    } catch (err) {
      const userMessage = handleError(err, context);
      return { success: false, error: userMessage };
    }
  }, [handleError]);
  
  return {
    error,
    clearError,
    handleError,
    wrapAsync,
  };
}

// ─── Global Error Handler ────────────────────────────────────────

/**
 * Global error handler for uncaught errors.
 */
export function setupGlobalErrorHandler(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    
    const { userMessage } = sanitizeErrorMessage(event.reason, 'global');
    
    // Log internally
    errorLogger.error({
      operation: 'ERROR' as LogOperation,
      entity: 'global' as LogEntity,
      message: 'Unhandled promise rejection',
      metadata: {
        reason: String(event.reason),
        userMessage,
      },
    });
    
    // Show user-friendly message (could use toast/notification system)
    console.error('Error no controlado:', userMessage);
  });
  
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    event.preventDefault();
    
    const { userMessage } = sanitizeErrorMessage(event.error, 'global');
    
    errorLogger.error({
      operation: 'ERROR' as LogOperation,
      entity: 'global' as LogEntity,
      message: 'Uncaught error',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        userMessage,
      },
    });
    
    console.error('Error no capturado:', userMessage);
  });
}