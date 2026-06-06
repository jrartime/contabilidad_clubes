"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { updateContabilidadAction } from "./actions";
import { parseDecimalToNumber } from "@/lib/decimal";
import { toDateInputValue, toDecimalInputValue } from "@/lib/format";

type Row = {
  id_contabilidad: number;
  fecha: string | null;
  fecha_pago: string | null;
  numero_factura: string | null;
  importe_total: number | null;
  importe_imputado: number | null;
  tipo_id: number | null;
  proveedor_id: number | null;
  personal_id: number | null;
  categoria_id: number | null;
  concepto_id: number | null;
  programa_id: number | null;
};

type Option = { id: number; label: string };
type SortKey =
  | "fecha"
  | "tipo"
  | "proveedor"
  | "personal"
  | "numero_factura"
  | "importe_total"
  | "importe_imputado"
  | "fecha_pago";
type SortState = { key: SortKey; direction: "asc" | "desc" };

export default function ContabilidadTable({
  initialRows,
  canEdit,
  tipos,
  proveedores,
  personal,
  categorias,
  conceptos,
  programas,
  clubId,
  programaFilterValue,
  proveedorFilterValue,
  limitValue,
  duplicateAsientoAction,
}: {
  initialRows: Row[];
  canEdit: boolean;
  tipos: { id_tipo: number; tipo: string }[];
  proveedores: { id_proveedor: number; proveedor: string }[];
  personal: { id_personal: number; nombre: string }[];
  categorias: { id_categoria: number; categoria: string }[];
  conceptos: { id_concepto: number; concepto: string }[];
  programas: { id_programa: number; programa: string; anio?: number | null }[];
  clubId: number;
  programaFilterValue: string | null;
  proveedorFilterValue: string | null;
  limitValue: string | null;
  duplicateAsientoAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [sort, setSort] = useState<SortState>({ key: "fecha", direction: "desc" });

  const disabled = !canEdit || isPending;

  const fieldStyle: React.CSSProperties = {
    height: 30,
    minHeight: 30,
    padding: "0 8px",
    fontSize: 13,
    boxSizing: "border-box",
    width: "100%",
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "left",
    borderBottom: "1px solid #ddd",
    padding: 8,
    whiteSpace: "nowrap",
    fontSize: 13,
  };

  const tdStyle: React.CSSProperties = {
    padding: 8,
    borderBottom: "1px solid #eee",
    verticalAlign: "top",
  };
  const tdTopStyle: React.CSSProperties = {
    ...tdStyle,
    paddingBottom: 4,
    borderBottom: 0,
  };
  const tdBottomStyle: React.CSSProperties = {
    ...tdStyle,
    paddingTop: 4,
    borderBottom: 0,
  };
  const tdBottomLastStyle: React.CSSProperties = {
    ...tdBottomStyle,
    borderBottom: "2px solid #ddd",
  };

  const tipoOptions: Option[] = (tipos ?? []).map((t) => ({
    id: t.id_tipo,
    label: t.tipo,
  }));
  const proveedorOptions: Option[] = (proveedores ?? []).map((p) => ({
    id: p.id_proveedor,
    label: p.proveedor,
  }));
  const personalOptions: Option[] = (personal ?? []).map((p) => ({
    id: p.id_personal,
    label: p.nombre,
  }));
  const categoriaOptions: Option[] = (categorias ?? []).map((c) => ({
    id: c.id_categoria,
    label: c.categoria,
  }));
  const conceptoOptions: Option[] = (conceptos ?? []).map((c) => ({
    id: c.id_concepto,
    label: c.concepto,
  }));
  const programaOptions: Option[] = (programas ?? []).map((p) => ({
    id: p.id_programa,
    label: `${p.anio ? `[${p.anio}] ` : ""}${p.programa}`.trim(),
  }));
  const sortedRows = React.useMemo(() => {
    const tipoLabelById = new Map((tipos ?? []).map((option) => [option.id_tipo, option.tipo]));
    const proveedorLabelById = new Map(
      (proveedores ?? []).map((option) => [option.id_proveedor, option.proveedor])
    );
    const personalLabelById = new Map(
      (personal ?? []).map((option) => [option.id_personal, option.nombre])
    );

    return [...rows].sort((a, b) => {
      function value(row: Row) {
        switch (sort.key) {
          case "tipo":
            return tipoLabelById.get(Number(row.tipo_id)) ?? "";
          case "proveedor":
            return proveedorLabelById.get(Number(row.proveedor_id)) ?? "";
          case "personal":
            return personalLabelById.get(Number(row.personal_id)) ?? "";
          default:
            return row[sort.key];
        }
      }

      const av = value(a);
      const bv = value(b);
      let result = 0;

      if (sort.key === "importe_total" || sort.key === "importe_imputado") {
        result = Number(av ?? 0) - Number(bv ?? 0);
      } else {
        result = String(av ?? "").localeCompare(String(bv ?? ""), "es", {
          sensitivity: "base",
        });
      }

      return sort.direction === "asc" ? result : -result;
    });
  }, [personal, proveedores, rows, sort, tipos]);

  function save(id_contabilidad: number, patch: any) {
    startTransition(() => {
      updateContabilidadAction({ id_contabilidad, ...patch })
        .then(() => router.refresh())
        .catch((e) => alert(e.message || String(e)));
    });
  }

  function renderFilterInputs() {
    return (
      <>
        {programaFilterValue ? (
          <input type="hidden" name="programa_id_filter" value={programaFilterValue} />
        ) : null}
        {proveedorFilterValue ? (
          <input type="hidden" name="proveedor_id_filter" value={proveedorFilterValue} />
        ) : null}
        {limitValue ? <input type="hidden" name="limit" value={limitValue} /> : null}
      </>
    );
  }

  function setSortKey(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  function renderSortHeader({
    sortKey,
    label,
    style,
  }: {
    sortKey: SortKey;
    label: string;
    style?: React.CSSProperties;
  }) {
    const active = sort.key === sortKey;
    return (
      <th style={{ ...headerStyle, ...style }}>
        <button
          type="button"
          onClick={() => setSortKey(sortKey)}
          className="table-sort-button"
          aria-label={`Ordenar por ${label}`}
        >
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
        </button>
      </th>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        {isPending && <span style={{ fontSize: 12, opacity: 0.7 }}>Guardando...</span>}
        {!canEdit && (
          <span style={{ fontSize: 12, opacity: 0.7, marginLeft: "auto" }}>
            No tienes permisos para editar.
          </span>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {renderSortHeader({ sortKey: "fecha", label: "Fecha", style: { width: 120 } })}
            {renderSortHeader({ sortKey: "tipo", label: "Tipo", style: { width: 160 } })}
            {renderSortHeader({ sortKey: "proveedor", label: "Proveedor", style: { width: 220 } })}
            {renderSortHeader({ sortKey: "personal", label: "Personal", style: { width: 220 } })}
            {renderSortHeader({ sortKey: "numero_factura", label: "N. factura", style: { width: 150 } })}
            {renderSortHeader({ sortKey: "importe_total", label: "Total", style: { width: 130 } })}
            {renderSortHeader({ sortKey: "importe_imputado", label: "Imputado", style: { width: 130 } })}
            {renderSortHeader({ sortKey: "fecha_pago", label: "Pago", style: { width: 150 } })}
          </tr>
        </thead>

        <tbody>
          {sortedRows.map((r, idx) => {
            const isAlt = idx % 2 === 1;
            const rowStyle = isAlt ? { background: "#f1f1f1" } : undefined;
            return (
            <React.Fragment key={r.id_contabilidad}>
              <tr style={rowStyle}>
                <td style={tdTopStyle}>
                  <input
                    type="date"
                    defaultValue={toDateInputValue(r.fecha)}
                    disabled={disabled}
                    style={fieldStyle}
                    onBlur={(e) => {
                      if (disabled) return;
                      const fecha = e.currentTarget.value || null;
                      if (fecha === (r.fecha ?? null)) return;
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id_contabilidad === r.id_contabilidad ? { ...x, fecha } : x
                        )
                      );
                      save(r.id_contabilidad, { fecha });
                    }}
                  />
                </td>

                <td style={tdTopStyle}>
                  <select
                    defaultValue={r.tipo_id ?? ""}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => {
                      if (disabled) return;
                      const v = e.currentTarget.value;
                      const tipo_id = v ? Number(v) : null;
                      if (tipo_id === (r.tipo_id ?? null)) return;
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id_contabilidad === r.id_contabilidad ? { ...x, tipo_id } : x
                        )
                      );
                      save(r.id_contabilidad, { tipo_id });
                    }}
                  >
                    <option value="">(sin tipo)</option>
                    {tipoOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={tdTopStyle}>
                  <select
                    defaultValue={r.proveedor_id ?? ""}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => {
                      if (disabled) return;
                      const v = e.currentTarget.value;
                      const proveedor_id = v ? Number(v) : null;
                      if (proveedor_id === (r.proveedor_id ?? null)) return;
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id_contabilidad === r.id_contabilidad ? { ...x, proveedor_id } : x
                        )
                      );
                      save(r.id_contabilidad, { proveedor_id });
                    }}
                  >
                    <option value="">(sin proveedor)</option>
                    {proveedorOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={tdTopStyle}>
                  <select
                    defaultValue={r.personal_id ?? ""}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => {
                      if (disabled) return;
                      const v = e.currentTarget.value;
                      const personal_id = v ? Number(v) : null;
                      if (personal_id === (r.personal_id ?? null)) return;
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id_contabilidad === r.id_contabilidad ? { ...x, personal_id } : x
                        )
                      );
                      save(r.id_contabilidad, { personal_id });
                    }}
                  >
                    <option value="">(sin personal)</option>
                    {personalOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td style={tdTopStyle}>
                  <input
                    type="text"
                    defaultValue={r.numero_factura ?? ""}
                    disabled={disabled}
                    style={fieldStyle}
                    onBlur={(e) => {
                      if (disabled) return;
                      const numero_factura = e.currentTarget.value.trim() || null;
                      if (numero_factura === (r.numero_factura ?? null)) return;
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id_contabilidad === r.id_contabilidad
                            ? { ...x, numero_factura }
                            : x
                        )
                      );
                      save(r.id_contabilidad, { numero_factura });
                    }}
                  />
                </td>

                <td style={tdTopStyle}>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={toDecimalInputValue(r.importe_total)}
                    disabled={disabled}
                    style={fieldStyle}
                    onBlur={(e) => {
                      if (disabled) return;
                      const raw = e.currentTarget.value.trim();
                      if (!raw) {
                        e.currentTarget.value = toDecimalInputValue(r.importe_total);
                        return;
                      }
                      const next = parseDecimalToNumber(raw);
                      if (next === null) {
                        alert("Importe total invalido.");
                        e.currentTarget.value = toDecimalInputValue(r.importe_total);
                        return;
                      }
                      if (next === (r.importe_total ?? null)) return;
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id_contabilidad === r.id_contabilidad
                            ? { ...x, importe_total: next }
                            : x
                        )
                      );
                      save(r.id_contabilidad, { importe_total: raw });
                    }}
                  />
                </td>

                <td style={tdTopStyle}>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={toDecimalInputValue(r.importe_imputado)}
                    disabled={disabled}
                    style={fieldStyle}
                    onBlur={(e) => {
                      if (disabled) return;
                      const raw = e.currentTarget.value.trim();
                      if (!raw) {
                        e.currentTarget.value = toDecimalInputValue(r.importe_imputado);
                        return;
                      }
                      const next = parseDecimalToNumber(raw);
                      if (next === null) {
                        alert("Importe imputado invalido.");
                        e.currentTarget.value = toDecimalInputValue(r.importe_imputado);
                        return;
                      }
                      if (next === (r.importe_imputado ?? null)) return;
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id_contabilidad === r.id_contabilidad
                            ? { ...x, importe_imputado: next }
                            : x
                        )
                      );
                      save(r.id_contabilidad, { importe_imputado: raw });
                    }}
                  />
                </td>

                <td style={tdTopStyle}>
                  <input
                    type="date"
                    defaultValue={toDateInputValue(r.fecha_pago)}
                    disabled={disabled}
                    style={fieldStyle}
                    onBlur={(e) => {
                      if (disabled) return;
                      const fecha_pago = e.currentTarget.value || null;
                      if (fecha_pago === (r.fecha_pago ?? null)) return;
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id_contabilidad === r.id_contabilidad
                            ? { ...x, fecha_pago }
                            : x
                        )
                      );
                      save(r.id_contabilidad, { fecha_pago });
                    }}
                  />
                </td>
              </tr>

              <tr style={rowStyle}>
                <td style={tdBottomLastStyle} colSpan={8}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr 1fr 1.6fr 1fr auto",
                      gap: 10,
                      alignItems: "end",
                    }}
                  >
                    <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                      Programa
                      <select
                        defaultValue={r.programa_id ?? ""}
                        disabled={disabled}
                        style={fieldStyle}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const programa_id = v ? Number(v) : null;
                          if (programa_id === (r.programa_id ?? null)) return;
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id_contabilidad === r.id_contabilidad
                                ? { ...x, programa_id }
                                : x
                            )
                          );
                          save(r.id_contabilidad, { programa_id });
                        }}
                      >
                        <option value="">(sin programa)</option>
                        {programaOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                      Categoria
                      <select
                        defaultValue={r.categoria_id ?? ""}
                        disabled={disabled}
                        style={fieldStyle}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const categoria_id = v ? Number(v) : null;
                          if (categoria_id === (r.categoria_id ?? null)) return;
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id_contabilidad === r.id_contabilidad
                                ? { ...x, categoria_id }
                                : x
                            )
                          );
                          save(r.id_contabilidad, { categoria_id });
                        }}
                      >
                        <option value="">(sin categoria)</option>
                        {categoriaOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                      Concepto
                      <select
                        defaultValue={r.concepto_id ?? ""}
                        disabled={disabled}
                        style={fieldStyle}
                        onChange={(e) => {
                          if (disabled) return;
                          const v = e.currentTarget.value;
                          const concepto_id = v ? Number(v) : null;
                          if (concepto_id === (r.concepto_id ?? null)) return;
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id_contabilidad === r.id_contabilidad
                                ? { ...x, concepto_id }
                                : x
                            )
                          );
                          save(r.id_contabilidad, { concepto_id });
                        }}
                      >
                        <option value="">(sin concepto)</option>
                        {conceptoOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                      <Link
                        href={`/contabilidad?${new URLSearchParams({
                          ...(programaFilterValue ? { programa_id: programaFilterValue } : {}),
                          ...(proveedorFilterValue ? { proveedor_id: proveedorFilterValue } : {}),
                          ...(limitValue ? { limit: limitValue } : {}),
                          edit: String(r.id_contabilidad),
                        }).toString()}#form`}
                        className="app-action-link"
                        style={{ gap: 6 }}
                        aria-label="Editar asiento"
                      >
                        <Icon name="edit" className="button-icon" />
                        Editar
                      </Link>

                      <form action={duplicateAsientoAction}>
                        <input type="hidden" name="club_id" value={clubId} />
                        <input type="hidden" name="id_contabilidad" value={r.id_contabilidad} />
                        {renderFilterInputs()}
                        <ConfirmSubmitButton
                          message="Se creara un asiento nuevo duplicando este. Continuar?"
                          className="icon-button icon-button-secondary tooltip-button"
                          ariaLabel="Duplicar asiento"
                        >
                          <Icon name="duplicate" />
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                </td>
              </tr>
            </React.Fragment>
          );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: 12, opacity: 0.8 }}>
                No hay asientos en el ultimo ano (por fecha o created_at).
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
