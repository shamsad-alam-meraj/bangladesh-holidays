import calendarsJson from "./calendars.json";
import government2027 from "./government/2027.json";
import { normalizeDataset } from "../core/validation";
import { deepFreeze } from "../utils/freeze";
import type { CalendarDefinition, DataCoverage, HolidayDataset } from "../types/dataset";
import type { CalendarId } from "../types/holiday";

interface CalendarManifestEntry extends CalendarDefinition {
  readonly years: Readonly<
    Record<
      string,
      {
        readonly status: "available" | "unavailable";
        readonly reason?: string;
        readonly checkedDate?: string;
        readonly checkedSources?: readonly string[];
      }
    >
  >;
}

const manifest = calendarsJson as unknown as { calendars: CalendarManifestEntry[] };

/** Datasets bundled with the package, validated at load time. */
export const BUILT_IN_DATASETS: readonly HolidayDataset[] = Object.freeze([
  normalizeDataset(government2027, "Built-in dataset government/2027"),
]);

/** Built-in calendar definitions. */
export const BUILT_IN_CALENDARS: readonly CalendarDefinition[] = deepFreeze(
  manifest.calendars.map(({ years: _years, ...definition }) => definition),
);

/** Coverage entries (available and explicitly unavailable) for built-in calendars. */
export const BUILT_IN_COVERAGE: readonly DataCoverage[] = deepFreeze(
  manifest.calendars.flatMap((calendar) =>
    Object.entries(calendar.years).map(([year, info]): DataCoverage => {
      const dataset = BUILT_IN_DATASETS.find(
        (candidate) => candidate.calendar === calendar.id && candidate.year === Number(year),
      );
      if (info.status === "available" && !dataset) {
        throw new Error(`calendars.json lists ${calendar.id}/${year} as available but no dataset is bundled`);
      }
      return {
        calendar: calendar.id,
        year: Number(year),
        status: info.status,
        ...(dataset ? { datasetVersion: dataset.version } : {}),
        ...(info.reason ? { reason: info.reason } : {}),
        ...(info.checkedDate ? { checkedDate: info.checkedDate } : {}),
        ...(info.checkedSources ? { checkedSources: info.checkedSources } : {}),
      };
    }),
  ),
);

/** Get a bundled dataset. */
export function getDataset(calendar: CalendarId, year: number): HolidayDataset | undefined {
  return BUILT_IN_DATASETS.find((dataset) => dataset.calendar === calendar && dataset.year === year);
}

/** Years with bundled data for a calendar (default: government). */
export function getAvailableYears(calendar: CalendarId = "government"): readonly number[] {
  return Object.freeze(
    BUILT_IN_DATASETS.filter((dataset) => dataset.calendar === calendar)
      .map((dataset) => dataset.year)
      .sort((a, b) => a - b),
  );
}

/** Coverage information for bundled calendars, optionally filtered. */
export function getDataCoverage(
  filter: { calendar?: CalendarId; year?: number } = {},
): readonly DataCoverage[] {
  return Object.freeze(
    BUILT_IN_COVERAGE.filter(
      (entry) =>
        (filter.calendar === undefined || entry.calendar === filter.calendar) &&
        (filter.year === undefined || entry.year === filter.year),
    ),
  );
}
