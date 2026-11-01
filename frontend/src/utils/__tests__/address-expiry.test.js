import { describe, expect, it } from 'vitest';
import { utcToTimestamp, getExpiryRemainingParts } from '../index';

describe('mailbox expiry helpers', () => {
    it('parses UTC datetime strings returned by the worker', () => {
        expect(utcToTimestamp('2026-11-01 12:00:00')).toBe(Date.UTC(2026, 10, 1, 12, 0, 0));
    });

    it('returns null for empty or invalid values', () => {
        expect(utcToTimestamp('')).toBeNull();
        expect(utcToTimestamp(null)).toBeNull();
        expect(utcToTimestamp('not-a-date')).toBeNull();
    });

    it.each([
        [0, { days: 0, hours: 0, minutes: 1 }],
        [60_000, { days: 0, hours: 0, minutes: 1 }],
        [90 * 60_000, { days: 0, hours: 1, minutes: 30 }],
        [26 * 60 * 60_000, { days: 1, hours: 2, minutes: 0 }],
    ])('splits %i ms into days/hours/minutes', (remainingMs, expected) => {
        expect(getExpiryRemainingParts(remainingMs)).toEqual(expected);
    });
});
