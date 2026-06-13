/**
 * Performance monitoring utilities for tracking virtual scrolling performance
 */

export interface PerformanceMetrics {
  initialRenderTime: number;
  scrollFrameRate: number;
  memoryUsage: number;
  virtualizationEnabled: boolean;
  matchCount: number;
  visibleItems: number;
  timestamp: number;
}

export interface PerformanceEvent {
  type: 'initial-render' | 'scroll' | 'resize' | 'virtualization-toggle';
  metrics: PerformanceMetrics;
}

class PerformanceMonitor {
  private events: PerformanceEvent[] = [];
  private isEnabled: boolean = true;
  private scrollFrameTimes: number[] = [];
  private lastScrollTime: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupScrollListener();
    }
  }

  private setupScrollListener() {
    let ticking = false;
    
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          this.recordScrollFrame();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  private recordScrollFrame() {
    const now = performance.now();
    if (this.lastScrollTime > 0) {
      const frameTime = now - this.lastScrollTime;
      this.scrollFrameTimes.push(frameTime);
      
      // Keep only last 60 frames (~1 second at 60fps)
      if (this.scrollFrameTimes.length > 60) {
        this.scrollFrameTimes.shift();
      }
    }
    this.lastScrollTime = now;
  }

  async measureInitialRender(): Promise<PerformanceMetrics> {
    if (!this.isEnabled || typeof window === 'undefined') {
      return this.getEmptyMetrics();
    }

    const startTime = performance.now();
    
    // Wait for next frame to ensure rendering is complete
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    const endTime = performance.now();
    const initialRenderTime = endTime - startTime;

    const metrics = this.getCurrentMetrics();
    metrics.initialRenderTime = initialRenderTime;

    this.events.push({
      type: 'initial-render',
      metrics,
    });

    return metrics;
  }

  recordVirtualizationToggle(enabled: boolean, matchCount: number) {
    if (!this.isEnabled) return;

    const metrics = this.getCurrentMetrics();
    metrics.virtualizationEnabled = enabled;
    metrics.matchCount = matchCount;

    this.events.push({
      type: 'virtualization-toggle',
      metrics,
    });

    // Log to console for debugging
    console.log(`Virtualization ${enabled ? 'enabled' : 'disabled'} for ${matchCount} matches`, metrics);
  }

  private getCurrentMetrics(): PerformanceMetrics {
    const scrollFrameRate = this.calculateFrameRate();
    const memoryUsage = this.getMemoryUsage();

    return {
      initialRenderTime: 0,
      scrollFrameRate,
      memoryUsage,
      virtualizationEnabled: false,
      matchCount: 0,
      visibleItems: 0,
      timestamp: Date.now(),
    };
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      initialRenderTime: 0,
      scrollFrameRate: 0,
      memoryUsage: 0,
      virtualizationEnabled: false,
      matchCount: 0,
      visibleItems: 0,
      timestamp: Date.now(),
    };
  }

  private calculateFrameRate(): number {
    if (this.scrollFrameTimes.length < 2) return 60; // Default to 60fps
    
    const averageFrameTime = this.scrollFrameTimes.reduce((sum, time) => sum + time, 0) / this.scrollFrameTimes.length;
    return averageFrameTime > 0 ? Math.round(1000 / averageFrameTime) : 60;
  }

  private getMemoryUsage(): number {
    if ('memory' in (performance as any)) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return this.getCurrentMetrics();
  }

  recordEvent(event: PerformanceEvent) {
    this.events.push(event);
  }

  getPerformanceReport(): {
    averageFrameRate: number;
    averageRenderTime: number;
    events: PerformanceEvent[];
  } {
    const initialRenderEvents = this.events.filter(e => e.type === 'initial-render');
    const averageRenderTime = initialRenderEvents.length > 0
      ? initialRenderEvents.reduce((sum, e) => sum + e.metrics.initialRenderTime, 0) / initialRenderEvents.length
      : 0;

    return {
      averageFrameRate: this.calculateFrameRate(),
      averageRenderTime,
      events: [...this.events],
    };
  }

  clear() {
    this.events = [];
    this.scrollFrameTimes = [];
    this.lastScrollTime = 0;
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Hook for measuring component performance with virtualization
 */
export function usePerformanceMeasurement(componentName: string) {
  const measureRender = async (matchCount: number, virtualizationEnabled: boolean) => {
    if (typeof window === 'undefined') return null;

    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;
    
    performance.mark(startMark);
    
    // Wait for rendering to complete
    await new Promise(resolve => setTimeout(resolve, 0));
    
    performance.mark(endMark);
    performance.measure(`${componentName}-render`, startMark, endMark);
    
    const measures = performance.getEntriesByName(`${componentName}-render`);
    const renderTime = measures.length > 0 ? measures[0]!.duration : 0;
    
    // Clean up marks
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(`${componentName}-render`);
    
    const metrics = performanceMonitor.getPerformanceMetrics();
    metrics.initialRenderTime = renderTime;
    metrics.matchCount = matchCount;
    metrics.virtualizationEnabled = virtualizationEnabled;
    
    performanceMonitor.recordEvent({
      type: 'initial-render',
      metrics,
    });
    
    return metrics;
  };

  return { measureRender };
}

/**
 * Utility to measure scroll performance
 */
export function measureScrollPerformance(callback: (fps: number) => void) {
  if (typeof window === 'undefined') return () => {};
  
  let frameCount = 0;
  let lastTime = performance.now();
  let animationFrameId: number;
  
  const measure = () => {
    const currentTime = performance.now();
    frameCount++;
    
    if (currentTime - lastTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      callback(fps);
      frameCount = 0;
      lastTime = currentTime;
    }
    
    animationFrameId = requestAnimationFrame(measure);
  };
  
  animationFrameId = requestAnimationFrame(measure);
  
  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}