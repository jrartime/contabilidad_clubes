"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCargoAction, deleteCargoAction, updateCargoAction } from "./actions";
import { CARGOS } from "./constants";
import { Icon } from "@/components/Icon";
import { formatDateEs, toDateInputValue } from "@/lib/format";

type Row = {
  id_cargo: number;
  persona_nombre: string | null;
  persona_dni: string | null;
  cargo: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  observaciones: string | null;
  activo: boolean | null;
};

type CargoPatch = Partial<Omit<Row, "id_cargo">>;
type SortKey = "cargo" | "persona_nombre" | "fecha_inicio" | "fecha_fin";
type SortState = { key: SortKey; direction: "asc" | "desc" };

function cargoLabel(cargo: string | null) {
  return CARGOS.find((c) => c.value === cargo)?.label ?? cargo ?? "-";
}

export default function JuntaDirectivaTable({
  initialRows,
  canEdit,
  initialPanelMode,
  incluirBajas = false,
}: {
  initialRows: Row[];
  canEdit: boolean;
  initialPanelMode?: "new" | null;
  incluirBajas?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [newNombre, setNewNombre] = useState("");
  const [newDni, setNewDni] = useState("");
  const [newCargo, setNewCargo] = useState<string>(CARGOS[0].value);
  const [newFechaInicio, setNewFechaInicio] = useState("");
  const [newFechaFin, setNewFechaFin] = useState("");
  const [newObservaciones, setNewObservaciones] = useState("");
  const [panelMode, setPanelMode] = useState<"new" | "edit" | null>(initialPanelMode ?? null);
  const [editingId, setEditingId] = useState<number | null>(null);

  React.useEffect(() => {
    if (initialPanelMode) {
      setPanelMode(initialPanelMode);
      setEditingId(null);
    }
  }, [initialPanelMode]);
  const [sort, setSort] = useState<SortState>({ key: "cargo", direction: "asc" });

  const disabled = !canEdit || isPending;
  const editingRow = editingId ? rows.find((row) => row.id_cargo === editingId) ?? null : null;

  const sortedRows = React.useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const result = String(av ?? "").localeCompare(String(bv ?? ""), "es", { sensitivity: "base" });
      return sort.direction === "asc" ? result : -result;
    });
  }, [rows, sort]);

  const activosCount = rows.filter((r) => r.activo).length;
  const finalizadosCount = rows.filter((r) => !r.activo).length;

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

  function create() {
    const persona_nombre = newNombre.trim();
    if (!persona_nombre) {
      alert("Nombre obligatorio.");
      return;
    }
    if (!newFechaInicio) {
      alert("Fecha de inicio obligatoria.");
      return;
    }

    startTransition(() => {
      createCargoAction({
        persona_nombre,
        persona_dni: newDni || null,
        cargo: newCargo,
        fecha_inicio: newFechaInicio,
        fecha_fin: newFechaFin || null,
        observaciones: newObservaciones || null,
        activo: true,
      })
        .then((newRow) => {
          setRows((prev) => [newRow as Row, ...prev]);
          setNewNombre("");
          setNewDni("");
          setNewCargo(CARGOS[0].value);
          setNewFechaInicio("");
          setNewFechaFin("");
          setNewObservaciones("");
          router.refresh();
        })
        .catch((e) => alert(e.message || String(e)));
    });
  }

  function update(id_cargo: number, patch: CargoPatch) {
    startTransition(() => {
      updateCargoAction({ id_cargo, ...patch })
        .then(() => {
          setRows((prev) => prev.map((r) => (r.id_cargo === id_cargo ? { ...r, ...patch } : r)));
          router.refresh();
        })
        .catch((e) => alert(e.message || String(e)));
    });
  }

  function deleteRow(id_cargo: number) {
    if (!confirm("¿Eliminar definitivamente este cargo? Esta acción no se puede deshacer.")) return;
    startTransition(() => {
      deleteCargoAction(id_cargo)
        .then(() => {
          setRows((prev) => prev.filter((r) => r.id_cargo !== id_cargo));
          setPanelMode(null);
          router.refresh();
        })
        .catch((e) => alert(e.message || String(e)));
    });
  }

  function setSortKey(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
  }

  function renderSortHeader({ sortKey, label, style }: { sortKey: SortKey; label: string; style?: React.CSSProperties }) {
    const active = sort.key === sortKey;
    return (
      <th style={{ ...headerStyle, ...style }}>
        <button type="button" onClick={() => setSortKey(sortKey)} className="table-sort-button" aria-label={`Ordenar por ${label}`}>
          <span>{label}</span>
          <span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
        </button>
      </th>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="page-toolbar-actions" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
        {isPending && <span style={{ fontSize: 12, opacity: 0.7 }}>Guardando...</span>}
        {!canEdit && <span style={{ fontSize: 12, opacity: 0.7 }}>No tienes permisos para editar.</span>}
      </div>

      <p style={{ fontSize: 13, color: "#4a5565", marginBottom: 12 }}>
        Listado ({activosCount}
        {incluirBajas && finalizadosCount > 0 ? ` + ${finalizadosCount} finalizados` : ""})
      </p>

      {panelMode ? (
        <>
          <button type="button" className="drawer-backdrop" aria-label="Cerrar panel" onClick={() => setPanelMode(null)} />
          <aside className="side-drawer" aria-label="Panel de junta directiva">
            <div className="side-drawer-header">
              <div className="side-drawer-title">
                <span>Junta directiva</span>
                <h2>
                  {panelMode === "new" ? "Nuevo cargo" : `Editar — ${editingRow?.persona_nombre ?? `#${editingRow?.id_cargo}`}`}
                </h2>
                {panelMode === "edit" && editingRow && !editingRow.activo && (
                  <span style={{ color: "#b93a48", fontSize: 12, fontWeight: 750 }}>● MANDATO FINALIZADO</span>
                )}
              </div>
              <button type="button" className="icon-button icon-button-secondary" aria-label="Cerrar" onClick={() => setPanelMode(null)}>
                ×
              </button>
            </div>

            <div className="side-drawer-body">
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                <label style={{ gridColumn: "1 / -1", display: "grid", gap: 4, fontSize: 13, fontWeight: 650 }}>
                  Nombre
                  <input
                    type="text"
                    value={panelMode === "new" ? newNombre : undefined}
                    defaultValue={panelMode === "edit" ? editingRow?.persona_nombre ?? "" : undefined}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => panelMode === "new" && setNewNombre(e.currentTarget.value)}
                    onBlur={(e) => {
                      if (panelMode !== "edit" || !editingRow) return;
                      const nombre = e.currentTarget.value.trim();
                      if (!nombre) return;
                      update(editingRow.id_cargo, { persona_nombre: nombre });
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 650 }}>
                  DNI
                  <input
                    type="text"
                    value={panelMode === "new" ? newDni : undefined}
                    defaultValue={panelMode === "edit" ? editingRow?.persona_dni ?? "" : undefined}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => panelMode === "new" && setNewDni(e.currentTarget.value)}
                    onBlur={(e) => {
                      if (panelMode !== "edit" || !editingRow) return;
                      update(editingRow.id_cargo, { persona_dni: e.currentTarget.value.trim() || null });
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 650 }}>
                  Cargo
                  <select
                    value={panelMode === "new" ? newCargo : undefined}
                    defaultValue={panelMode === "edit" ? editingRow?.cargo ?? "" : undefined}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => {
                      if (panelMode === "new") {
                        setNewCargo(e.currentTarget.value);
                      } else if (editingRow) {
                        update(editingRow.id_cargo, { cargo: e.currentTarget.value });
                      }
                    }}
                  >
                    {CARGOS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 650 }}>
                  Inicio del mandato
                  <input
                    type="date"
                    value={panelMode === "new" ? newFechaInicio : undefined}
                    defaultValue={panelMode === "edit" ? toDateInputValue(editingRow?.fecha_inicio) : undefined}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => panelMode === "new" && setNewFechaInicio(e.currentTarget.value)}
                    onBlur={(e) => {
                      if (panelMode !== "edit" || !editingRow) return;
                      if (!e.currentTarget.value) return;
                      update(editingRow.id_cargo, { fecha_inicio: e.currentTarget.value });
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 650 }}>
                  Fin del mandato
                  <input
                    type="date"
                    value={panelMode === "new" ? newFechaFin : undefined}
                    defaultValue={panelMode === "edit" ? toDateInputValue(editingRow?.fecha_fin) : undefined}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => panelMode === "new" && setNewFechaFin(e.currentTarget.value)}
                    onBlur={(e) => {
                      if (panelMode !== "edit" || !editingRow) return;
                      update(editingRow.id_cargo, { fecha_fin: e.currentTarget.value || null });
                    }}
                  />
                </label>

                <label style={{ gridColumn: "1 / -1", display: "grid", gap: 4, fontSize: 13, fontWeight: 650 }}>
                  Observaciones
                  <input
                    type="text"
                    value={panelMode === "new" ? newObservaciones : undefined}
                    defaultValue={panelMode === "edit" ? editingRow?.observaciones ?? "" : undefined}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => panelMode === "new" && setNewObservaciones(e.currentTarget.value)}
                    onBlur={(e) => {
                      if (panelMode !== "edit" || !editingRow) return;
                      update(editingRow.id_cargo, { observaciones: e.currentTarget.value.trim() || null });
                    }}
                  />
                </label>
              </div>
            </div>

            {canEdit && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
                <button
                  onClick={panelMode === "new" ? create : () => setPanelMode(null)}
                  disabled={disabled}
                  className="icon-button tooltip-button"
                  aria-label={panelMode === "new" ? "Crear cargo" : "Guardar y cerrar"}
                >
                  <Icon name="save" />
                </button>

                <div style={{ flex: 1 }} />

                {panelMode === "edit" &&
                  editingRow &&
                  (editingRow.activo ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!confirm("¿Finalizar este mandato? Dejará de aparecer como cargo activo, pero se conservará en el historial.")) return;
                        update(editingRow.id_cargo, { activo: false });
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: 6, border: "1px solid #f0c070", background: "#fffbea", color: "#92580a", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36 }}
                    >
                      Finalizar mandato
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => update(editingRow.id_cargo, { activo: true })}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: 6, border: "1px solid #a7d9b0", background: "#f0faf2", color: "#1a6b2e", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36 }}
                    >
                      Reactivar cargo
                    </button>
                  ))}

                {panelMode === "edit" && editingRow && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => deleteRow(editingRow.id_cargo)}
                    className="icon-button icon-button-danger tooltip-button"
                    aria-label="Eliminar cargo"
                  >
                    <Icon name="delete" />
                  </button>
                )}
              </div>
            )}
          </aside>
        </>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...headerStyle, width: 70 }}>Acciones</th>
              {renderSortHeader({ sortKey: "cargo", label: "Cargo", style: { width: 160 } })}
              {renderSortHeader({ sortKey: "persona_nombre", label: "Nombre", style: { minWidth: 200 } })}
              {renderSortHeader({ sortKey: "fecha_inicio", label: "Inicio", style: { width: 110 } })}
              {renderSortHeader({ sortKey: "fecha_fin", label: "Fin", style: { width: 110 } })}
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id_cargo} style={{ opacity: r.activo ? 1 : 0.55, background: r.activo ? undefined : "#fafafa" }}>
                <td style={tdStyle}>
                  {canEdit ? (
                    <button
                      type="button"
                      className="app-action-link"
                      style={{ gap: 6, cursor: "pointer" }}
                      aria-label={r.activo ? "Editar cargo" : "Ver cargo finalizado"}
                      onClick={() => {
                        setEditingId(r.id_cargo);
                        setPanelMode("edit");
                      }}
                    >
                      <Icon name="edit" />
                      {r.activo ? "Editar" : "Ver"}
                    </button>
                  ) : (
                    <span style={{ opacity: 0.6 }}>-</span>
                  )}
                </td>

                <td style={tdStyle}>{cargoLabel(r.cargo)}</td>

                <td style={tdStyle}>
                  <strong style={{ textDecoration: r.activo ? undefined : "line-through" }}>{r.persona_nombre ?? "-"}</strong>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 11, opacity: 0.55 }}>{r.persona_dni || "sin DNI"}</span>
                    {!r.activo && (
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", color: "#b93a48", background: "#fff0f1", border: "1px solid #f5c2c2", borderRadius: 4, padding: "1px 5px" }}>
                        FINALIZADO
                      </span>
                    )}
                  </div>
                </td>

                <td style={tdStyle}>{formatDateEs(r.fecha_inicio)}</td>
                <td style={tdStyle}>{formatDateEs(r.fecha_fin)}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 12, opacity: 0.8 }}>
                  {incluirBajas ? "No hay cargos registrados." : "No hay cargos activos. Activa \"Mostrar mandatos finalizados\" para verlos."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
