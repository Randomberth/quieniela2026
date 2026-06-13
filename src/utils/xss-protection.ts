/**
 * XSS (Cross-Site Scripting) protection utilities.
 * 
 * Provides defense against XSS attacks in user-generated content.
 * Uses a combination of sanitization, encoding, and safe rendering patterns.
 */

// ─── HTML Entity Encoding ────────────────────────────────────────

/**
 * Encode special HTML characters to prevent script injection.
 * Safe for use in text content, attributes, and most HTML contexts.
 */
export function encodeHTML(text: string): string {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Encode for use in HTML attribute values.
 * More restrictive than general HTML encoding.
 */
export function encodeAttribute(value: string): string {
  if (typeof value !== 'string') return '';
  
  // First encode HTML entities
  const encoded = encodeHTML(value);
  
  // Remove any remaining quotes or backslashes that could break attributes
  return encoded
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

// ─── URL Validation and Sanitization ─────────────────────────────

/**
 * Validate and sanitize URLs to prevent javascript: and data: protocol attacks.
 * Returns sanitized URL or empty string if invalid.
 */
export function sanitizeURL(url: string): string {
  if (typeof url !== 'string') return '';
  
  const trimmed = url.trim();
  if (!trimmed) return '';
  
  try {
    const parsed = new URL(trimmed);
    
    // Allow only safe protocols
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    if (!safeProtocols.includes(parsed.protocol.toLowerCase())) {
      console.warn('[XSS] Blocked unsafe URL protocol:', parsed.protocol);
      return '';
    }
    
    // Additional checks for javascript: disguised as other protocols
    if (parsed.href.toLowerCase().includes('javascript:')) {
      console.warn('[XSS] Blocked javascript: in URL');
      return '';
    }
    
    // Return the URL with encoded query parameters
    const safeURL = new URL(parsed);
    
    // Encode potentially dangerous characters in path and search
    safeURL.pathname = encodeURIComponent(safeURL.pathname).replace(/%2F/g, '/');
    safeURL.search = encodeURIComponent(safeURL.search.slice(1));
    
    return safeURL.toString();
  } catch {
    // Not a valid URL, treat as plain text
    return encodeHTML(trimmed);
  }
}

// ─── Safe Content Rendering ──────────────────────────────────────

/**
 * Options for safe content rendering
 */
interface SafeRenderOptions {
  /** Maximum length of content (prevents DoS via large content) */
  maxLength?: number;
  /** Allow basic HTML tags (strong, em, a, etc.) */
  allowBasicHTML?: boolean;
  /** Allow images (requires src validation) */
  allowImages?: boolean;
  /** Allow links (requires href validation) */
  allowLinks?: boolean;
}

/**
 * Safe list of allowed HTML tags and attributes.
 * Everything else is stripped or encoded.
 */
// const ALLOWED_TAGS_BASIC = {
//   'strong': [],
//   'em': [],
//   'u': [],
//   'b': [],
//   'i': [],
//   'code': ['class'],
//   'pre': ['class'],
//   'br': [],
//   'p': ['class'],
//   'span': ['class'],
//   'div': ['class'],
//   'ul': ['class'],
//   'ol': ['class'],
//   'li': ['class'],
// };

// const ALLOWED_TAGS_WITH_LINKS = {
//   ...ALLOWED_TAGS_BASIC,
//   'a': ['href', 'title', 'target', 'rel'],
// };

// const ALLOWED_TAGS_WITH_IMAGES = {
//   ...ALLOWED_TAGS_WITH_LINKS,
//   'img': ['src', 'alt', 'title', 'width', 'height'],
// };

/**
 * Render user content safely with XSS protection.
 * Returns sanitized HTML string or encoded text.
 */
export function renderSafeContent(
  content: string,
  options: SafeRenderOptions = {}
): string {
  const {
    maxLength = 10000,
    allowBasicHTML = false,
    allowImages = false,
    allowLinks = false,
  } = options;
  
  if (typeof content !== 'string') return '';
  
  // Length limit first (DoS protection)
  let safeContent = content.slice(0, maxLength);
  
  if (!allowBasicHTML && !allowImages && !allowLinks) {
    // No HTML allowed - encode everything
    return encodeHTML(safeContent);
  }
  
  // Basic HTML sanitization
  // In a production app, use DOMPurify or similar library
  // This is a simplified version for demonstration
  
  // Remove script tags and event handlers
  safeContent = safeContent
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^"'>\s]+/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '');
  
  if (!allowLinks) {
    // Remove links
    safeContent = safeContent.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1');
  }
  
  if (!allowImages) {
    // Remove images
    safeContent = safeContent.replace(/<img\b[^>]*>/gi, '');
  }
  
  // Encode any remaining dangerous characters
  safeContent = encodeHTML(safeContent);
  
  // Restore safe tags (this is simplified - use a proper sanitizer in production)
  if (allowBasicHTML) {
    // This is where a proper HTML sanitizer would be used
    // For now, we'll just return the encoded content with a note
    console.warn('[XSS] HTML sanitization requires DOMPurify for production use');
  }
  
  return safeContent;
}

// ─── Safe Property Setting ───────────────────────────────────────

/**
 * Safely set element attributes to prevent XSS.
 * Always use this instead of element.setAttribute() for user data.
 */
export function setSafeAttribute(
  element: HTMLElement,
  attribute: string,
  value: string
): void {
  if (!element || typeof attribute !== 'string' || typeof value !== 'string') {
    return;
  }
  
  const encodedValue = encodeAttribute(value);
  
  // Special handling for certain attributes
  switch (attribute.toLowerCase()) {
    case 'href':
    case 'src':
      const sanitized = sanitizeURL(encodedValue);
      element.setAttribute(attribute, sanitized);
      break;
    
    case 'style':
      // Never set style from user content
      console.warn('[XSS] Blocked style attribute from user content');
      break;
    
    case 'onclick':
    case 'onload':
    case 'onerror':
    case 'onmouseover':
      // Never set event handlers from user content
      console.warn('[XSS] Blocked event handler attribute:', attribute);
      break;
    
    default:
      element.setAttribute(attribute, encodedValue);
  }
}

// ─── React-Specific Safe Rendering ───────────────────────────────

/**
 * Create safe props for React elements when rendering user content.
 */
export function createSafeProps(
  props: Record<string, unknown>
): Record<string, string> {
  const safeProps: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      if (key === 'href' || key === 'src') {
        safeProps[key] = sanitizeURL(value);
      } else if (key.startsWith('on')) {
        // Skip event handlers from user content
        console.warn('[XSS] Skipping event handler prop:', key);
      } else if (key === 'style') {
        // Skip style from user content
        console.warn('[XSS] Skipping style prop');
      } else if (key === 'dangerouslySetInnerHTML') {
        // Never allow dangerouslySetInnerHTML from user content
        console.error('[XSS] Blocked dangerouslySetInnerHTML from user content');
      } else {
        safeProps[key] = encodeAttribute(value);
      }
    }
  }
  
  return safeProps;
}

// ─── Content Security Policy (CSP) Helper ───────────────────────

/**
 * Generate Content Security Policy headers for the application.
 * Returns CSP directives as a string.
 */
export function generateCSP(): string {
  // Base CSP directives
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // TODO: Remove unsafe-inline/eval in production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://wvukzhwnfzpcbupmannm.supabase.co",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  
  return directives.join('; ');
}

// ─── Logging and Monitoring ──────────────────────────────────────

/**
 * Log potential XSS attempts for monitoring.
 */
export function logXSSTAttempt(
  context: string,
  suspiciousInput: string,
  metadata: Record<string, unknown> = {}
): void {
  console.warn('[XSS] Potential XSS attempt detected:', {
    context,
    suspiciousInput: suspiciousInput.slice(0, 100), // Limit log size
    timestamp: new Date().toISOString(),
    ...metadata,
  });
  
  // In production, send to security monitoring service
  // Example: securityLogger.warn('XSS attempt', { context, ...metadata });
}