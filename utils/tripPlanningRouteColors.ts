/**
 * โทนพื้นหลังโพสอิทตามเขต / พื้นที่ — จาก hash เป็น palette คงที่ (ไม่ต้อง hardcode ทุกอำเภอ)
 */
export const TRIP_ROUTE_PALETTE_CLASSES: readonly string[] = [
  'bg-amber-100 border-amber-200 text-amber-900 dark:bg-amber-950/35 dark:border-amber-800 dark:text-amber-100',
  'bg-emerald-100 border-emerald-200 text-emerald-900 dark:bg-emerald-950/35 dark:border-emerald-800 dark:text-emerald-100',
  'bg-sky-100 border-sky-200 text-sky-900 dark:bg-sky-950/35 dark:border-sky-800 dark:text-sky-100',
  'bg-rose-100 border-rose-200 text-rose-900 dark:bg-rose-950/35 dark:border-rose-800 dark:text-rose-100',
  'bg-violet-100 border-violet-200 text-violet-900 dark:bg-violet-950/35 dark:border-violet-800 dark:text-violet-100',
  'bg-orange-100 border-orange-200 text-orange-900 dark:bg-orange-950/35 dark:border-orange-800 dark:text-orange-100',
  'bg-teal-100 border-teal-200 text-teal-900 dark:bg-teal-950/35 dark:border-teal-800 dark:text-teal-100',
  'bg-lime-100 border-lime-200 text-lime-900 dark:bg-lime-950/35 dark:border-lime-800 dark:text-lime-100',
] as const;

export function districtAreaColorClass(areaKey: string, districtKey: string): string {
  const seed = `${districtKey}|${areaKey}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
  }
  const idx = Math.abs(h) % TRIP_ROUTE_PALETTE_CLASSES.length;
  return TRIP_ROUTE_PALETTE_CLASSES[idx];
}
