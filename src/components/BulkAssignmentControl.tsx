"use client";

import { useState, useTransition } from "react";

export type BulkField = {
  value: string;
  label: string;
  type: "text" | "date" | "decimal" | "select";
  options?: { value: number; label: string }[];
};

export function BulkAssignmentControl({ active, setActive, selectedCount, fields, onExecute }: {
  active: boolean;
  setActive: (active: boolean) => void;
  selectedCount: number;
  fields: BulkField[];
  onExecute: (field: string, value: string | number | null) => Promise<{ updated: number; error?: string }>;
}) {
  const [field, setField] = useState("");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const config = fields.find((item) => item.value === field);

  if (!active) return <button type="button" className="app-action-link app-action-link-secondary" onClick={() => setActive(true)}>Asignación masiva</button>;

  return <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f0f7ff", border: "1px solid #c3d9f5", borderRadius: 8, flexWrap: "wrap" }}>
    <strong style={{ fontSize: 13 }}>{selectedCount} seleccionado(s)</strong>
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>Campo:
      <select value={field} onChange={(e) => { setField(e.target.value); setValue(""); setMessage(""); }} style={{ height: 34 }}>
        <option value="">Selecciona campo</option>
        {fields.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
    {config ? <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>Nuevo valor:
      {config.type === "select" ? <select value={value} onChange={(e) => setValue(e.target.value)} style={{ height: 34, minWidth: 180 }}><option value="">(sin valor)</option>{config.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={config.type === "date" ? "date" : "text"} inputMode={config.type === "decimal" ? "decimal" : undefined} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Vacío para borrar" style={{ height: 34, minWidth: 180 }} />}
    </label> : null}
    <button type="button" disabled={pending || !field || !selectedCount} onClick={() => {
      if (!config || !selectedCount) return;
      const parsed = config.type === "select" && value ? Number(value) : (value.trim() || null);
      const label = config.options?.find((o) => o.value === parsed)?.label ?? parsed ?? "(vacío)";
      if (!confirm(`¿Cambiar ${config.label} a "${label}" en ${selectedCount} registro(s)?`)) return;
      startTransition(async () => {
        const result = await onExecute(field, parsed);
        setMessage(result.error ? `Error: ${result.error}` : `✓ ${result.updated} registro(s) actualizados`);
      });
    }} style={{ height: 34 }}>{pending ? "Guardando…" : "Ejecutar"}</button>
    <button type="button" className="app-action-link app-action-link-secondary" onClick={() => { setActive(false); setField(""); setValue(""); setMessage(""); }}>Cancelar</button>
    {message ? <span style={{ fontSize: 13, fontWeight: 650, color: message.startsWith("✓") ? "#1a6b2e" : "#b42318" }}>{message}</span> : null}
  </div>;
}
