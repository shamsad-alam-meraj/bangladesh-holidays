import { VERSION } from "../version";
import type { Holiday, ISODateString, LocaleCode } from "../types/holiday";

export interface JsonExportMeta {
  readonly locale?: LocaleCode;
  readonly from?: ISODateString;
  readonly to?: ISODateString;
  readonly [key: string]: unknown;
}

/** Serialize holidays as a JSON document with a small metadata envelope. */
export function exportToJson(
  holidays: readonly Holiday[],
  options: { indent?: number; meta?: JsonExportMeta } = {},
): string {
  const indent = options.indent ?? 2;
  if (!Number.isInteger(indent) || indent < 0 || indent > 10) {
    throw new RangeError("indent must be an integer between 0 and 10");
  }
  const document = {
    generator: `bangladesh-holidays@${VERSION}`,
    ...options.meta,
    count: holidays.length,
    holidays,
  };
  return JSON.stringify(document, null, indent === 0 ? undefined : indent);
}
