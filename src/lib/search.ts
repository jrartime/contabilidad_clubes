export function normalizeSearchText(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function matchesGlobalSearch(query: string, values: unknown[]): boolean {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const searchable = normalizeSearchText(values.join(" "));
  return terms.every((term) => searchable.includes(term));
}
