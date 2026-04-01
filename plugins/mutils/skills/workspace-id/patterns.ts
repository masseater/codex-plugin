#!/usr/bin/env bun

/**
 * Shared patterns for workspace-id skill and hooks
 *
 * This module provides the canonical regex patterns for workspace-id validation
 * and parsing to ensure consistency across the codebase.
 */

/**
 * Feature name pattern: kebab-case, starts with lowercase letter
 * Examples: doc-engine, api-v2-migration, fix-parser
 */
export const FEATURE_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Full workspace-id pattern: yyyymmdd-HHmm-[feature-name]
 * Captures:
 * - Group 0: Full workspace-id
 * - Group 1: Date-time prefix (yyyymmdd-HHmm)
 * - Group 2: Feature name
 */
export const WORKSPACE_ID_PATTERN = /^(\d{8}-\d{4})-([a-z][a-z0-9]*(-[a-z0-9]+)*)$/;

/**
 * Validate a feature name
 */
export function isValidFeatureName(name: string): boolean {
  return FEATURE_NAME_PATTERN.test(name);
}

/**
 * Parse a workspace-id into its components
 */
export function parseWorkspaceId(
  workspaceId: string,
): { dateTimePrefix: string; featureName: string } | null {
  const match = workspaceId.match(WORKSPACE_ID_PATTERN);
  if (match?.[1] && match[2]) {
    return {
      dateTimePrefix: match[1],
      featureName: match[2],
    };
  }
  return null;
}
