export type FilterValue = string | number | null | undefined;

export function cleanFilterValue(value: FilterValue) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function buildFilterHref(
  pathname: string,
  params: Record<string, FilterValue> | URLSearchParams,
  clearKeys: string[] = []
) {
  const next = new URLSearchParams();
  const clear = new Set(clearKeys);
  const entries =
    params instanceof URLSearchParams
      ? Array.from(params.entries())
      : Object.entries(params);

  for (const [key, value] of entries) {
    if (clear.has(key)) continue;
    const clean = cleanFilterValue(value);
    if (clean) next.set(key, clean);
  }

  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
