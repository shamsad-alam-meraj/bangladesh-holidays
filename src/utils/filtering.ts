import type { Holiday, ISODateString, RegionScope } from "../types/holiday";
import type { HolidayFilter } from "../types/options";

function asArray<T>(value: T | readonly T[] | undefined): readonly T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

/**
 * Attribute filters (category, type, status, …). Date-range filtering is done
 * by the caller because it depends on calendar configuration.
 */
export function matchesAttributes(holiday: Holiday, filter: HolidayFilter): boolean {
  const calendars = asArray(filter.calendar);
  if (calendars && !calendars.includes(holiday.calendar)) return false;
  const categories = asArray(filter.category);
  if (categories && !categories.includes(holiday.category)) return false;
  const types = asArray(filter.type);
  if (types && !types.includes(holiday.type)) return false;
  const statuses = asArray(filter.dateStatus);
  if (statuses && !statuses.includes(holiday.dateStatus)) return false;
  const communities = asArray(filter.community);
  if (communities && !(holiday.communities ?? []).some((c) => communities.includes(c))) return false;
  if (filter.dayType !== undefined && holiday.dayType !== filter.dayType) return false;
  if (filter.official !== undefined && holiday.official !== filter.official) return false;
  if (filter.search !== undefined && filter.search.trim() !== "") {
    const needle = filter.search.trim().toLowerCase();
    const haystack = `${holiday.id} ${holiday.nameEn} ${holiday.nameBn ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/** True if the holiday overlaps `[from, to]` (inclusive). */
export function overlapsRange(holiday: Holiday, from: ISODateString, to: ISODateString): boolean {
  return holiday.date <= to && (holiday.endDate ?? holiday.date) >= from;
}

/**
 * Whether a regionally scoped holiday applies.
 * `region` undefined = national scope; `"all"` = every region.
 */
export function regionApplies(scope: RegionScope | undefined, region: string | undefined): boolean {
  if (!scope || region === "all") return true;
  if (scope.include && (region === undefined || !scope.include.includes(region))) return false;
  if (scope.exclude && region !== undefined && scope.exclude.includes(region)) return false;
  return true;
}
