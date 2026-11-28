import { BadRequestException } from '@nestjs/common';
import { parseBogotaDateRange } from './date-range';

describe('parseBogotaDateRange', () => {
  it('converts Colombia calendar dates to inclusive local-day bounds', () => {
    const range = parseBogotaDateRange('2026-10-01', '2026-10-31', true);

    expect(range.start?.toISOString()).toBe('2026-10-01T05:00:00.000Z');
    expect(range.endExclusive?.toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });

  it('rejects invalid dates, reversed ranges, and overly broad periods', () => {
    expect(() => parseBogotaDateRange('2026-02-31', '2026-03-01')).toThrow(
      BadRequestException,
    );
    expect(() => parseBogotaDateRange('2026-10-02', '2026-10-01')).toThrow(
      BadRequestException,
    );
    expect(() => parseBogotaDateRange('2025-01-01', '2026-01-02')).toThrow(
      BadRequestException,
    );
  });
});
