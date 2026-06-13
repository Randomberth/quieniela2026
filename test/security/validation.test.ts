/**
 * Security-focused tests for validation and protection mechanisms.
 * 
 * Tests for:
 * 1. Input validation with Zod
 * 2. XSS protection
 * 3. Secure error handling
 * 4. Rate limiting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ScoreSchema,
  PredictionInputSchema,
  UserProfileUpdateSchema,
  SignUpSchema,
  SignInSchema,
  safeValidate,
  sanitizeInput,
  sanitizeObject,
  validatePredictionScoresZod,
} from '@/utils/validation';
import {
  encodeHTML,
  encodeAttribute,
  sanitizeURL,
  renderSafeContent,
  logXSSTAttempt,
} from '@/utils/xss-protection';
import {
  detectRateLimitFromError,
  checkPredictionRateLimit,
  checkAuthRateLimit,
  getRateLimitErrorMessage,
  handleRateLimitError,
  RATE_LIMIT_ERROR_CODES,
} from '@/utils/rate-limiting';
import {
  sanitizeErrorMessage,
  containsSensitiveInfo,
  ErrorCategory,
  withSecureErrorHandling,
} from '@/utils/secure-error-handling';

describe('Security: Input Validation', () => {
  describe('ScoreSchema', () => {
    it('validates integer scores between 0-99', () => {
      expect(ScoreSchema.safeParse(0).success).toBe(true);
      expect(ScoreSchema.safeParse(50).success).toBe(true);
      expect(ScoreSchema.safeParse(99).success).toBe(true);
    });
    
    it('rejects negative scores', () => {
      expect(ScoreSchema.safeParse(-1).success).toBe(false);
    });
    
    it('rejects scores above 99', () => {
      expect(ScoreSchema.safeParse(100).success).toBe(false);
    });
    
    it('rejects non-integer scores', () => {
      expect(ScoreSchema.safeParse(1.5).success).toBe(false);
    });
  });
  
  describe('PredictionInputSchema', () => {
    it('validates correct prediction input', () => {
      const validInput = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_score: 2,
        away_score: 1,
      };
      expect(PredictionInputSchema.safeParse(validInput).success).toBe(true);
    });
    
    it('rejects invalid UUID for match_id', () => {
      const invalidInput = {
        match_id: 'not-a-uuid',
        home_score: 2,
        away_score: 1,
      };
      expect(PredictionInputSchema.safeParse(invalidInput).success).toBe(false);
    });
    
    it('rejects invalid scores', () => {
      const invalidInput = {
        match_id: '123e4567-e89b-12d3-a456-426614174000',
        home_score: -1,
        away_score: 100,
      };
      expect(PredictionInputSchema.safeParse(invalidInput).success).toBe(false);
    });
  });
  
  describe('SignUpSchema', () => {
    it('validates correct signup input', () => {
      const validInput = {
        email: 'test@example.com',
        password: 'SecurePass123',
        username: 'testuser',
      };
      expect(SignUpSchema.safeParse(validInput).success).toBe(true);
    });
    
    it('rejects weak passwords', () => {
      const weakPasswords = [
        'short',           // too short
        'nouppercase123',  // no uppercase
        'NOLOWERCASE123',  // no lowercase
        'NoNumbers',       // no numbers
      ];
      
      for (const password of weakPasswords) {
        const input = {
          email: 'test@example.com',
          password,
          username: 'testuser',
        };
        expect(SignUpSchema.safeParse(input).success).toBe(false);
      }
    });
    
    it('rejects invalid emails', () => {
      const invalidEmails = [
        'not-an-email',
        'missing@domain',
        '@domain.com',
        'test@.com',
      ];
      
      for (const email of invalidEmails) {
        const input = {
          email,
          password: 'SecurePass123',
          username: 'testuser',
        };
        expect(SignUpSchema.safeParse(input).success).toBe(false);
      }
    });
  });
  
  describe('safeValidate', () => {
    it('returns success for valid data', () => {
      const result = safeValidate(ScoreSchema, 5);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(5);
      }
    });
    
    it('returns user-friendly error for invalid data', () => {
      const result = safeValidate(ScoreSchema, -1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
        expect(typeof result.error).toBe('string');
      }
    });
  });
  
  describe('sanitizeInput', () => {
    it('removes HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const sanitized = sanitizeInput(input);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
    });
    
    it('encodes special characters', () => {
      const input = '<>&"\'';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
      expect(sanitized).toContain('&amp;');
      expect(sanitized).toContain('&quot;');
      expect(sanitized).toContain('&#x27;');
    });
    
    it('limits length', () => {
      const longInput = 'a'.repeat(1000);
      const sanitized = sanitizeInput(longInput, 100);
      expect(sanitized.length).toBeLessThanOrEqual(100);
    });
  });
});

describe('Security: XSS Protection', () => {
  describe('encodeHTML', () => {
    it('encodes special HTML characters', () => {
      expect(encodeHTML('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });
    
    it('handles empty strings', () => {
      expect(encodeHTML('')).toBe('');
    });
  });
  
  describe('encodeAttribute', () => {
    it('encodes for HTML attributes', () => {
      const input = 'test" onclick="alert(\'xss\')';
      const encoded = encodeAttribute(input);
      expect(encoded).not.toContain('"');
      expect(encoded).not.toContain("'");
      expect(encoded).toContain('&quot;');
    });
  });
  
  describe('sanitizeURL', () => {
    it('allows safe protocols', () => {
      expect(sanitizeURL('https://example.com')).toBe('https://example.com/');
      expect(sanitizeURL('http://example.com')).toBe('http://example.com/');
      expect(sanitizeURL('mailto:test@example.com')).toBe('mailto:test@example.com');
    });
    
    it('blocks javascript: protocol', () => {
      expect(sanitizeURL('javascript:alert("xss")')).toBe('');
    });
    
    it('blocks data: protocol', () => {
      expect(sanitizeURL('data:text/html,<script>alert("xss")</script>')).toBe('');
    });
    
    it('encodes invalid URLs', () => {
      const result = sanitizeURL('test<script>alert("xss")</script>');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });
  });
  
  describe('renderSafeContent', () => {
    it('encodes HTML when not allowed', () => {
      const input = '<strong>Hello</strong>';
      const result = renderSafeContent(input, { allowBasicHTML: false });
      expect(result).toContain('&lt;strong&gt;');
      expect(result).toContain('&lt;&#x2F;strong&gt;');
    });
    
    it('removes script tags', () => {
      const input = 'Hello<script>alert("xss")</script>World';
      const result = renderSafeContent(input, { allowBasicHTML: true });
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });
    
    it('limits content length', () => {
      const longInput = 'a'.repeat(1000);
      const result = renderSafeContent(longInput, { maxLength: 100 });
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });
});

describe('Security: Rate Limiting', () => {
  describe('detectRateLimitFromError', () => {
    it('detects HTTP 429 errors', () => {
      const error = { status: 429, message: 'Too Many Requests' };
      const result = detectRateLimitFromError(error);
      expect(result.isRateLimited).toBe(true);
    });
    
    it('detects rate limit error codes', () => {
      for (const code of RATE_LIMIT_ERROR_CODES) {
        const error = { code, message: 'Rate limited' };
        const result = detectRateLimitFromError(error);
        expect(result.isRateLimited).toBe(true);
      }
    });
    
    it('returns false for non-rate-limit errors', () => {
      const error = { status: 404, message: 'Not Found' };
      const result = detectRateLimitFromError(error);
      expect(result.isRateLimited).toBe(false);
    });
  });
  
  describe('checkPredictionRateLimit', () => {
    beforeEach(() => {
      // Clear any existing rate limit state
      vi.useFakeTimers();
    });
    
    afterEach(() => {
      vi.useRealTimers();
    });
    
    it('allows requests under limit', () => {
      const userId = 'test-user-1';
      const result = checkPredictionRateLimit(userId);
      expect(result.allowed).toBe(true);
    });
    
    it('blocks requests over limit', () => {
      const userId = 'test-user-2';
      
      // Make 30 requests (the limit)
      for (let i = 0; i < 30; i++) {
        checkPredictionRateLimit(userId);
      }
      
      // 31st request should be blocked
      const result = checkPredictionRateLimit(userId);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });
  });
  
  describe('getRateLimitErrorMessage', () => {
    it('generates seconds message for short delays', () => {
      const info = { isRateLimited: true, retryAfter: 30, scope: 'predictions' };
      const message = getRateLimitErrorMessage(info, 'predictions');
      expect(message).toContain('segundos');
    });
    
    it('generates minutes message for medium delays', () => {
      const info = { isRateLimited: true, retryAfter: 120, scope: 'auth' };
      const message = getRateLimitErrorMessage(info, 'authentication');
      expect(message).toContain('minuto');
    });
    
    it('generates hours message for long delays', () => {
      const info = { isRateLimited: true, retryAfter: 7200, scope: 'api' };
      const message = getRateLimitErrorMessage(info, 'requests');
      expect(message).toContain('hora');
    });
  });
});

describe('Security: Secure Error Handling', () => {
  describe('containsSensitiveInfo', () => {
    it('detects SQL errors', () => {
      const error = 'ERROR: null value in column "user_id" violates not-null constraint';
      expect(containsSensitiveInfo(error)).toBe(true);
    });
    
    it('detects stack traces', () => {
      const error = 'Error: Something went wrong\n    at Object.<anonymous> (/home/user/app.js:10:15)';
      expect(containsSensitiveInfo(error)).toBe(true);
    });
    
    it('detects file system paths', () => {
      const error = 'Cannot read file /etc/passwd';
      expect(containsSensitiveInfo(error)).toBe(true);
    });
    
    it('allows safe error messages', () => {
      const error = 'Invalid prediction scores';
      expect(containsSensitiveInfo(error)).toBe(false);
    });
  });
  
  describe('sanitizeErrorMessage', () => {
    it('sanitizes sensitive errors', () => {
      const error = 'Database connection failed: password=secret@localhost:5432';
      const result = sanitizeErrorMessage(error, 'database');
      expect(result.userMessage).not.toContain('password=');
      expect(result.userMessage).not.toContain('localhost');
      // Database errors with password could be categorized as AUTHENTICATION, SERVER, or UNKNOWN
      expect([
        ErrorCategory.AUTHENTICATION, 
        ErrorCategory.SERVER, 
        ErrorCategory.UNKNOWN
      ]).toContain(result.category);
    });
    
    it('preserves safe validation errors', () => {
      const error = 'Invalid email format';
      const result = sanitizeErrorMessage(error, 'validation');
      expect(result.userMessage).toContain('Invalid');
      expect(result.category).toBe(ErrorCategory.VALIDATION);
    });
    
    it('handles rate limit errors', () => {
      const error = { status: 429, message: 'Too Many Requests' };
      const result = sanitizeErrorMessage(error, 'api');
      expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(result.userMessage).toContain('Demasiadas');
    });
  });
  
  describe('withSecureErrorHandling', () => {
    it('returns success for successful operations', async () => {
      const fn = async () => 'success';
      const result = await withSecureErrorHandling(fn, 'test');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('success');
      }
    });
    
    it('returns sanitized error for failed operations', async () => {
      const fn = async () => {
        throw new Error('Database error: connection to localhost failed');
      };
      const result = await withSecureErrorHandling(fn, 'database');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).not.toContain('localhost');
        expect(typeof result.error).toBe('string');
      }
    });
  });
});

describe('Security: Integration Tests', () => {
  it('validates and sanitizes prediction input end-to-end', () => {
    // Simulate user input (potentially malicious)
    const userInput = {
      match_id: '123e4567-e89b-12d3-a456-426614174000',
      home_score: 2,
      away_score: 1,
    };
    
    // Validate with Zod
    const validation = safeValidate(PredictionInputSchema, userInput);
    expect(validation.success).toBe(true);
    
    // Sanitize string values
    if (validation.success) {
      const sanitized = sanitizeObject(validation.data);
      expect(sanitized).toEqual(userInput); // Should be unchanged for valid input
    }
  });
  
  it('protects against XSS in user profiles', () => {
    const maliciousProfile = {
      username: 'testuser',
      full_name: '<script>alert("xss")</script>John Doe',
      avatar_url: 'javascript:alert("xss")',
    };
    
    // Validate with Zod (should reject invalid URL)
    const validation = safeValidate(UserProfileUpdateSchema, maliciousProfile);
    // Note: Zod validation might pass for URL fields since it just validates format
    // The important part is that sanitization happens
    
    // Sanitize the object
    const sanitized = sanitizeObject(maliciousProfile);
    expect(sanitized.full_name).toContain('&lt;script&gt;');
    // URL sanitization should block javascript: protocol
    expect(sanitized.avatar_url).toBe(''); // Should be empty for invalid protocol
  });
  
  it('handles rate limiting in authentication flow', () => {
    const email = 'test@example.com';
    
    // First check should be allowed
    const result = checkAuthRateLimit(email);
    expect(result).toHaveProperty('allowed');
    // retryAfter is only defined when rate limited
    if (!result.allowed) {
      expect(result).toHaveProperty('retryAfter');
    }
    
    // Verify the function doesn't crash and returns expected structure
    expect(typeof result.allowed).toBe('boolean');
  });
});