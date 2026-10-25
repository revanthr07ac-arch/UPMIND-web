import { describe, it, expect } from 'vitest';
import { formatTimeAgo, formatNumber, getInitials, truncate } from '../lib/utils';

describe('Upmind Utility Helpers', () => {
  it('correctly abbreviates numbers (likes, followers)', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(45)).toBe('45');
    expect(formatNumber(1200)).toBe('1.2k');
    expect(formatNumber(10000)).toBe('10k');
    expect(formatNumber(2500000)).toBe('2.5M');
  });

  it('generates uppercase avatar initials fallback', () => {
    expect(getInitials('Revanth')).toBe('RE');
    expect(getInitials('Alex Rivers')).toBe('AR');
    expect(getInitials('')).toBe('U');
    expect(getInitials(null)).toBe('U');
  });

  it('truncates long post captions', () => {
    const text = 'This is a tutorial on building fullstack applications with Supabase and React';
    expect(truncate(text, 20)).toBe('This is a tutorial o...');
    expect(truncate('Short', 20)).toBe('Short');
  });

  it('formats relative time ago', () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe('just now');

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatTimeAgo(tenMinutesAgo)).toBe('10m ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(twoHoursAgo)).toBe('2h ago');
  });
});
