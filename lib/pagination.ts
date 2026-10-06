export const PAGE_SIZE = 50;
export function pageNumber(value: unknown): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 && n <= 100000 ? n : 1;
}
