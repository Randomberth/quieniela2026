# Tasks: Architectural Audit & Refactoring - World Cup 2026 Quiniela

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500-800 lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Infrastructure → PR 2: Performance → PR 3: Modernization → PR 4: Quality |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Testing Infrastructure Setup | PR 1 | Base branch: main. Tests/docs included. Foundation for all other work. |
| 2 | Virtual Scrolling Implementation | PR 2 | Base branch: main after PR 1. Performance improvement for 104-match list. |
| 3 | React 19 Form Actions Migration | PR 3 | Base branch: main after PR 2. Modern React patterns with fallback. |
| 4 | TypeScript Strict Mode & Bug Fixes | PR 4 | Base branch: main after PR 3. Code quality improvements and bug fixes. |
| 5 | Security Hardening | PR 5 | Base branch: main after PR 4. RLS review and input validation. |

## Phase 1: Testing Infrastructure Foundation (Week 1)

- [x] 1.1 Install Vitest, React Testing Library, MSW, and testing dependencies to package.json
- [x] 1.2 Configure vite.config.ts for test environment with proper aliases and setup
- [x] 1.3 Create test utilities: `test/utils.ts` with renderWithProviders, screen, userEvent setup
- [x] 1.4 Set up MSW (Mock Service Worker) for Supabase API mocking in `test/mocks/handlers.ts`
- [x] 1.5 Create test setup file `test/setup.ts` with MSW server, cleanup, and global matchers
- [x] 1.6 Add npm scripts for testing: `test`, `test:watch`, `test:coverage` in package.json
- [x] 1.7 Configure GitHub Actions workflow for CI testing (optional but recommended)

## Phase 2: Performance Optimization - Virtual Scrolling (Week 1)

- [x] 2.1 Install `@tanstack/react-virtual` and create feature flag in `src/config/feature-flags.ts`
- [x] 2.2 Create virtualized match list component: `src/components/matches/virtualization/VirtualizationProvider.tsx`
- [x] 2.3 Create virtual match card component: `src/components/matches/virtualization/VirtualMatchCard.tsx` (optimized)
- [x] 2.4 Implement virtualization provider: `src/components/matches/virtualization/VirtualMatchList.tsx`
- [x] 2.5 Update MatchList component to conditionally use VirtualMatchList based on feature flag
- [x] 2.6 Add performance monitoring: `src/utils/performance.ts` with metrics collection
- [x] 2.7 Write integration tests for virtual scrolling in `test/components/matches/virtualization/VirtualMatchList.test.tsx`
- [x] 2.8 Add fallback mechanism when virtualization fails (non-breaking)

## Phase 3: React 19 Form Actions Migration (Week 2)

- [ ] 3.1 Create server actions for predictions: `src/actions/predictions.ts` with Form Actions
- [ ] 3.2 Update `usePredictions` hook to use `useActionState` for form submissions
- [ ] 3.3 Modify `MatchCard.tsx` to use Form Actions instead of traditional onSubmit
- [ ] 3.4 Implement optimistic updates with React Query for seamless UX
- [ ] 3.5 Add loading states and error handling with `useActionState` feedback
- [ ] 3.6 Ensure backward compatibility with existing validation and match locking logic
- [ ] 3.7 Write tests for Form Actions in `test/actions/predictions.test.ts`
- [ ] 3.8 Update any form-related components to use React 19 patterns

## Phase 4: TypeScript Strict Mode Enablement (Week 2)

- [ ] 4.1 Update `tsconfig.app.json` to enable strict mode flags incrementally
- [ ] 4.2 Fix TypeScript errors in `src/types/index.ts` and improve type definitions
- [ ] 4.3 Add missing type annotations in hooks: `useMatches.ts`, `usePredictions.ts`, `useAuth.ts`
- [ ] 4.4 Fix any implicit any types in components and utilities
- [ ] 4.5 Add third-party type declarations for any untyped libraries
- [ ] 4.6 Create type utilities: `src/types/utils.ts` with helper types and type guards
- [ ] 4.7 Update ESLint configuration to enforce TypeScript best practices

## Phase 5: Critical Bug Fixes (Week 3)

- [ ] 5.1 Fix match locking inconsistencies: validate `currentTime >= match_date` in multiple places
- [ ] 5.2 Implement centralized validation layer: `src/utils/matchValidation.ts`
- [ ] 5.3 Fix race conditions in prediction submissions with atomic operations
- [ ] 5.4 Add error boundaries: `src/components/ErrorBoundary.tsx` and `src/components/ErrorFallback.tsx`
- [ ] 5.5 Implement proper error state recovery in data fetching hooks
- [ ] 5.6 Add retry logic with exponential backoff for failed API calls
- [ ] 5.7 Write integration tests for bug fixes in `test/integration/bugFixes.test.tsx`

## Phase 6: Security Hardening (Week 3)

- [ ] 6.1 Create RLS policy audit script: `scripts/audit-rls-policies.js`
- [ ] 6.2 Review and strengthen input validation in `src/utils/validation.ts`
- [ ] 6.3 Implement XSS protection for user-generated content display
- [ ] 6.4 Add rate limiting awareness to frontend error handling
- [ ] 6.5 Secure error messages to avoid information disclosure
- [ ] 6.6 Audit authentication flow in `useAuth.ts` for security best practices
- [ ] 6.7 Write security-focused tests in `test/security/validation.test.ts`

## Phase 7: Integration & Verification (Week 4)

- [ ] 7.1 Run end-to-end verification of all improvements with feature flags
- [ ] 7.2 Conduct performance benchmarking before/after virtual scrolling
- [ ] 7.3 Verify TypeScript strict mode compiles with zero errors
- [ ] 7.4 Test backward compatibility of all changes
- [ ] 7.5 Update documentation: `README.md` with new patterns and testing guide
- [ ] 7.6 Create developer guide: `docs/ARCHITECTURE.md` with new patterns
- [ ] 7.7 Clean up temporary code and remove debug logging

## Phase 8: Monitoring & Rollout (Week 4)

- [ ] 8.1 Set up performance monitoring with feature flag analytics
- [ ] 8.2 Create rollout plan with percentage-based feature enablement
- [ ] 8.3 Prepare rollback procedures for each capability
- [ ] 8.4 Document operational procedures for monitoring during rollout
- [ ] 8.5 Train team members on new patterns and testing approach

## Task Details by Capability

### Virtual Scrolling Implementation (VIRTUAL-001 to VIRTUAL-008)
- **Priority**: High
- **Estimate**: 16 hours
- **Complexity**: Medium
- **Dependencies**: None (can start immediately)
- **Files Affected**: `src/components/matches/*`, `src/config/feature-flags.ts`, `test/components/matches/*`
- **Acceptance Criteria**: 30% faster initial render, identical UI appearance, fallback works
- **Rollback Plan**: Disable feature flag to revert to original MatchList

### React 19 Form Actions Migration (FORM-001 to FORM-008)
- **Priority**: High  
- **Estimate**: 20 hours
- **Complexity**: High
- **Dependencies**: Testing infrastructure (Phase 1)
- **Files Affected**: `src/actions/*`, `src/hooks/usePredictions.ts`, `src/components/matches/MatchCard.tsx`
- **Acceptance Criteria**: All forms use Form Actions, backward compatibility maintained
- **Rollback Plan**: Revert to previous onSubmit handlers, keep server actions as fallback

### Testing Infrastructure Setup (TEST-001 to TEST-008)
- **Priority**: Foundation
- **Estimate**: 12 hours
- **Complexity**: Medium
- **Dependencies**: None
- **Files Affected**: `package.json`, `vite.config.ts`, `test/`, `test/mocks/`
- **Acceptance Criteria**: All tests pass, coverage > 80% for critical paths
- **Rollback Plan**: Remove test dependencies, revert config changes

### TypeScript Strict Mode Enablement (TS-001 to TS-007)
- **Priority**: Quality
- **Estimate**: 10 hours
- **Complexity**: Low
- **Dependencies**: None
- **Files Affected**: `tsconfig.app.json`, `src/types/*`, `src/**/*.ts`, `src/**/*.tsx`
- **Acceptance Criteria**: Strict mode enabled, zero TypeScript errors
- **Rollback Plan**: Revert strict mode flags in tsconfig

### Critical Bug Fixes (BUG-001 to BUG-007)
- **Priority**: Stability
- **Estimate**: 8 hours
- **Complexity**: Medium
- **Dependencies**: TypeScript strict mode (for better type safety)
- **Files Affected**: `src/utils/matchValidation.ts`, `src/components/ErrorBoundary.tsx`, `src/hooks/*`
- **Acceptance Criteria**: Match locking works consistently, race conditions eliminated
- **Rollback Plan**: Revert validation layer, restore original error handling

### Security Hardening (SEC-001 to SEC-007)
- **Priority**: Security
- **Estimate**: 8 hours
- **Complexity**: Medium
- **Dependencies**: Bug fixes (for validation improvements)
- **Files Affected**: `scripts/audit-rls-policies.js`, `src/utils/validation.ts`, `src/hooks/useAuth.ts`
- **Acceptance Criteria**: RLS policies verified, input validation strengthened
- **Rollback Plan**: Revert validation changes, restore original error messages