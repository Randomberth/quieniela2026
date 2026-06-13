/**
 * Rate limiting awareness and client-side rate limiting utilities.
 * 
 * Provides:
 * 1. Rate limit detection from API responses
 * 2. Client-side request throttling
 * 3. User-friendly rate limit error messages
 * 4. Retry logic with exponential backoff
 */

import { errorLogger } from '@/lib/logger';
import type { LogEntity } from '@/lib/logger';

// ─── Constants ───────────────────────────────────────────────────

/** Default rate limit configuration */
export const RATE_LIMIT_CONFIG = {
  // Prediction submissions per minute
  PREDICTION_SUBMISSIONS: {
    limit: 30,
    windowMs: 60 * 1000, // 1 minute
  },
  // Authentication attempts per hour
  AUTH_ATTEMPTS: {
    limit: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // General API requests per minute
  API_REQUESTS: {
    limit: 60,
    windowMs: 60 * 1000, // 1 minute
  },
};

/** Known rate limit error codes from Supabase/APIs */
export const RATE_LIMIT_ERROR_CODES = [
  '429', // HTTP 429 Too Many Requests
  'RATE_LIMIT_EXCEEDED',
  'TOO_MANY_REQUESTS',
  'QUOTA_EXCEEDED',
  'RATE_LIMIT',
];

/** Rate limit headers commonly returned by APIs */
export const RATE_LIMIT_HEADERS = {
  RETRY_AFTER: 'retry-after',
  RATE_LIMIT_LIMIT: 'x-ratelimit-limit',
  RATE_LIMIT_REMAINING: 'x-ratelimit-remaining',
  RATE_LIMIT_RESET: 'x-ratelimit-reset',
};

// ─── Rate Limit Detection ────────────────────────────────────────

interface RateLimitInfo {
  isRateLimited: boolean;
  retryAfter?: number; // seconds
  limit?: number;
  remaining?: number;
  reset?: number; // timestamp
  scope?: string;
}

/**
 * Detect rate limiting from API error response.
 */
export function detectRateLimitFromError(error: unknown): RateLimitInfo {
  const defaultResult: RateLimitInfo = { isRateLimited: false };
  
  if (!error) return defaultResult;
  
  // Check Supabase error
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    
    // Check status code
    if (err.status === 429) {
      return {
        isRateLimited: true,
        retryAfter: parseRetryAfter(err),
        scope: 'global',
      };
    }
    
    // Check error code/message
    const message = String(err.message || '').toLowerCase();
    const code = String(err.code || '').toLowerCase();
    
    for (const rateLimitCode of RATE_LIMIT_ERROR_CODES) {
      if (message.includes(rateLimitCode.toLowerCase()) || code.includes(rateLimitCode.toLowerCase())) {
        return {
          isRateLimited: true,
          retryAfter: parseRetryAfter(err),
          scope: extractScopeFromError(err),
        };
      }
    }
  }
  
  return defaultResult;
}

/**
 * Parse Retry-After header from error.
 * Returns seconds to wait, or undefined if not found.
 */
function parseRetryAfter(error: Record<string, unknown>): number | undefined {
  if (error.headers && typeof error.headers === 'object') {
    const headers = error.headers as Record<string, string>;
    const retryAfter = headers[RATE_LIMIT_HEADERS.RETRY_AFTER] || headers['Retry-After'];
    
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds) && seconds > 0) {
        return seconds;
      }
    }
  }
  
  // Default retry delay if not specified
  return 60; // 1 minute
}

/**
 * Extract rate limit scope from error.
 */
function extractScopeFromError(error: Record<string, unknown>): string {
  const message = String(error.message || '');
  
  if (message.includes('prediction') || message.includes('submit')) {
    return 'predictions';
  } else if (message.includes('auth') || message.includes('login') || message.includes('sign')) {
    return 'authentication';
  } else if (message.includes('leaderboard')) {
    return 'leaderboard';
  }
  
  return 'api';
}

// ─── Client-Side Rate Limiting ──────────────────────────────────

interface RequestRecord {
  timestamp: number;
  count: number;
}

class ClientRateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  
  /**
   * Check if a request is allowed based on client-side limits.
   */
  isAllowed(
    key: string,
    limit: number,
    windowMs: number
  ): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create request history for this key
    let history = this.requests.get(key) || [];
    
    // Filter out old requests outside the window
    history = history.filter(record => record.timestamp > windowStart);
    
    // Check if under limit
    if (history.length >= limit && history[0]) {
      // Calculate when the oldest request will expire
      const oldestRequest = history[0];
      const retryAfter = Math.ceil((oldestRequest.timestamp + windowMs - now) / 1000);
      
      return { allowed: false, retryAfter };
    }
    
    // Add new request
    history.push({ timestamp: now, count: 1 });
    this.requests.set(key, history);
    
    // Clean up old entries periodically
    this.cleanup();
    
    return { allowed: true };
  }
  
  /**
   * Clean up old request records.
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, history] of this.requests.entries()) {
      const filtered = history.filter(record => now - record.timestamp < maxAge);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }
}

// Global client-side rate limiter instance
export const clientRateLimiter = new ClientRateLimiter();

/**
 * Check client-side rate limit for predictions.
 */
export function checkPredictionRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const { limit, windowMs } = RATE_LIMIT_CONFIG.PREDICTION_SUBMISSIONS;
  const key = `predictions:${userId}`;
  
  return clientRateLimiter.isAllowed(key, limit, windowMs);
}

/**
 * Check client-side rate limit for authentication.
 */
export function checkAuthRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const { limit, windowMs } = RATE_LIMIT_CONFIG.AUTH_ATTEMPTS;
  const key = `auth:${identifier}`;
  
  return clientRateLimiter.isAllowed(key, limit, windowMs);
}

// ─── User-Friendly Error Messages ────────────────────────────────

/**
 * Generate user-friendly rate limit error message.
 */
export function getRateLimitErrorMessage(
  info: RateLimitInfo,
  operation: string
): string {
  const operationNames: Record<string, string> = {
    predictions: 'envío de pronósticos',
    authentication: 'intentos de autenticación',
    leaderboard: 'consultas del leaderboard',
    api: 'solicitudes',
    global: 'solicitudes',
  };
  
  const opName = operationNames[info.scope || 'api'] || operation;
  
  if (info.retryAfter) {
    if (info.retryAfter < 60) {
      return `Demasiadas ${opName}. Intenta nuevamente en ${info.retryAfter} segundos.`;
    } else if (info.retryAfter < 3600) {
      const minutes = Math.ceil(info.retryAfter / 60);
      return `Demasiadas ${opName}. Intenta nuevamente en ${minutes} minuto${minutes > 1 ? 's' : ''}.`;
    } else {
      const hours = Math.ceil(info.retryAfter / 3600);
      return `Demasiadas ${opName}. Intenta nuevamente en ${hours} hora${hours > 1 ? 's' : ''}.`;
    }
  }
  
  return `Demasiadas ${opName}. Por favor, espera un momento antes de intentar nuevamente.`;
}

/**
 * Handle rate limit error in UI components.
 * Returns user-friendly message and logs the event.
 */
export function handleRateLimitError(
  error: unknown,
  operation: string,
  context: Record<string, unknown> = {}
): string {
  const rateLimitInfo = detectRateLimitFromError(error);
  
  // Map operation string to a valid LogEntity
  const mapOperationToEntity = (op: string): LogEntity => {
    if (op.includes('auth') || op.includes('sign') || op.includes('login') || op.includes('logout')) {
      return 'auth';
    } else if (op.includes('match') || op.includes('fixture')) {
      return 'matches';
    } else if (op.includes('predict') || op.includes('bet')) {
      return 'predictions';
    } else if (op.includes('leader') || op.includes('score')) {
      return 'leaderboard';
    } else if (op.includes('profile') || op.includes('user')) {
      return 'profile';
    }
    return 'global';
  };

  if (rateLimitInfo.isRateLimited) {
    const message = getRateLimitErrorMessage(rateLimitInfo, operation);
    const entity = mapOperationToEntity(operation);
    
    // Log rate limit event
    errorLogger.warn({
      operation: 'RATE_LIMIT',
      entity,
      message: 'Rate limit exceeded',
      metadata: {
        ...rateLimitInfo,
        ...context,
        userMessage: message,
      },
    });
    
    return message;
  }
  
  // Not a rate limit error
  return '';
}

// ─── Exponential Backoff Retry ───────────────────────────────────

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

/**
 * Execute a function with exponential backoff retry for rate limits.
 */
export async function withRetryOnRateLimit<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000, // 1 second
    maxDelay = 30000, // 30 seconds
    backoffFactor = 2,
  } = options;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const rateLimitInfo = detectRateLimitFromError(error);
      
      if (!rateLimitInfo.isRateLimited || attempt === maxRetries) {
        // Not a rate limit error, or max retries reached
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const baseDelay = rateLimitInfo.retryAfter 
        ? rateLimitInfo.retryAfter * 1000 
        : initialDelay * Math.pow(backoffFactor, attempt);
      
      const delay = Math.min(baseDelay, maxDelay);
      
      console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// ─── React Hook for Rate Limit Awareness ─────────────────────────

import { useState, useCallback, useEffect } from 'react';

interface UseRateLimitReturn {
  isRateLimited: boolean;
  retryAfter?: number;
  checkRateLimit: (error: unknown, operation: string) => string;
  clearRateLimit: () => void;
}

/**
 * React hook for rate limit awareness in components.
 */
export function useRateLimit(initialState = false): UseRateLimitReturn {
  const [isRateLimited, setIsRateLimited] = useState(initialState);
  const [retryAfter, setRetryAfter] = useState<number>();
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout>>();
  
  const checkRateLimit = useCallback((error: unknown, operation: string): string => {
    const rateLimitInfo = detectRateLimitFromError(error);
    
    if (rateLimitInfo.isRateLimited) {
      setIsRateLimited(true);
      setRetryAfter(rateLimitInfo.retryAfter);
      
      // Clear rate limit after retry period
      if (timer) clearTimeout(timer);
      
      if (rateLimitInfo.retryAfter) {
        const newTimer = setTimeout(() => {
          setIsRateLimited(false);
          setRetryAfter(undefined);
        }, rateLimitInfo.retryAfter * 1000);
        
        setTimer(newTimer);
      }
      
      return getRateLimitErrorMessage(rateLimitInfo, operation);
    }
    
    return '';
  }, [timer]);
  
  const clearRateLimit = useCallback(() => {
    setIsRateLimited(false);
    setRetryAfter(undefined);
    if (timer) {
      clearTimeout(timer);
      setTimer(undefined);
    }
  }, [timer]);
  
  useEffect(() => {
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [timer]);
  
  return {
    isRateLimited,
    retryAfter,
    checkRateLimit,
    clearRateLimit,
  };
}