/**
 * Browser compatibility detection for virtualization features
 */

export interface BrowserCompatibility {
  supportsVirtualization: boolean;
  supportsIntersectionObserver: boolean;
  supportsResizeObserver: boolean;
  supportsPerformanceAPI: boolean;
  browserName: string;
  browserVersion: string;
  isMobile: boolean;
  hasTouch: boolean;
}

class BrowserCompatibilityDetector {
  private static instance: BrowserCompatibilityDetector;
  private compatibility: BrowserCompatibility;

  private constructor() {
    this.compatibility = this.detectCompatibility();
  }

  static getInstance(): BrowserCompatibilityDetector {
    if (!BrowserCompatibilityDetector.instance) {
      BrowserCompatibilityDetector.instance = new BrowserCompatibilityDetector();
    }
    return BrowserCompatibilityDetector.instance;
  }

  private detectCompatibility(): BrowserCompatibility {
    if (typeof window === 'undefined') {
      return {
        supportsVirtualization: false,
        supportsIntersectionObserver: false,
        supportsResizeObserver: false,
        supportsPerformanceAPI: false,
        browserName: 'unknown',
        browserVersion: 'unknown',
        isMobile: false,
        hasTouch: false,
      };
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Detect browser
    let browserName = 'unknown';
    let browserVersion = 'unknown';

    if (userAgent.indexOf('chrome') > -1 && userAgent.indexOf('edge') === -1) {
      browserName = 'chrome';
      const match = userAgent.match(/chrome\/(\d+)/);
      browserVersion = match ? match[1] : 'unknown';
    } else if (userAgent.indexOf('firefox') > -1) {
      browserName = 'firefox';
      const match = userAgent.match(/firefox\/(\d+)/);
      browserVersion = match ? match[1] : 'unknown';
    } else if (userAgent.indexOf('safari') > -1 && userAgent.indexOf('chrome') === -1) {
      browserName = 'safari';
      const match = userAgent.match(/version\/(\d+)/);
      browserVersion = match ? match[1] : 'unknown';
    } else if (userAgent.indexOf('edge') > -1) {
      browserName = 'edge';
      const match = userAgent.match(/edge\/(\d+)/);
      browserVersion = match ? match[1] : 'unknown';
    }

    // Check for required APIs
    const supportsIntersectionObserver = 'IntersectionObserver' in window;
    const supportsResizeObserver = 'ResizeObserver' in window;
    const supportsPerformanceAPI = 'performance' in window && 'mark' in performance && 'measure' in performance;

    // Virtualization requires IntersectionObserver at minimum
    const supportsVirtualization = supportsIntersectionObserver && supportsResizeObserver;

    return {
      supportsVirtualization,
      supportsIntersectionObserver,
      supportsResizeObserver,
      supportsPerformanceAPI,
      browserName,
      browserVersion,
      isMobile,
      hasTouch,
    };
  }

  getCompatibility(): BrowserCompatibility {
    return { ...this.compatibility };
  }

  shouldUseVirtualization(): boolean {
    const compat = this.getCompatibility();
    
    // Don't use virtualization on mobile if performance might suffer
    if (compat.isMobile) {
      // Check if it's a modern mobile browser
      const version = parseInt(compat.browserVersion, 10);
      const isModernMobile = 
        (compat.browserName === 'safari' && version >= 12) ||
        (compat.browserName === 'chrome' && version >= 60);
      
      return compat.supportsVirtualization && isModernMobile;
    }
    
    return compat.supportsVirtualization;
  }

  getFallbackReason(): string | null {
    const compat = this.getCompatibility();
    
    if (!compat.supportsIntersectionObserver) {
      return 'IntersectionObserver API not supported by this browser';
    }
    
    if (!compat.supportsResizeObserver) {
      return 'ResizeObserver API not supported by this browser';
    }
    
    if (compat.isMobile && !this.shouldUseVirtualization()) {
      return 'Virtualization disabled for older mobile browsers';
    }
    
    return null;
  }

  logCompatibility(): void {
    const compat = this.getCompatibility();
    const fallbackReason = this.getFallbackReason();
    
    console.group('Browser Compatibility for Virtualization');
    console.log('Browser:', `${compat.browserName} ${compat.browserVersion}`);
    console.log('Mobile:', compat.isMobile);
    console.log('Touch:', compat.hasTouch);
    console.log('IntersectionObserver:', compat.supportsIntersectionObserver);
    console.log('ResizeObserver:', compat.supportsResizeObserver);
    console.log('Performance API:', compat.supportsPerformanceAPI);
    console.log('Supports Virtualization:', compat.supportsVirtualization);
    console.log('Should Use Virtualization:', this.shouldUseVirtualization());
    
    if (fallbackReason) {
      console.log('Fallback Reason:', fallbackReason);
    }
    
    console.groupEnd();
  }
}

export const browserCompatibility = BrowserCompatibilityDetector.getInstance();

/**
 * Hook for checking virtualization compatibility in components
 */
export function useVirtualizationCompatibility() {
  const compat = browserCompatibility.getCompatibility();
  const shouldUse = browserCompatibility.shouldUseVirtualization();
  const fallbackReason = browserCompatibility.getFallbackReason();

  return {
    ...compat,
    shouldUseVirtualization: shouldUse,
    fallbackReason,
  };
}

/**
 * Utility to warn developers about compatibility issues
 */
export function warnAboutCompatibility(): void {
  if (typeof window === 'undefined') return;
  
  const compat = browserCompatibility.getCompatibility();
  
  if (!compat.supportsVirtualization) {
    console.warn(
      `Virtualization features may not work optimally in ${compat.browserName} ${compat.browserVersion}. ` +
      `Consider upgrading to a modern browser for better performance.`
    );
  }
}

/**
 * Feature detection for specific virtualization capabilities
 */
export function detectVirtualizationCapabilities() {
  if (typeof window === 'undefined') {
    return { canVirtualize: false, capabilities: [] as string[] };
  }

  const capabilities: string[] = [];
  
  // Check for requestAnimationFrame (basic animation support)
  if ('requestAnimationFrame' in window) {
    capabilities.push('smooth-animation');
  }
  
  // Check for passive event listeners (scroll performance)
  let supportsPassive = false;
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get: function() {
        supportsPassive = true;
        return true;
      }
    });
    window.addEventListener('test', () => {}, opts);
    window.removeEventListener('test', () => {});
  } catch (e) {}
  
  if (supportsPassive) {
    capabilities.push('passive-events');
  }
  
  // Check for requestIdleCallback (background processing)
  if ('requestIdleCallback' in window) {
    capabilities.push('idle-callback');
  }
  
  const canVirtualize = capabilities.length >= 2; // Need at least smooth animation and passive events
  
  return { canVirtualize, capabilities };
}