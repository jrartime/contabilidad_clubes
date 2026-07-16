"use client";

import React, { useState, useTransition, useEffect, useCallback } from "react";
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
import { duplicateNominaAction, updateNominaAction } from "./actions";

type NominaRow = {
  id_contabilidad: number;
  fecha: string | null;
  fecha_pago: string | null;
  personal_id: number | null;
  proveedor_id: number | null;
  programa_id: number | null;
  concepto_id: number | null;
  categoria_id: number | null;
  entidad_id: number | null;
  bruto: number | null;
  coste_empresarial: number | null;
  ss: number | null;
  bruto_imputado: number | null;
  ss_imputado: number | null;
  importe_total: number | null;
  importe_imputado: number | null;
  detalle: string | null;
  // embedded joins (read-only display)
  proveedor?: { proveedor: string } | null;
  programa_ref?: { programa: string } | null;
  categoria_ref?: { categoria: string } | null;
  concepto_ref?: { concepto: string } | null;
  entidad_ref?: { entidad: string } | null;
};

type Option = { id: number; label: string };
type SortKey =
  | "fecha" | "personal" | "proveedor" | "programa"
  | "categoria" | "concepto" | "bruto" | "ss"
  | "importe_total" | "importe_imputado" | "fecha_pago";

type FilterParams = Record<string, string | null | number>;

export default function NominasTable({
  rows: initialRows,
  canEdit,
  personal,
  proveedores,
  programas,
  conceptos,
  categorias,
  entidades,
  filterParams,
  sortKey,
  sortDir,
}: {
  rows: NominaRow[];
  canEdit: boolean;
  personal: { id_personal: number; nombre: string }[];
  proveedores: { id_proveedor: number; proveedor: string }[];
  programas: { id_programa: number; programa: string; anio?: number | null }[];
  conceptos: { id_concepto: number; concepto: string }[];
  categorias: { id_categoria: number; categoria: string }[];
  entidades: { id_entidad: number; entidad: string }[];
  filterParams: FilterParams;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [rows, setRows] = useState<NominaRow[]>(initialRows);

  useEffect(() => { setRows(initialRows); }, [initialRows]);

  // Panel flotante de edición
  const [panelRow, setPanelRow] = useState<NominaRow | null>(null);
  const [panelForm, setPanelForm] = useState<Record<string, string>>({});
  const [panelSaving, setPanelSaving] = useState(false);
  const [panelDuplicating, setPanelDuplicating] = useState(false);

  const openEditPanel = useCallback((r: NominaRow) => {
    setPanelRow(r);
    setPanelForm({
      fecha: r.fecha ?? "",
      fecha_pago: r.fecha_pago ?? "",
      personal_id: r.personal_id != null ? String(r.personal_id) : "",
      proveedor_id: r.proveedor_id != null ? String(r.proveedor_id) : "",
      programa_id: r.programa_id != null ? String(r.programa_id) : "",
      concepto_id: r.concepto_id != null ? String(r.concepto_id) : "",
      categoria_id: r.categoria_id != null ? String(r.categoria_id) : "",
      entidad_id: r.entidad_id != null ? String(r.entidad_id) : "",
      bruto: toDecimalInputValue(r.bruto),
      coste_empresarial: toDecimalInputValue(r.coste_empresarial),
      ss: toDecimalInputValue(r.ss),
      bruto_imputado: toDecimalInputValue(r.bruto_imputado),
      ss_imputado: toDecimalInputValue(r.ss_imputado),
      importe_total: toDecimalInputValue(r.importe_total),
      importe_imputado: toDecimalInputValue(r.importe_imputado),
      detalle: r.detalle ?? "",
    });
  }, []);

  const closeEditPanel = useCallback(() => {
    setPanelRow(null);
    setPanelForm({});
  }, []);

  const savePanelForm = useCallback(() => {
    if (!panelRow) return;
    const toNum = (v: string) => {
      const s = v.trim();
      return s ? parseDecimalToNumber(s) : null;
    };
    setPanelSaving(true);
    updateNominaAction({
      id_contabilidad: panelRow.id_contabilidad,
      fecha: panelForm.fecha || null,
      fecha_pago: panelForm.fecha_pago || null,
      personal_id: panelForm.personal_id ? Number(panelForm.personal_id) : null,
      proveedor_id: panelForm.proveedor_id ? Number(panelForm.proveedor_id) : null,
      programa_id: panelForm.programa_id ? Number(panelForm.programa_id) : null,
      concepto_id: panelForm.concepto_id ? Number(panelForm.concepto_id) : null,
      categoria_id: panelForm.categoria_id ? Number(panelForm.categoria_id) : null,
      entidad_id: panelForm.entidad_id ? Number(panelForm.entidad_id) : null,
      bruto: toNum(panelForm.bruto),
      coste_empresarial: toNum(panelForm.coste_empresarial),
      ss: toNum(panelForm.ss),
      bruto_imputado: toNum(panelForm.bruto_imputado),
      ss_imputado: toNum(panelForm.ss_imputado),
      importe_total: toNum(panelForm.importe_total),
      importe_imputado: toNum(panelForm.importe_imputado),
      detalle: panelForm.detalle || null,
    })
      .then(() => { router.refresh(); closeEditPanel(); })
      .catch((e: unknown) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setPanelSaving(false));
  }, [panelRow, panelForm, router, closeEditPanel]);

  const duplicatePanelRow = useCallback(() => {
    if (!panelRow) return;
    setPanelDuplicating(true);
    duplicateNominaAction(panelRow.id_contabilidad)
      .then(() => {
        router.refresh();
        closeEditPanel();
      })
      .catch((e: unknown) => alert(e instanceof Error ? e.message : String(e)))
      .finally(() => setPanelDuplicating(false));
  }, [panelRow, router, closeEditPanel]);

  // Cerrar panel con Escape
  useEffect(() => {
    if (!panelRow) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeEditPanel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panelRow, closeEditPanel]);

  const disabled = !canEdit || isPending;

  const personalOptions: Option[] = personal.map((p) => ({ id: p.id_personal, label: p.nombre }));
  const proveedorOptions: Option[] = proveedores.map((p) => ({ id: p.id_proveedor, label: p.proveedor }));
  const programaOptions: Option[] = programas.map((p) => ({
    id: p.id_programa,
    label: `${p.anio ? `[${p.anio}] ` : ""}${p.programa}`,
  }));
  const conceptoOptions: Option[] = conceptos.map((c) => ({ id: c.id_concepto, label: c.concepto }));
  const categoriaOptions: Option[] = categorias.map((c) => ({ id: c.id_categoria, label: c.categoria }));
  const entidadOptions: Option[] = entidades.map((e) => ({ id: e.id_entidad, label: e.entidad }));

  const personalById = new Map(personalOptions.map((o) => [o.id, o.label]));
  const proveedorById = new Map(proveedorOptions.map((o) => [o.id, o.label]));
  const programaById = new Map(programaOptions.map((o) => [o.id, o.label]));
  const conceptoById = new Map(conceptoOptions.map((o) => [o.id, o.label]));
  const categoriaById = new Map(categoriaOptions.map((o) => [o.id, o.label]));
  const entidadById = new Map(entidadOptions.map((o) => [o.id, o.label]));

  function save(id_contabilidad: number, patch: Omit<Parameters<typeof updateNominaAction>[0], "id_contabilidad">) {
    startTransition(() => {
      updateNominaAction({ id_contabilidad, ...patch })
        .then(() => router.refresh())
        .catch((e: unknown) => alert(e instanceof Error ? e.message : String(e)));
    });
  }

  function sortHref(col: SortKey) {
    const nextDir = sortKey === col && sortDir === "asc" ? "desc" : "asc";
    return buildFilterHref("/nominas", { ...filterParams, sort: col, dir: nextDir }, []);
  }

  // Auto-cálculo del panel
  const r2 = (n: number) => Math.round(n * 100) / 100;

  function recomputePanel(form: Record<string, string>): Record<string, string> {
    const next = { ...form };
    const bruto = parseDecimalToNumber(form.bruto);
    const coste = parseDecimalToNumber(form.coste_empresarial);

    // SS = coste - bruto si SS está vacío
    let ss = parseDecimalToNumber(form.ss);
    if (!form.ss.trim() && bruto !== null && coste !== null) {
      ss = r2(coste - bruto);
      next.ss = toDecimalInputValue(ss);
    }

    // Bruto imputado = bruto si está vacío
    let brutoImp = parseDecimalToNumber(form.bruto_imputado);
    if (!form.bruto_imputado.trim() && bruto !== null) {
      brutoImp = bruto;
      next.bruto_imputado = toDecimalInputValue(brutoImp);
    }

    // SS imputado = SS si está vacío
    let ssImp = parseDecimalToNumber(form.ss_imputado);
    if (!form.ss_imputado.trim() && ss !== null) {
      ssImp = ss;
      next.ss_imputado = toDecimalInputValue(ssImp);
    }

    // Importe total = bruto + SS (solo si está vacío)
    if (!form.importe_total.trim() && bruto !== null && ss !== null) {
      next.importe_total = toDecimalInputValue(r2(bruto + ss));
    }

    // Importe imputado = bruto_imputado + ss_imputado (solo si está vacío)
    if (!form.importe_imputado.trim() && brutoImp !== null && ssImp !== null) {
      next.importe_imputado = toDecimalInputValue(r2(brutoImp + ssImp));
    }

    return next;
  }

  function recomputeImputado(form: Record<string, string>): Record<string, string> {
    const brutoImp = parseDecimalToNumber(form.bruto_imputado);
    const ssImp = parseDecimalToNumber(form.ss_imputado);
    if (brutoImp !== null && ssImp !== null) {
      return { ...form, importe_imputado: toDecimalInputValue(r2(brutoImp + ssImp)) };
    }
    return form;
  }

  // Estilos reutilizables del panel
  const panelBusy = panelSaving || panelDuplicating;
  const pL: React.CSSProperties = { display: "grid", gap: 4, fontSize: 13, fontWeight: 600 };
  const pI: React.CSSProperties = { padding: "6px 8px", fontSize: 13, borderRadius: 6, border: "1px solid #ddd", width: "100%", boxSizing: "border-box" };

  const thBase: React.CSSProperties = {
    textAlign: "left",
    borderBottom: "1px solid #ddd",
    padding: 8,
    whiteSpace: "nowrap",
    fontSize: 13,
  };

  function sortTh(col: SortKey, label: string, style?: React.CSSProperties) {
    const active = sortKey === col;
    return (
      <th style={{ ...thBase, ...style }}>
        <Link href={sortHref(col)} className="table-sort-button" aria-label={`Ordenar por ${label}`}>
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
        </Link>
      </th>
    );
  }

  const f: React.CSSProperties = {
    height: 28,
    padding: "0 6px",
    fontSize: 12,
    boxSizing: "border-box",
    width: "100%",
  };

  const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #eee", verticalAlign: "middle" };

  function decimalCell(
    id: number,
    field: keyof NominaRow & ("bruto" | "ss" | "importe_total" | "importe_imputado"),
    value: number | null
  ) {
    if (!editMode) return <>{formatDecimal(value ?? 0)}</>;
    return (
      <input
        type="text"
        inputMode="decimal"
        defaultValue={toDecimalInputValue(value)}
        disabled={disabled}
        style={f}
        onBlur={(e) => {
          if (disabled) return;
          const raw = e.currentTarget.value.trim();
          if (!raw) { e.currentTarget.value = toDecimalInputValue(value); return; }
          const next = parseDecimalToNumber(raw);
          if (next === null) { alert(`${field} inválido`); e.currentTarget.value = toDecimalInputValue(value); return; }
          if (next === (value ?? null)) return;
          setRows((prev) => prev.map((x) => x.id_contabilidad === id ? { ...x, [field]: next } : x));
          save(id, { [field]: raw } as any);
        }}
      />
    );
  }

  return (
    <div>
      {/* Toolbar edit mode */}
      {canEdit && (
        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
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
          {isPending && <span style={{ marginLeft: 12, fontSize: 12, opacity: 0.7 }}>Guardando…</span>}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {sortTh("fecha", "Fecha", { width: 110 })}
              {sortTh("personal", "Personal", { minWidth: 140 })}
              {sortTh("proveedor", "Proveedor", { minWidth: 140 })}
              {sortTh("programa", "Programa", { minWidth: 140 })}
              {sortTh("categoria", "Categoria", { width: 120 })}
              {sortTh("concepto", "Concepto", { minWidth: 130 })}
              {sortTh("bruto", "Bruto", { width: 100 })}
              {sortTh("ss", "SS", { width: 100 })}
              {sortTh("importe_total", "Total", { width: 100 })}
              {sortTh("importe_imputado", "Imputado", { width: 100 })}
              {sortTh("fecha_pago", "Pago", { width: 110 })}
              {!editMode && (
                <th style={{ ...thBase, width: 60 }}>Acc.</th>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((r, idx) => {
              const alt = idx % 2 === 1 ? { background: "#f9f9f9" } : undefined;
              return (
                <tr key={r.id_contabilidad} style={alt}>

                  {/* Fecha */}
                  <td style={td}>
                    {editMode ? (
                      <input
                        type="date"
                        defaultValue={toDateInputValue(r.fecha)}
                        disabled={disabled}
                        style={f}
                        onBlur={(e) => {
                          if (disabled) return;
                          const fecha = e.currentTarget.value || null;
                          if (fecha === (r.fecha ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_contabilidad === r.id_contabilidad ? { ...x, fecha } : x));
                          save(r.id_contabilidad, { fecha });
                        }}
                      />
                    ) : (
                      <span style={{ whiteSpace: "nowrap" }}>{formatDateEs(r.fecha)}</span>
                    )}
                  </td>

                  {/* Personal */}
                  <td style={td}>
                    {editMode ? (
                      <select
                        defaultValue={r.personal_id ?? ""}
                        disabled={disabled}
                        style={f}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const personal_id = v ? Number(v) : null;
                          if (personal_id === (r.personal_id ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_contabilidad === r.id_contabilidad ? { ...x, personal_id } : x));
                          save(r.id_contabilidad, { personal_id });
                        }}
                      >
                        <option value="">(sin personal)</option>
                        {personalOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    ) : (
                      personalById.get(Number(r.personal_id)) ?? (r.personal_id ? `id ${r.personal_id}` : "-")
                    )}
                  </td>

                  {/* Proveedor */}
                  <td style={td}>
                    {editMode ? (
                      <select
                        defaultValue={r.proveedor_id ?? ""}
                        disabled={disabled}
                        style={f}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const proveedor_id = v ? Number(v) : null;
                          if (proveedor_id === (r.proveedor_id ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_contabilidad === r.id_contabilidad ? { ...x, proveedor_id } : x));
                          save(r.id_contabilidad, { proveedor_id });
                        }}
                      >
                        <option value="">(sin proveedor)</option>
                        {proveedorOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    ) : (
                      proveedorById.get(Number(r.proveedor_id)) ?? (r.proveedor_id ? `id ${r.proveedor_id}` : "-")
                    )}
                  </td>

                  {/* Programa */}
                  <td style={td}>
                    {editMode ? (
                      <select
                        defaultValue={r.programa_id ?? ""}
                        disabled={disabled}
                        style={f}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const programa_id = v ? Number(v) : null;
                          if (programa_id === (r.programa_id ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_contabilidad === r.id_contabilidad ? { ...x, programa_id } : x));
                          save(r.id_contabilidad, { programa_id });
                        }}
                      >
                        <option value="">(sin programa)</option>
                        {programaOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    ) : (
                      programaById.get(Number(r.programa_id)) ?? (r.programa_id ? `id ${r.programa_id}` : "-")
                    )}
                  </td>

                  {/* Categoria */}
                  <td style={td}>
                    {editMode ? (
                      <select
                        defaultValue={r.categoria_id ?? ""}
                        disabled={disabled}
                        style={f}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const categoria_id = v ? Number(v) : null;
                          if (categoria_id === (r.categoria_id ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_contabilidad === r.id_contabilidad ? { ...x, categoria_id } : x));
                          save(r.id_contabilidad, { categoria_id });
                        }}
                      >
                        <option value="">(sin categoria)</option>
                        {categoriaOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    ) : (
                      categoriaById.get(Number(r.categoria_id)) ?? "-"
                    )}
                  </td>

                  {/* Concepto */}
                  <td style={td}>
                    {editMode ? (
                      <select
                        defaultValue={r.concepto_id ?? ""}
                        disabled={disabled}
                        style={f}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const concepto_id = v ? Number(v) : null;
                          if (concepto_id === (r.concepto_id ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_contabilidad === r.id_contabilidad ? { ...x, concepto_id } : x));
                          save(r.id_contabilidad, { concepto_id });
                        }}
                      >
                        <option value="">(sin concepto)</option>
                        {conceptoOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    ) : (
                      conceptoById.get(Number(r.concepto_id)) ?? (r.concepto_id ? `id ${r.concepto_id}` : "-")
                    )}
                  </td>

                  {/* Bruto */}
                  <td style={{ ...td, textAlign: editMode ? "left" : "right" }}>
                    {decimalCell(r.id_contabilidad, "bruto", r.bruto)}
                  </td>

                  {/* SS */}
                  <td style={{ ...td, textAlign: editMode ? "left" : "right" }}>
                    {decimalCell(r.id_contabilidad, "ss", r.ss)}
                  </td>

                  {/* Total */}
                  <td style={{ ...td, textAlign: editMode ? "left" : "right" }}>
                    {decimalCell(r.id_contabilidad, "importe_total", r.importe_total)}
                  </td>

                  {/* Imputado */}
                  <td style={{ ...td, textAlign: editMode ? "left" : "right" }}>
                    {decimalCell(r.id_contabilidad, "importe_imputado", r.importe_imputado)}
                  </td>

                  {/* Fecha pago */}
                  <td style={td}>
                    {editMode ? (
                      <input
                        type="date"
                        defaultValue={toDateInputValue(r.fecha_pago)}
                        disabled={disabled}
                        style={f}
                        onBlur={(e) => {
                          if (disabled) return;
                          const fecha_pago = e.currentTarget.value || null;
                          if (fecha_pago === (r.fecha_pago ?? null)) return;
                          setRows((prev) => prev.map((x) => x.id_contabilidad === r.id_contabilidad ? { ...x, fecha_pago } : x));
                          save(r.id_contabilidad, { fecha_pago });
                        }}
                      />
                    ) : (
                      <span style={{ whiteSpace: "nowrap" }}>{formatDateEs(r.fecha_pago)}</span>
                    )}
                  </td>

                  {/* Acciones (solo en modo lectura) */}
                  {!editMode && (
                    <td style={td}>
                      {canEdit ? (
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => openEditPanel(r)}
                            className="icon-button tooltip-button"
                            aria-label="Editar nómina"
                          >
                            <Icon name="edit" />
                          </button>
                        </div>
                      ) : (
                        <span style={{ opacity: 0.6 }}>—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={editMode ? 11 : 12} style={{ padding: 12, opacity: 0.8 }}>
                  No hay nóminas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Panel flotante de edición */}
      {panelRow && (
        <>
          <div
            className="drawer-backdrop"
            onClick={closeEditPanel}
            style={{ cursor: "pointer" }}
          />
          <div className="side-drawer">
            <div className="side-drawer-header">
              <div className="side-drawer-title">
                <span>Nóminas</span>
                <h2>Editar nómina #{panelRow.id_contabilidad}</h2>
              </div>
              <button
                type="button"
                onClick={closeEditPanel}
                className="icon-button icon-button-secondary tooltip-button"
                aria-label="Cerrar"
                disabled={panelBusy}
              >
                <Icon name="logout" />
              </button>
            </div>

            <div className="side-drawer-body" style={{ display: "grid", gap: 12 }}>
              {/* Fechas */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={pL}>
                  Fecha (devengo)
                  <input type="date" value={panelForm.fecha} onChange={(e) => setPanelForm((f) => ({ ...f, fecha: e.target.value }))} disabled={panelBusy} style={pI} />
                </label>
                <label style={pL}>
                  Fecha pago
                  <input type="date" value={panelForm.fecha_pago} onChange={(e) => setPanelForm((f) => ({ ...f, fecha_pago: e.target.value }))} disabled={panelBusy} style={pI} />
                </label>
              </div>

              {/* Personal + Proveedor en una fila */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={pL}>
                  Personal
                  <select value={panelForm.personal_id} onChange={(e) => setPanelForm((f) => ({ ...f, personal_id: e.target.value }))} disabled={panelBusy} style={pI}>
                    <option value="">(sin personal)</option>
                    {personalOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
                <label style={pL}>
                  Proveedor
                  <select value={panelForm.proveedor_id} onChange={(e) => setPanelForm((f) => ({ ...f, proveedor_id: e.target.value }))} disabled={panelBusy} style={pI}>
                    <option value="">(sin proveedor)</option>
                    {proveedorOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
              </div>

              {/* Programa + Categoría + Concepto en una fila */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <label style={pL}>
                  Programa
                  <select value={panelForm.programa_id} onChange={(e) => setPanelForm((f) => ({ ...f, programa_id: e.target.value }))} disabled={panelBusy} style={pI}>
                    <option value="">(sin programa)</option>
                    {programaOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
                <label style={pL}>
                  Categoría
                  <select value={panelForm.categoria_id} onChange={(e) => setPanelForm((f) => ({ ...f, categoria_id: e.target.value }))} disabled={panelBusy} style={pI}>
                    <option value="">(sin cat.)</option>
                    {categoriaOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
                <label style={pL}>
                  Concepto
                  <select value={panelForm.concepto_id} onChange={(e) => setPanelForm((f) => ({ ...f, concepto_id: e.target.value }))} disabled={panelBusy} style={pI}>
                    <option value="">(sin conc.)</option>
                    {conceptoOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
              </div>

              {/* Entidad */}
              <label style={pL}>
                Entidad
                <select value={panelForm.entidad_id} onChange={(e) => setPanelForm((f) => ({ ...f, entidad_id: e.target.value }))} disabled={panelBusy} style={pI}>
                  <option value="">(sin entidad)</option>
                  {entidadOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>

              {/* Importes salariales — Bruto + Coste + SS en una fila */}
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.5, marginTop: 4 }}>
                Importes salariales
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <label style={pL}>
                  Bruto
                  <input
                    type="text" inputMode="decimal" value={panelForm.bruto} disabled={panelBusy} style={pI}
                    onChange={(e) => setPanelForm((f) => ({ ...f, bruto: e.target.value }))}
                    onBlur={() => setPanelForm((f) => recomputePanel(f))}
                  />
                </label>
                <label style={pL}>
                  Coste empresarial
                  <input
                    type="text" inputMode="decimal" value={panelForm.coste_empresarial} disabled={panelBusy} style={pI}
                    onChange={(e) => setPanelForm((f) => ({ ...f, coste_empresarial: e.target.value }))}
                    onBlur={() => setPanelForm((f) => recomputePanel(f))}
                  />
                </label>
                <label style={pL}>
                  SS
                  <input
                    type="text" inputMode="decimal" value={panelForm.ss} disabled={panelBusy} style={pI}
                    onChange={(e) => setPanelForm((f) => ({ ...f, ss: e.target.value }))}
                  />
                </label>
              </div>

              {/* Imputados */}
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.5, marginTop: 4 }}>
                Importes imputados al programa
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <label style={pL}>
                  Bruto imputado
                  <input
                    type="text" inputMode="decimal" value={panelForm.bruto_imputado} disabled={panelBusy} style={pI}
                    onChange={(e) => setPanelForm((f) => recomputeImputado({ ...f, bruto_imputado: e.target.value }))}
                  />
                </label>
                <label style={pL}>
                  SS imputado
                  <input
                    type="text" inputMode="decimal" value={panelForm.ss_imputado} disabled={panelBusy} style={pI}
                    onChange={(e) => setPanelForm((f) => recomputeImputado({ ...f, ss_imputado: e.target.value }))}
                  />
                </label>
                <label style={pL}>
                  Importe total
                  <input type="text" inputMode="decimal" value={panelForm.importe_total} disabled={panelBusy} style={{ ...pI, background: "#f8f8f8" }}
                    onChange={(e) => setPanelForm((f) => ({ ...f, importe_total: e.target.value }))}
                  />
                </label>
                <label style={pL}>
                  Importe imputado
                  <input type="text" inputMode="decimal" value={panelForm.importe_imputado} disabled={panelBusy} style={{ ...pI, background: "#f8f8f8" }}
                    onChange={(e) => setPanelForm((f) => ({ ...f, importe_imputado: e.target.value }))}
                  />
                </label>
              </div>

              {/* Detalle */}
              <label style={pL}>
                Detalle
                <input type="text" value={panelForm.detalle} onChange={(e) => setPanelForm((f) => ({ ...f, detalle: e.target.value }))} disabled={panelBusy} style={pI} />
              </label>
            </div>

            <div className="drawer-actions">
              <button
                type="button"
                onClick={savePanelForm}
                disabled={panelBusy}
                className="icon-button tooltip-button"
                aria-label={panelDuplicating ? "Duplicando..." : panelSaving ? "Guardando..." : "Guardar cambios"}
              >
                <Icon name="save" />
              </button>
              <button
                type="button"
                onClick={duplicatePanelRow}
                disabled={panelBusy}
                className="icon-button icon-button-secondary tooltip-button"
                aria-label={panelDuplicating ? "Duplicando..." : "Duplicar nomina sin fechas"}
              >
                <Icon name="duplicate" />
              </button>
              <button
                type="button"
                onClick={closeEditPanel}
                disabled={panelBusy}
                className="icon-button icon-button-secondary tooltip-button"
                aria-label="Cancelar"
              >
                <Icon name="logout" />
              </button>
              {panelBusy && (
                <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4 }}>
                  {panelDuplicating ? "Duplicando..." : "Guardando..."}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
