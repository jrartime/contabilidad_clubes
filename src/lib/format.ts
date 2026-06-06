export function toDateInputValue(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return "";
}

export function formatDateEs(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "-";
  const isoMatch = /^\d{4}-\d{2}-\d{2}/.exec(s);
  const iso = isoMatch ? isoMatch[0] : s.slice(0, 10);
  const parts = iso.split("-");
  if (parts.length !== 3) return s;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function toDecimalInputValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value).replace(/\./g, ",");
}

export function formatDecimal(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCsvNumber(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(2).replace(".", ",");
}

export function formatBytes(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
