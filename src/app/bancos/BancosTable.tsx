"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { buildFilterHref } from "@/lib/filters";
import {
  formatDateEs,
  formatDecimal,
  toDateInputValue,
  toDecimalInputValue,
} from "@/lib/format";
import { parseDecimalToNumber } from "@/lib/decimal";
import { asignarProgramaMasivoAction, updateBancoAction } from "./actions";

type Row = {
  id_banco: number;
  fecha_operativa: string | null;
  fecha_valor: string | null;
  detalle: string | null;
  referencia: string | null;
  referencia_1: string | null;
  referencia_2: string | null;
  categoria: string | null;
  programa_id: number | null;
  concepto_id: number | null;
  orden: number | null;
  debe: number | null;
  haber: number | null;
  saldo: number | null;
  importe: number | null;
};

type BancosSortKey = "fecha_operativa" | "detalle" | "debe" | "haber" | "saldo" | "importe";

type FilterParams = {
  programa_id: string | null;
  concepto_id: string;
  fecha_operativa_desde: string;
  fecha_operativa_hasta: string;
  sort: string;
  dir: string;
};

function money(value: number | null) {
  return value === null || value === undefined ? "-" : formatDecimal(value);
}

export default function BancosTable({
  rows: initialRows,
  canEdit,
  programas,
  conceptos,
  filterParams,
  sortKey,
  sortDir,
}: {
  rows: Row[];
  canEdit: boolean;
  programas: { id_programa: number; programa: string; anio?: number | null }[];
  conceptos: { id_concepto: number; concepto: string }[];
  filterParams: FilterParams;
  sortKey: BancosSortKey;
  sortDir: "asc" | "desc";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estado de edición tipo Excel
  const [editMode, setEditMode] = useState(false);

  // Estado de asignación masiva
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkProgramaId, setBulkProgramaId] = useState<string>("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // Filas con estado local (para reflejar el cambio de programa inmediatamente)
  const [rows, setRows] = useState<Row[]>(initialRows);
  // Sincronizar si el padre pasa nuevas filas (cambio de filtro/navegación)
  React.useEffect(() => { setRows(initialRows); }, [initialRows]);

  const programaById = new Map(
    programas.map((p) => [
      Number(p.id_programa),
      `${p.anio ? `[${p.anio}] ` : ""}${p.programa}`,
    ])
  );
  const conceptoById = new Map(
    conceptos.map((c) => [Number(c.id_concepto), c.concepto])
  );

  // Sort hrefs (URL-based, preservan filtros)
  function sortHref(col: BancosSortKey) {
    const nextDir = sortKey === col && sortDir === "desc" ? "asc" : "desc";
    return buildFilterHref("/bancos", { ...filterParams, sort: col, dir: nextDir }, []);
  }

  const fieldStyle: React.CSSProperties = {
    height: 28,
    padding: "0 6px",
    fontSize: 12,
    boxSizing: "border-box",
    width: "100%",
  };

  const disabled = !canEdit || isPending;

  function save(id_banco: number, patch: Omit<Parameters<typeof updateBancoAction>[0], "id_banco">) {
    startTransition(() => {
      updateBancoAction({ id_banco, ...patch })
        .then(() => router.refresh())
        .catch((e: unknown) => alert(e instanceof Error ? e.message : String(e)));
    });
  }

  const thBase: React.CSSProperties = { borderBottom: "1px solid #ddd", padding: 8, whiteSpace: "nowrap" };

  function sortTh(col: BancosSortKey, label: string, style?: React.CSSProperties) {
    const active = sortKey === col;
    return (
      <th style={{ ...thBase, textAlign: "left", ...style }}>
        <Link href={sortHref(col)} className="table-sort-button" aria-label={`Ordenar por ${label}`}>
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
        </Link>
      </th>
    );
  }

  function sortThRight(col: BancosSortKey, label: string, style?: React.CSSProperties) {
    const active = sortKey === col;
    return (
      <th style={{ ...thBase, textAlign: "right", ...style }}>
        <Link href={sortHref(col)} className="table-sort-button" style={{ justifyContent: "flex-end" }} aria-label={`Ordenar por ${label}`}>
          <span aria-hidden="true">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
          <span>{label}</span>
        </Link>
      </th>
    );
  }

  // Selección
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id_banco)));
    }
  }

  function toggleRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Ejecutar asignación masiva
  function ejecutarAsignacion() {
    if (!selectedIds.size) return;
    const ids = Array.from(selectedIds);
    const programaIdNum = bulkProgramaId ? Number(bulkProgramaId) : null;
    const programaNombre = programaIdNum
      ? (programaById.get(programaIdNum) ?? `id ${programaIdNum}`)
      : "(sin programa)";

    if (!confirm(
      `¿Asignar el programa "${programaNombre}" a ${ids.length} movimiento(s) seleccionado(s)?`
    )) return;

    startTransition(async () => {
      const result = await asignarProgramaMasivoAction(ids, programaIdNum);
      if (result.error) {
        setBulkResult(`Error: ${result.error}`);
      } else {
        // Actualizar filas localmente
        setRows((prev) =>
          prev.map((r) =>
            selectedIds.has(r.id_banco)
              ? { ...r, programa_id: programaIdNum }
              : r
          )
        );
        setBulkResult(`✓ ${result.updated} movimiento(s) actualizados`);
        setSelectedIds(new Set());
        router.refresh();
      }
    });
  }

  function cancelarBulk() {
    setBulkMode(false);
    setSelectedIds(new Set());
    setBulkProgramaId("");
    setBulkResult(null);
  }

  return (
    <div>
      {/* Barra de herramientas */}
      {canEdit && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Botón modo edición */}
          <button
            type="button"
            onClick={() => { setEditMode((v) => !v); if (bulkMode) setBulkMode(false); }}
            className={editMode ? "app-action-link" : "app-action-link app-action-link-secondary"}
            style={{ gap: 8 }}
          >
            <svg className="button-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            {editMode ? "Salir del modo edición" : "Modo edición (Excel)"}
          </button>

          {isPending && <span style={{ fontSize: 12, opacity: 0.7 }}>Guardando…</span>}

          {/* Botón asignación masiva / panel bulk */}
          {!editMode && (bulkMode ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: "#f0f7ff",
              border: "1px solid #c3d9f5",
              borderRadius: 8,
              flexWrap: "wrap",
            }}>
              {/* Seleccionar todos */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                />
                {selectedIds.size > 0 ? `${selectedIds.size} seleccionado(s)` : "Seleccionar todos"}
              </label>

              <div style={{ width: 1, height: 24, background: "#c3d9f5" }} />

              {/* Selector de programa */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 650 }}>
                <span style={{ whiteSpace: "nowrap" }}>Programa:</span>
                <select
                  value={bulkProgramaId}
                  onChange={(e) => setBulkProgramaId(e.currentTarget.value)}
                  style={{ minWidth: 200, height: 34, padding: "0 8px", fontSize: 13 }}
                >
                  <option value="">(sin programa)</option>
                  {programas.map((p) => (
                    <option key={p.id_programa} value={p.id_programa}>
                      {p.anio ? `[${p.anio}] ` : ""}{p.programa}
                    </option>
                  ))}
                </select>
              </label>

              {/* Ejecutar */}
              <button
                type="button"
                onClick={ejecutarAsignacion}
                disabled={isPending || selectedIds.size === 0}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 16px",
                  height: 34,
                  borderRadius: 6,
                  background: selectedIds.size > 0 ? "var(--primary)" : "#ccc",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  border: 0,
                  cursor: selectedIds.size > 0 ? "pointer" : "not-allowed",
                  minHeight: 34,
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? "Guardando…" : "Ejecutar"}
              </button>

              {/* Cancelar */}
              <button
                type="button"
                onClick={cancelarBulk}
                disabled={isPending}
                className="app-action-link app-action-link-secondary"
                style={{ height: 34, fontSize: 13 }}
              >
                Cancelar
              </button>

              {/* Resultado */}
              {bulkResult && (
                <span style={{ fontSize: 13, color: bulkResult.startsWith("✓") ? "#1a6b2e" : "#b93a48", fontWeight: 650 }}>
                  {bulkResult}
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setBulkMode(true); setBulkResult(null); }}
              className="app-action-link app-action-link-secondary"
              style={{ gap: 8 }}
            >
              <svg className="button-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="4" height="4" rx="1" />
                <rect x="3" y="11" width="4" height="4" rx="1" />
                <rect x="3" y="17" width="4" height="4" rx="1" />
                <line x1="10" y1="7" x2="21" y2="7" />
                <line x1="10" y1="13" x2="21" y2="13" />
                <line x1="10" y1="19" x2="21" y2="19" />
              </svg>
              Asignación masiva de programa
            </button>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {/* Columna checkbox en modo bulk */}
              {bulkMode && (
                <th style={{ ...thBase, width: 40, textAlign: "center" }} />
              )}
              {!editMode && <th style={{ ...thBase, textAlign: "left", width: 90 }}>Acciones</th>}
              {sortTh("fecha_operativa", "Fecha", { width: 120 })}
              {sortTh("detalle", "Detalle", { minWidth: 260 })}
              <th style={{ ...thBase, textAlign: "left", width: 160 }}>Referencia</th>
              <th style={{ ...thBase, textAlign: "left", width: 180 }}>Programa</th>
              <th style={{ ...thBase, textAlign: "left", width: 160 }}>Concepto</th>
              {sortThRight("debe", "Debe", { width: 110 })}
              {sortThRight("haber", "Haber", { width: 110 })}
              {sortThRight("importe", "Importe", { width: 110 })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isSelected = selectedIds.has(row.id_banco);
              return (
                <tr
                  key={row.id_banco}
                  style={{ background: isSelected ? "#eef5ff" : undefined, cursor: bulkMode ? "pointer" : undefined }}
                  onClick={bulkMode ? () => toggleRow(row.id_banco) : undefined}
                >
                  {/* Checkbox bulk */}
                  {bulkMode && (
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "center" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(row.id_banco)}
                        style={{ width: 16, height: 16, accentColor: "var(--primary)", cursor: "pointer" }}
                      />
                    </td>
                  )}

                  {/* Acción editar (solo modo lectura) */}
                  {!editMode && (
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}
                      onClick={bulkMode ? (e) => e.stopPropagation() : undefined}
                    >
                      {canEdit ? (
                        <Link
                          href={`${buildFilterHref("/bancos", { ...filterParams, edit: row.id_banco }, [])}#form`}
                          className="app-action-link"
                          style={{ gap: 6 }}
                          aria-label="Editar movimiento"
                        >
                          <Icon name="edit" />
                          Editar
                        </Link>
                      ) : (
                        <span style={{ opacity: 0.6 }}>-</span>
                      )}
                    </td>
                  )}

                  {/* Fecha operativa */}
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                    {editMode ? (
                      <input
                        type="date"
                        defaultValue={toDateInputValue(row.fecha_operativa)}
                        disabled={disabled}
                        style={fieldStyle}
                        onBlur={(e) => {
                          if (disabled) return;
                          const fecha_operativa = e.currentTarget.value || null;
                          if (fecha_operativa === (row.fecha_operativa ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_banco === row.id_banco ? { ...x, fecha_operativa } : x));
                          save(row.id_banco, { fecha_operativa });
                        }}
                      />
                    ) : formatDateEs(row.fecha_operativa)}
                  </td>

                  {/* Detalle */}
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                    {editMode ? (
                      <input
                        type="text"
                        defaultValue={row.detalle ?? ""}
                        disabled={disabled}
                        style={fieldStyle}
                        onBlur={(e) => {
                          if (disabled) return;
                          const detalle = e.currentTarget.value.trim() || null;
                          if (detalle === (row.detalle ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_banco === row.id_banco ? { ...x, detalle } : x));
                          save(row.id_banco, { detalle });
                        }}
                      />
                    ) : (
                      <>
                        <div style={{ fontWeight: 700 }}>{row.detalle ?? "-"}</div>
                        <div style={{ opacity: 0.65, fontSize: 12 }}>
                          id: {row.id_banco}
                          {row.orden !== null && row.orden !== undefined ? ` - orden: ${row.orden}` : ""}
                          {row.referencia_1 ? ` - ref. 1: ${row.referencia_1}` : ""}
                          {row.referencia_2 ? ` - ref. 2: ${row.referencia_2}` : ""}
                        </div>
                      </>
                    )}
                  </td>

                  {/* Referencia */}
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                    {editMode ? (
                      <input
                        type="text"
                        defaultValue={row.referencia ?? ""}
                        disabled={disabled}
                        style={fieldStyle}
                        onBlur={(e) => {
                          if (disabled) return;
                          const referencia = e.currentTarget.value.trim() || null;
                          if (referencia === (row.referencia ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_banco === row.id_banco ? { ...x, referencia } : x));
                          save(row.id_banco, { referencia });
                        }}
                      />
                    ) : (row.referencia ?? "-")}
                  </td>

                  {/* Programa */}
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                    {editMode ? (
                      <select
                        defaultValue={row.programa_id ?? ""}
                        disabled={disabled}
                        style={fieldStyle}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const programa_id = v ? Number(v) : null;
                          if (programa_id === (row.programa_id ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_banco === row.id_banco ? { ...x, programa_id } : x));
                          save(row.id_banco, { programa_id });
                        }}
                      >
                        <option value="">(sin programa)</option>
                        {programas.map((p) => (
                          <option key={p.id_programa} value={p.id_programa}>
                            {p.anio ? `[${p.anio}] ` : ""}{p.programa}
                          </option>
                        ))}
                      </select>
                    ) : (row.programa_id ? programaById.get(Number(row.programa_id)) ?? row.programa_id : "-")}
                  </td>

                  {/* Concepto */}
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee" }}>
                    {editMode ? (
                      <select
                        defaultValue={row.concepto_id ?? ""}
                        disabled={disabled}
                        style={fieldStyle}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const concepto_id = v ? Number(v) : null;
                          if (concepto_id === (row.concepto_id ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_banco === row.id_banco ? { ...x, concepto_id } : x));
                          save(row.id_banco, { concepto_id });
                        }}
                      >
                        <option value="">(sin concepto)</option>
                        {conceptos.map((c) => (
                          <option key={c.id_concepto} value={c.id_concepto}>{c.concepto}</option>
                        ))}
                      </select>
                    ) : (row.concepto_id ? conceptoById.get(Number(row.concepto_id)) ?? row.concepto_id : "-")}
                  </td>

                  {/* Debe */}
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee", textAlign: editMode ? "left" : "right" }}>
                    {editMode ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={toDecimalInputValue(row.debe)}
                        disabled={disabled}
                        style={fieldStyle}
                        onBlur={(e) => {
                          if (disabled) return;
                          const raw = e.currentTarget.value.trim();
                          if (!raw) { e.currentTarget.value = toDecimalInputValue(row.debe); return; }
                          const next = parseDecimalToNumber(raw);
                          if (next === null) { alert("Importe debe inválido"); e.currentTarget.value = toDecimalInputValue(row.debe); return; }
                          if (next === (row.debe ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_banco === row.id_banco ? { ...x, debe: next } : x));
                          save(row.id_banco, { debe: raw });
                        }}
                      />
                    ) : money(row.debe)}
                  </td>

                  {/* Haber */}
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee", textAlign: editMode ? "left" : "right" }}>
                    {editMode ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={toDecimalInputValue(row.haber)}
                        disabled={disabled}
                        style={fieldStyle}
                        onBlur={(e) => {
                          if (disabled) return;
                          const raw = e.currentTarget.value.trim();
                          if (!raw) { e.currentTarget.value = toDecimalInputValue(row.haber); return; }
                          const next = parseDecimalToNumber(raw);
                          if (next === null) { alert("Importe haber inválido"); e.currentTarget.value = toDecimalInputValue(row.haber); return; }
                          if (next === (row.haber ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_banco === row.id_banco ? { ...x, haber: next } : x));
                          save(row.id_banco, { haber: raw });
                        }}
                      />
                    ) : money(row.haber)}
                  </td>

                  {/* Importe */}
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #eee", textAlign: editMode ? "left" : "right" }}>
                    {editMode ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        defaultValue={toDecimalInputValue(row.importe)}
                        disabled={disabled}
                        style={fieldStyle}
                        onBlur={(e) => {
                          if (disabled) return;
                          const raw = e.currentTarget.value.trim();
                          if (!raw) { e.currentTarget.value = toDecimalInputValue(row.importe); return; }
                          const next = parseDecimalToNumber(raw);
                          if (next === null) { alert("Importe inválido"); e.currentTarget.value = toDecimalInputValue(row.importe); return; }
                          if (next === (row.importe ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_banco === row.id_banco ? { ...x, importe: next } : x));
                          save(row.id_banco, { importe: raw });
                        }}
                      />
                    ) : money(row.importe)}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={editMode ? 8 : bulkMode ? 10 : 9} style={{ padding: 12, opacity: 0.8 }}>
                  No hay movimientos todavia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
