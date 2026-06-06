export function normalizeDecimalString(input: unknown): string {
  const s = String(input ?? "").trim();
  if (!s) return "";
  const compact = s.replace(/\s+/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      return compact.replace(/\./g, "").replace(",", ".");
    }
    return compact.replace(/,/g, "");
  }

  if (lastComma !== -1) {
    return compact.replace(/\./g, "").replace(",", ".");
  }

  if (lastDot !== -1) {
    const parts = compact.split(".");
    if (parts.length === 2) return compact.replace(/,/g, "");
    const decimal = parts.pop() ?? "";
    const integerPart = parts.join("");
    return `${integerPart}.${decimal}`.replace(/,/g, "");
  }

  return compact.replace(/,/g, "");
}

export function parseDecimalToNumber(input: unknown): number | null {
  const normalized = normalizeDecimalString(input);
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
