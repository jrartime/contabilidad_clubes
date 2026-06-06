"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPersonalAction, deletePersonalAction, updatePersonalAction } from "./actions";
import { Icon } from "@/components/Icon";

type Row = {
  id_personal: number;
  nombre: string | null;
  nif: string | null;
  tipo: string | null;
  observaciones: string | null;
  activo: boolean | null;
};

type PersonalPatch = Partial<Omit<Row, "id_personal">>;
type SortKey = "nombre" | "nif" | "tipo" | "observaciones" | "activo";
type SortState = { key: SortKey; direction: "asc" | "desc" };

export default function PersonalTable({
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
  const [newNif, setNewNif] = useState("");
  const [newTipo, setNewTipo] = useState("");
  const [newObservaciones, setNewObservaciones] = useState("");
  const [newActivo, setNewActivo] = useState(true);
  const [panelMode, setPanelMode] = useState<"new" | "edit" | null>(initialPanelMode ?? null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "nombre", direction: "asc" });

  const disabled = !canEdit || isPending;
  const editingRow = editingId
    ? rows.find((row) => row.id_personal === editingId) ?? null
    : null;

  const sortedRows = React.useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      let result = 0;

      if (sort.key === "activo") {
        // Activos primero en asc
        result = Number(!!bv) - Number(!!av);
      } else {
        result = String(av ?? "").localeCompare(String(bv ?? ""), "es", {
          sensitivity: "base",
        });
      }

      return sort.direction === "asc" ? result : -result;
    });
  }, [rows, sort]);

  const activosCount = rows.filter((r) => r.activo).length;
  const bajasCount = rows.filter((r) => !r.activo).length;

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
    const nombre = newNombre.trim();
    if (!nombre) {
      alert("Nombre obligatorio.");
      return;
    }

    startTransition(() => {
      createPersonalAction({
        nombre,
        nif: newNif || null,
        tipo: newTipo || null,
        observaciones: newObservaciones || null,
        activo: newActivo,
      })
        .then((newRow) => {
          setRows((prev) => [newRow as Row, ...prev]);
          setNewNombre("");
          setNewNif("");
          setNewTipo("");
          setNewObservaciones("");
          setNewActivo(true);
          router.refresh();
        })
        .catch((e) => alert(e.message || String(e)));
    });
  }

  function update(id_personal: number, patch: PersonalPatch) {
    startTransition(() => {
      updatePersonalAction({ id_personal, ...patch })
        .then(() => {
          // Actualiza el estado local para reflejo inmediato
          setRows((prev) =>
            prev.map((r) =>
              r.id_personal === id_personal ? { ...r, ...patch } : r
            )
          );
          router.refresh();
        })
        .catch((e) => alert(e.message || String(e)));
    });
  }

  function deleteRow(id_personal: number) {
    if (!confirm("¿Eliminar definitivamente este trabajador? Esta acción no se puede deshacer.")) return;
    startTransition(() => {
      deletePersonalAction(id_personal)
        .then(() => {
          setRows((prev) => prev.filter((r) => r.id_personal !== id_personal));
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
    <div style={{ marginTop: 12 }}>
      <div className="page-toolbar-actions" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
        {isPending && <span style={{ fontSize: 12, opacity: 0.7 }}>Guardando...</span>}
        {!canEdit && (
          <span style={{ fontSize: 12, opacity: 0.7 }}>No tienes permisos para editar.</span>
        )}
      </div>

      <p style={{ fontSize: 13, color: "#4a5565", marginBottom: 12 }}>
        Listado ({activosCount}
        {incluirBajas && bajasCount > 0 ? ` + ${bajasCount} de baja` : ""})
      </p>

      {panelMode ? (
        <>
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="Cerrar panel"
            onClick={() => setPanelMode(null)}
          />
          <aside className="side-drawer" aria-label="Panel de personal">
            <div className="side-drawer-header">
              <div className="side-drawer-title">
                <span>Personal</span>
                <h2>
                  {panelMode === "new"
                    ? "Nuevo personal"
                    : `Editar — ${editingRow?.nombre ?? `#${editingRow?.id_personal}`}`}
                </h2>
                {panelMode === "edit" && editingRow && !editingRow.activo && (
                  <span style={{ color: "#b93a48", fontSize: 12, fontWeight: 750 }}>
                    ● DADO DE BAJA
                  </span>
                )}
              </div>
              <button
                type="button"
                className="icon-button icon-button-secondary"
                aria-label="Cerrar"
                onClick={() => setPanelMode(null)}
              >
                ×
              </button>
            </div>

            <div className="side-drawer-body">
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "1fr 1fr",
                }}
              >
                <label style={{ gridColumn: "1 / -1", display: "grid", gap: 4, fontSize: 13, fontWeight: 650 }}>
                  Nombre
                  <input
                    type="text"
                    value={panelMode === "new" ? newNombre : undefined}
                    defaultValue={panelMode === "edit" ? editingRow?.nombre ?? "" : undefined}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => panelMode === "new" && setNewNombre(e.currentTarget.value)}
                    onBlur={(e) => {
                      if (panelMode !== "edit" || !editingRow) return;
                      const nombre = e.currentTarget.value.trim();
                      if (!nombre) return;
                      update(editingRow.id_personal, { nombre });
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 650 }}>
                  NIF
                  <input
                    type="text"
                    value={panelMode === "new" ? newNif : undefined}
                    defaultValue={panelMode === "edit" ? editingRow?.nif ?? "" : undefined}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => panelMode === "new" && setNewNif(e.currentTarget.value)}
                    onBlur={(e) => {
                      if (panelMode !== "edit" || !editingRow) return;
                      update(editingRow.id_personal, { nif: e.currentTarget.value.trim() || null });
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 650 }}>
                  Tipo
                  <input
                    type="text"
                    value={panelMode === "new" ? newTipo : undefined}
                    defaultValue={panelMode === "edit" ? editingRow?.tipo ?? "" : undefined}
                    disabled={disabled}
                    style={fieldStyle}
                    onChange={(e) => panelMode === "new" && setNewTipo(e.currentTarget.value)}
                    onBlur={(e) => {
                      if (panelMode !== "edit" || !editingRow) return;
                      update(editingRow.id_personal, { tipo: e.currentTarget.value.trim() || null });
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
                      update(editingRow.id_personal, {
                        observaciones: e.currentTarget.value.trim() || null,
                      });
                    }}
                  />
                </label>
              </div>

            </div>

            {/* Barra de acciones unificada */}
            {canEdit && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                flexWrap: "wrap",
              }}>
                {/* Guardar / Crear — icono disquete */}
                <button
                  onClick={panelMode === "new" ? create : () => setPanelMode(null)}
                  disabled={disabled}
                  className="icon-button tooltip-button"
                  aria-label={panelMode === "new" ? "Crear persona" : "Guardar y cerrar"}
                >
                  <Icon name="save" />
                </button>

                <div style={{ flex: 1 }} />

                {/* Dar de baja / Reactivar (modo edición) */}
                {panelMode === "edit" && editingRow && (
                  editingRow.activo ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (!confirm("¿Dar de baja a este trabajador? Dejará de aparecer en los controles, pero se conservará en el historial contable.")) return;
                        update(editingRow.id_personal, { activo: false });
                      }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: 6, border: "1px solid #f0c070", background: "#fffbea", color: "#92580a", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36 }}
                    >
                      Dar de baja
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => update(editingRow.id_personal, { activo: true })}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", height: 36, borderRadius: 6, border: "1px solid #a7d9b0", background: "#f0faf2", color: "#1a6b2e", fontSize: 13, fontWeight: 700, cursor: "pointer", minHeight: 36 }}
                    >
                      Reactivar trabajador
                    </button>
                  )
                )}

                {/* Eliminar (modo edición) */}
                {panelMode === "edit" && editingRow && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => deleteRow(editingRow.id_personal)}
                    className="icon-button icon-button-danger tooltip-button"
                    aria-label="Eliminar trabajador"
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
              {renderSortHeader({ sortKey: "nombre", label: "Nombre", style: { minWidth: 200 } })}
              {renderSortHeader({ sortKey: "nif", label: "NIF", style: { width: 140 } })}
              {renderSortHeader({ sortKey: "tipo", label: "Tipo", style: { width: 160 } })}
              {renderSortHeader({ sortKey: "observaciones", label: "Observaciones" })}
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((r) => (
              <tr
                key={r.id_personal}
                style={{
                  opacity: r.activo ? 1 : 0.55,
                  background: r.activo ? undefined : "#fafafa",
                }}
              >
                <td style={tdStyle}>
                  {canEdit ? (
                    <button
                      type="button"
                      className="app-action-link"
                      style={{ gap: 6, cursor: "pointer" }}
                      aria-label={r.activo ? "Editar personal" : "Ver personal de baja"}
                      onClick={() => {
                        setEditingId(r.id_personal);
                        setPanelMode("edit");
                      }}
                    >
                      <Icon name="edit" className="button-icon" />
                      {r.activo ? "Editar" : "Ver"}
                    </button>
                  ) : (
                    <span style={{ opacity: 0.6 }}>-</span>
                  )}
                </td>

                <td style={tdStyle}>
                  <strong style={{ textDecoration: r.activo ? undefined : "line-through" }}>
                    {r.nombre ?? "-"}
                  </strong>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <span style={{ fontSize: 11, opacity: 0.55 }}>id: {r.id_personal}</span>
                    {!r.activo && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          color: "#b93a48",
                          background: "#fff0f1",
                          border: "1px solid #f5c2c2",
                          borderRadius: 4,
                          padding: "1px 5px",
                        }}
                      >
                        BAJA
                      </span>
                    )}
                  </div>
                </td>

                <td style={tdStyle}>{r.nif || "-"}</td>
                <td style={tdStyle}>{r.tipo || "-"}</td>
                <td style={tdStyle}>{r.observaciones || "-"}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 12, opacity: 0.8 }}>
                  {incluirBajas
                    ? "No hay personal."
                    : "No hay personal activo. Activa \"Mostrar dados de baja\" para verlos."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
