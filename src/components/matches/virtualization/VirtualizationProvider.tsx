import React, { createContext, useContext, useMemo } from 'react';
import { isFeatureEnabled } from '@/config/feature-flags';
import { browserCompatibility } from '@/utils/compatibility';

interface VirtualizationContextValue {
  isEnabled: boolean;
  estimatedItemHeight: number;
  overscan: number;
  compatibility: {
    supportsVirtualization: boolean;
    shouldUseVirtualization: boolean;
    fallbackReason: string | null;
  };
}

const VirtualizationContext = createContext<VirtualizationContextValue>({
  isEnabled: false,
  estimatedItemHeight: 180, // Default estimated height for a MatchCard
  overscan: 10,
  compatibility: {
    supportsVirtualization: false,
    shouldUseVirtualization: false,
    fallbackReason: 'Context not initialized',
  },
});

export function useVirtualization() {
  return useContext(VirtualizationContext);
}

interface VirtualizationProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
  estimatedItemHeight?: number;
  overscan?: number;
}

export function VirtualizationProvider({
  children,
  enabled: forceEnabled,
  estimatedItemHeight = 180,
  overscan = 10,
}: VirtualizationProviderProps) {
  const compatibility = useMemo(() => {
    const compat = browserCompatibility.getCompatibility();
    return {
      supportsVirtualization: compat.supportsVirtualization,
      shouldUseVirtualization: browserCompatibility.shouldUseVirtualization(),
      fallbackReason: browserCompatibility.getFallbackReason(),
    };
  }, []);

  const isEnabled = useMemo(() => {
    if (forceEnabled !== undefined) return forceEnabled;
    
    // Check feature flag first
    if (!isFeatureEnabled('virtual-scrolling')) return false;
    
    // Then check browser compatibility
    return compatibility.shouldUseVirtualization;
  }, [forceEnabled, compatibility.shouldUseVirtualization]);

  const value = useMemo(() => ({
    isEnabled,
    estimatedItemHeight,
    overscan,
    compatibility,
  }), [isEnabled, estimatedItemHeight, overscan, compatibility]);

  return (
    <VirtualizationContext.Provider value={value}>
      {children}
    </VirtualizationContext.Provider>
  );
}