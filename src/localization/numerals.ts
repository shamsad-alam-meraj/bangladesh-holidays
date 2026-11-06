const BANGLA_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;

/** Replace ASCII digits with Bangla digits: `toBanglaDigits(2027)` → `"২০২৭"`. */
export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => BANGLA_DIGITS[Number(digit)] ?? digit);
}

/** Replace Bangla digits with ASCII digits: `toLatinDigits("২০২৭")` → `"2027"`. */
export function toLatinDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
}
