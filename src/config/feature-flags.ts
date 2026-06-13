/**
 * Feature flags for controlled rollout of new features
 */

export type FeatureFlag = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
};

const FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'virtual-scrolling',
    name: 'Virtual Scrolling',
    description: 'Enables virtualized rendering for match lists to improve performance with large datasets',
    enabled: true, // Initially enabled for development, can be controlled via environment or admin panel
    rolloutPercentage: 100,
  },
  {
    id: 'react-19-form-actions',
    name: 'React 19 Form Actions',
    description: 'Migrate forms to use React 19 Form Actions with useActionState',
    enabled: false,
    rolloutPercentage: 0,
  },
  {
    id: 'strict-typescript',
    name: 'TypeScript Strict Mode',
    description: 'Enable strict TypeScript compilation mode',
    enabled: false,
    rolloutPercentage: 0,
  },
];

export function isFeatureEnabled(featureId: string): boolean {
  const flag = FEATURE_FLAGS.find(f => f.id === featureId);
  if (!flag) return false;
  
  // Check rollout percentage if specified
  if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
    // In a real app, this would check user ID or session for consistent rollout
    // For now, we'll use a simple hash-based approach for demonstration
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    const hash = userId ? [...userId].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100 : Math.random() * 100;
    return flag.enabled && hash < flag.rolloutPercentage;
  }
  
  return flag.enabled;
}

export function getFeatureFlag(featureId: string): FeatureFlag | undefined {
  return FEATURE_FLAGS.find(f => f.id === featureId);
}

export function getAllFeatureFlags(): FeatureFlag[] {
  return [...FEATURE_FLAGS];
}