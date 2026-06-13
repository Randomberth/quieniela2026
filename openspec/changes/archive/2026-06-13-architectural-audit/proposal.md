# Proposal: Architectural Audit & Refactoring - World Cup 2026 Quiniela

## Vision & Goals
**Primary Objective**: Conduct a comprehensive architectural audit and implement targeted refactoring to improve code quality, performance, and maintainability of the World Cup 2026 Quiniela application during the active tournament.

**Success Criteria**:
1. Performance improvements: 30% faster initial render for 104-match fixture
2. Code quality: Enable TypeScript strict mode, achieve 80% test coverage for critical paths
3. Modernization: Migrate to React 19 Form Actions and useActionState patterns
4. Reliability: Fix identified bugs and implement comprehensive error boundaries

**Business Value**:
- Improved user experience during peak tournament usage
- Reduced bug surface and support load
- Enhanced developer velocity for future features
- Long-term maintenance cost reduction

## Intent
The World Cup 2026 Quiniela is a critical internal application with 48 teams and 104 matches. While the foundation is solid with modern React 19.1, TypeScript, and Supabase, several architectural improvements are needed to ensure optimal performance, maintainability, and user experience during the active tournament. This audit addresses technical debt accumulated during rapid development.

## Scope

### In Scope
- **Code Quality**: Enable strict TypeScript mode, fix any type errors, implement comprehensive ESLint rules
- **Performance Optimization**: Optimize 104-match fixture rendering, implement virtual scrolling, improve bundle size
- **React 19 Modernization**: Migrate from traditional forms to Form Actions with useActionState
- **Testing Infrastructure**: Establish Jest/Vitest test framework with React Testing Library
- **Error Handling**: Implement structured error boundaries and improve error recovery
- **Security Hardening**: Review and strengthen RLS policies, input validation
- **Bug Fixes**: Address identified issues from exploration phase

### Out of Scope
- Major UI redesign or visual changes
- Adding new features not in current roadmap
- Database schema changes (except for performance optimizations)
- Third-party service integrations
- Mobile app development

### First Slice
1. **Performance**: Implement virtual scrolling for match list (biggest immediate impact)
2. **Testing**: Set up Vitest framework with basic test coverage for hooks
3. **TypeScript**: Enable strict mode and fix critical type errors

## Capabilities

### New Capabilities
- **react-19-form-actions**: Modern React 19 form handling with Form Actions and useActionState
- **performance-optimization**: Virtual scrolling, bundle optimization, memoization patterns
- **testing-infrastructure**: Vitest setup, test utilities, coverage reporting
- **error-boundaries**: Structured error handling and recovery patterns

### Modified Capabilities
- **prediction-form**: Update to use React 19 Form Actions instead of traditional onSubmit
- **match-rendering**: Optimize rendering of 104-match fixture with virtualization
- **data-fetching-hooks**: Add error boundary support and improve caching strategies

## Approach
**Incremental Refactoring with Feature Flags**: Implement improvements incrementally behind feature flags to avoid disrupting the live application during the World Cup. Use a phased approach starting with the highest impact, lowest risk changes.

**Key Technical Decisions**:
1. Use `react-window` or `@tanstack/react-virtual` for virtual scrolling
2. Adopt Vitest over Jest for better Vite integration
3. Implement React 19 Form Actions with progressive enhancement
4. Use `useMemo` and `useCallback` strategically for performance
5. Implement error boundaries at component boundaries

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/matches/` | Modified | Virtual scrolling implementation |
| `src/hooks/` | Modified | Add error handling, improve caching |
| `src/pages/Matches.tsx` | Modified | Form Actions migration |
| `test/` | New | Testing infrastructure setup |
| `vite.config.ts` | Modified | Add test configuration |
| `package.json` | Modified | Add dev dependencies for testing |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Performance regression during active tournament | Medium | Feature flags, A/B testing, extensive monitoring |
| Breaking existing predictions functionality | Low | Comprehensive test coverage, manual QA before rollout |
| Increased bundle size from new dependencies | Low | Tree-shaking, bundle analysis, code splitting |
| Developer disruption during critical period | Medium | Incremental rollout, clear documentation, team training |

## Rollback Plan
1. All changes deployed behind feature flags
2. Each improvement has independent toggle
3. Database changes are backwards compatible
4. Can revert to previous version via Git revert if needed
5. Monitoring alerts for performance regressions

## Dependencies
- React 19.1 compatibility with Form Actions
- Supabase database schema stability
- Team availability for code review
- User acceptance for UI changes

## Success Criteria
- [ ] 30% faster initial render time for match list (measured via Lighthouse)
- [ ] TypeScript strict mode enabled with 0 errors
- [ ] 80% test coverage for critical business logic (hooks, scoring logic)
- [ ] All forms migrated to React 19 Form Actions
- [ ] Bundle size increase < 10% from optimizations
- [ ] No regressions in prediction submission or scoring

## Stakeholder Impact
**User Experience**: Faster load times, smoother interactions, better error messages
**Developer Experience**: Improved code quality, better tooling, faster tests
**Maintenance**: Reduced technical debt, easier onboarding, better documentation

## Delivery Approach
**Phase 1 (Week 1)**: Performance & Testing Infrastructure
- Virtual scrolling implementation
- Vitest setup with basic tests
- Bundle analysis and optimization

**Phase 2 (Week 2)**: TypeScript & Code Quality
- Enable strict mode
- Fix type errors
- Implement comprehensive ESLint rules

**Phase 3 (Week 3)**: React 19 Modernization
- Form Actions migration
- Error boundaries implementation
- Performance monitoring

**Verification Plan**: Each phase includes unit tests, integration tests, and manual QA. Performance metrics tracked via analytics.