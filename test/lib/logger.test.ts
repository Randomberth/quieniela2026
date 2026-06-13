/**
 * Regression tests for Sentry-compatible error logger (BUG-007).
 * Verifies breadcrumb creation, exception capture, and export formats.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { errorLogger } from '@/lib/logger';

describe('errorLogger — Sentry-compatible features', () => {
  beforeEach(() => {
    errorLogger.clearLogs();
  });

  it('creates breadcrumb on error log', () => {
    errorLogger.error({
      operation: 'READ',
      entity: 'matches',
      message: 'Database connection failed',
      statusCode: 500,
    });

    const breadcrumbs = errorLogger.getBreadcrumbs();
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(1);
    const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
    expect(lastBreadcrumb.type).toBe('error');
    expect(lastBreadcrumb.category).toBe('matches.READ');
    expect(lastBreadcrumb.message).toBe('Database connection failed');
    expect(lastBreadcrumb.level).toBe('error');
  });

  it('creates breadcrumb on warning log', () => {
    errorLogger.warn({
      operation: 'UPDATE',
      entity: 'predictions',
      message: 'Slow response detected',
    });

    const breadcrumbs = errorLogger.getBreadcrumbs();
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(1);
    expect(breadcrumbs[breadcrumbs.length - 1].level).toBe('warning');
  });

  it('does NOT create breadcrumb on info log', () => {
    errorLogger.info({
      operation: 'READ',
      entity: 'matches',
      message: 'Data loaded',
    });

    const breadcrumbs = errorLogger.getBreadcrumbs();
    expect(breadcrumbs).toHaveLength(0);
  });

  it('captureException stores error with breadcrumbs', () => {
    // Create some prior breadcrumbs
    errorLogger.error({ operation: 'READ', entity: 'matches', message: 'Context A' });

    const error = new Error('Test exception');
    error.cause = 'Nested error';
    errorLogger.captureException(error, { component: 'MatchCard' });

    const errors = errorLogger.getErrors();
    expect(errors.length).toBe(2); // prior breadcrumb error + captured exception

    const captured = errors[0];
    expect(captured.message).toBe('Test exception');
    expect(captured.metadata).toBeDefined();
    expect(captured.metadata!.component).toBe('MatchCard');
    expect(captured.metadata!.cause).toBe('Nested error');
    expect(Array.isArray(captured.metadata!.breadcrumbs)).toBe(true);
  });

  it('getSentryCompatibleLogs returns structured data', () => {
    errorLogger.error({
      operation: 'CREATE',
      entity: 'predictions',
      message: 'Save failed',
      statusCode: 400,
      userId: 'u1',
    });

    const sentryLogs = errorLogger.getSentryCompatibleLogs();
    expect(sentryLogs).toHaveLength(1);
    const entry = sentryLogs[0];
    expect(entry.message).toBe('Save failed');
    expect(entry.fingerprint).toContain('predictions');
    expect(entry.fingerprint).toContain('CREATE');
    expect(entry.fingerprint).toContain('400');
    expect(entry.extra.userId).toBe('u1');
  });

  it('exportToJSON includes both logs and breadcrumbs', () => {
    errorLogger.error({ operation: 'READ', entity: 'auth', message: 'E1' });
    const json = errorLogger.exportToJSON();
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty('logs');
    expect(parsed).toHaveProperty('breadcrumbs');
    expect(parsed).toHaveProperty('exportedAt');
    expect(parsed.logs.length).toBeGreaterThanOrEqual(1);
  });

  it('clearLogs clears both logs and breadcrumbs', () => {
    errorLogger.error({ operation: 'READ', entity: 'matches', message: 'E' });
    errorLogger.clearLogs();

    expect(errorLogger.getLogs()).toHaveLength(0);
    expect(errorLogger.getBreadcrumbs()).toHaveLength(0);
  });

  it('breadcrumbs cap at 50 entries', () => {
    // Add 55 breadcrumb-triggering errors
    for (let i = 0; i < 55; i++) {
      errorLogger.error({
        operation: 'READ',
        entity: 'matches',
        message: `Error ${i}`,
      });
    }

    const breadcrumbs = errorLogger.getBreadcrumbs();
    expect(breadcrumbs.length).toBeLessThanOrEqual(50);
  });
});