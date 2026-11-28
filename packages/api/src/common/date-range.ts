import { BadRequestException } from '@nestjs/common';

export interface DateRangeBounds {
  start?: Date;
  endExclusive?: Date;
}

export function parseBogotaDateRange(
  from?: string,
  to?: string,
  requireBoth = false,
  maxDays = 366,
): DateRangeBounds {
  if (requireBoth && (!from || !to)) {
    throw new BadRequestException('Both start and end dates are required.');
  }

  const fromDay = from ? parseCalendarDay(from) : undefined;
  const toDay = to ? parseCalendarDay(to) : undefined;
  if (fromDay && toDay && fromDay.getTime() > toDay.getTime()) {
    throw new BadRequestException('The start date must be on or before the end date.');
  }
  if (
    fromDay &&
    toDay &&
    (toDay.getTime() - fromDay.getTime()) / 86_400_000 + 1 > maxDays
  ) {
    throw new BadRequestException(`The selected date range cannot exceed ${maxDays} days.`);
  }

  return {
    ...(from ? { start: bogotaMidnight(from) } : {}),
    ...(to ? { endExclusive: bogotaMidnight(nextCalendarDay(to)) } : {}),
  };
}

function parseCalendarDay(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Dates must be valid calendar dates in YYYY-MM-DD format.');
  }
  return parsed;
}

function nextCalendarDay(value: string): string {
  const next = parseCalendarDay(value);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function bogotaMidnight(value: string): Date {
  return new Date(`${value}T00:00:00.000-05:00`);
}
