"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toDateInputValue } from "@/lib/format";
import { Icon } from "@/components/Icon";
import {
  updateProgramaAction,
  createProgramaAction,
  deleteProgramaAction,
} from "./actions";

type Row = {
  id_programa: number;
  programa: string | null;
  anio: number | null;
  subvencion: number | null;
  fecha_limite: string | null;
};

type ProgramaPatch = Partial<
  Omit<Row, "id_programa" | "subvencion"> & {
    subvencion: string | number | null;
  }
>;
type SortKey = "anio" | "programa" | "subvencion" | "fecha_limite";
type SortState = { key: SortKey; direction: "asc" | "desc" };

function toEuro(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2).replace(".", ",");
}

function parseOptionalYear(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export default function ProgramasTable({
  initialRows,
  canEdit,
  initialPanelMode,
}: {
  initialRows: Row[];
  canEdit: boolean;
  initialPanelMode?: "new" | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [newPrograma, setNewPrograma] = useState("");
  const [newAnio, setNewAnio] = useState("");
  const [newSubvencion, setNewSubvencion] = useState("");
  const [newFechaLimite, setNewFechaLimite] = useState("");
  const [panelMode, setPanelMode] = useState<"new" | "edit" | null>(initialPanelMode ?? null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "anio", direction: "desc" });

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

  const disabled = !canEdit || isPending;
  const editingRow = editingId
    ? rows.find((row) => row.id_programa === editingId) ?? null
    : null;
  const sortedRows = React.useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      let result = 0;

      if (sort.key === "anio" || sort.key === "subvencion") {
        result = Number(av ?? -Infinity) - Number(bv ?? -Infinity);
      } else {
        result = String(av ?? "").localeCompare(String(bv ?? ""), "es", {
          sensitivity: "base",
        });
      }

      return sort.direction === "asc" ? result : -result;
    });
  }, [rows, sort]);

  function save(id_programa: number, patch: ProgramaPatch) {
    startTransition(() => {
      updateProgramaAction({ id_programa, ...patch })
        .then(() => router.refresh())
        .catch((e) => alert(e.message || String(e)));
    });
  }

  function create(payload: ProgramaPatch) {
    startTransition(() => {
      createProgramaAction(payload)
        .then((newRow) => {
          setRows((prev) => [newRow as Row, ...prev]);
          setNewPrograma("");
          setNewAnio("");
          setNewSubvencion("");
          setNewFechaLimite("");
          router.refresh();
        })
        .catch((e) => alert(e.message || String(e)));
    });
  }

  function remove(id_programa: number) {
    if (!confirm("Seguro que quieres eliminar este programa?")) return;

    startTransition(() => {
      deleteProgramaAction(id_programa)
        .then(() => {
          setRows((prev) => prev.filter((r) => r.id_programa !== id_programa));
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
      <div className="page-toolbar">
        <div>
          {isPending && <span style={{ fontSize: 12, opacity: 0.7 }}>Guardando...</span>}
          {!canEdit && (
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              No tienes permisos para editar.
            </span>
          )}
        </div>
      </div>

      {panelMode ? (
        <>
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="Cerrar panel"
            onClick={() => setPanelMode(null)}
          />
          <aside className="side-drawer" aria-label="Panel de programa">
        <h2 style={{ margin: 0, marginBottom: 10, fontSize: 16 }}>
          {panelMode === "new" ? "Nuevo programa" : `Editar programa #${editingRow?.id_programa ?? ""}`}
        </h2>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "100px 1.4fr 160px 170px auto",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
            Ano
            <input
              type="number"
              value={panelMode === "new" ? newAnio : undefined}
              defaultValue={panelMode === "edit" ? editingRow?.anio ?? "" : undefined}
              disabled={disabled}
              style={fieldStyle}
              onChange={(e) => panelMode === "new" && setNewAnio(e.currentTarget.value)}
              onBlur={(e) => {
                if (panelMode !== "edit" || !editingRow) return;
                const anio = parseOptionalYear(e.currentTarget.value);
                if (anio !== editingRow.anio) save(editingRow.id_programa, { anio });
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
            Programa
            <input
              type="text"
              value={panelMode === "new" ? newPrograma : undefined}
              defaultValue={panelMode === "edit" ? editingRow?.programa ?? "" : undefined}
              disabled={disabled}
              style={fieldStyle}
              onChange={(e) => panelMode === "new" && setNewPrograma(e.currentTarget.value)}
              onBlur={(e) => {
                if (panelMode !== "edit" || !editingRow) return;
                save(editingRow.id_programa, { programa: e.currentTarget.value.trim() || null });
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
            Subvencion
            <input
              type="text"
              inputMode="decimal"
              value={panelMode === "new" ? newSubvencion : undefined}
              defaultValue={panelMode === "edit" ? toEuro(editingRow?.subvencion) : undefined}
              disabled={disabled}
              style={fieldStyle}
              onChange={(e) => panelMode === "new" && setNewSubvencion(e.currentTarget.value)}
              onBlur={(e) => {
                if (panelMode !== "edit" || !editingRow) return;
                save(editingRow.id_programa, { subvencion: e.currentTarget.value.trim() || null });
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
            Fecha limite
            <input
              type="date"
              value={panelMode === "new" ? newFechaLimite : undefined}
              defaultValue={
                panelMode === "edit" ? toDateInputValue(editingRow?.fecha_limite) : undefined
              }
              disabled={disabled}
              style={fieldStyle}
              onChange={(e) => panelMode === "new" && setNewFechaLimite(e.currentTarget.value)}
              onBlur={(e) => {
                if (panelMode !== "edit" || !editingRow) return;
                save(editingRow.id_programa, { fecha_limite: e.currentTarget.value || null });
              }}
            />
          </label>

          {panelMode === "new" ? (
          <button
            onClick={() => {
              create({
                programa: newPrograma.trim() || null,
                anio: parseOptionalYear(newAnio),
                subvencion: newSubvencion.trim() || null,
                fecha_limite: newFechaLimite || null,
              });
            }}
            disabled={disabled}
            className="icon-button tooltip-button"
            aria-label="Crear programa"
          >
            <Icon name="new" />
          </button>
          ) : editingRow ? (
            <button
              type="button"
              className="icon-button icon-button-danger tooltip-button"
              aria-label="Eliminar programa"
              onClick={() => remove(editingRow.id_programa)}
              disabled={disabled}
            >
              <Icon name="delete" />
            </button>
          ) : null}
        </div>
          </aside>
        </>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {renderSortHeader({ sortKey: "anio", label: "Ano", style: { width: 90 } })}
              {renderSortHeader({ sortKey: "programa", label: "Programa" })}
              {renderSortHeader({ sortKey: "subvencion", label: "Subvencion", style: { width: 140 } })}
              {renderSortHeader({ sortKey: "fecha_limite", label: "Fecha limite", style: { width: 150 } })}
              <th style={{ ...headerStyle, width: 110 }}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id_programa}>
                <td style={tdStyle}>
                  <input
                    type="number"
                    defaultValue={row.anio ?? ""}
                    disabled={!canEdit}
                    style={fieldStyle}
                    onBlur={(e) => {
                      if (!canEdit) return;
                      const anio = parseOptionalYear(e.currentTarget.value);
                      if (anio === row.anio) return;
                      setRows((prev) =>
                        prev.map((item) =>
                          item.id_programa === row.id_programa ? { ...item, anio } : item
                        )
                      );
                      save(row.id_programa, { anio });
                    }}
                  />
                </td>

                <td style={tdStyle}>
                  <input
                    type="text"
                    defaultValue={row.programa ?? ""}
                    disabled={!canEdit}
                    style={fieldStyle}
                    onBlur={(e) => {
                      if (!canEdit) return;
                      const programa = e.currentTarget.value.trim() || null;
                      if (programa === (row.programa ?? null)) return;
                      setRows((prev) =>
                        prev.map((item) =>
                          item.id_programa === row.id_programa
                            ? { ...item, programa }
                            : item
                        )
                      );
                      save(row.id_programa, { programa });
                    }}
                  />
                </td>

                <td style={tdStyle}>
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={toEuro(row.subvencion)}
                    disabled={!canEdit}
                    style={fieldStyle}
                    onBlur={(e) => {
                      if (!canEdit) return;
                      save(row.id_programa, {
                        subvencion: e.currentTarget.value.trim() || null,
                      });
                    }}
                  />
                </td>

                <td style={tdStyle}>
                  <input
                    type="date"
                    defaultValue={toDateInputValue(row.fecha_limite)}
                    disabled={!canEdit}
                    style={fieldStyle}
                    onBlur={(e) => {
                      if (!canEdit) return;
                      const fecha_limite = e.currentTarget.value || null;
                      if (fecha_limite === (row.fecha_limite ?? null)) return;
                      setRows((prev) =>
                        prev.map((item) =>
                          item.id_programa === row.id_programa
                            ? { ...item, fecha_limite }
                            : item
                        )
                      );
                      save(row.id_programa, { fecha_limite });
                    }}
                  />
                </td>

                <td style={tdStyle}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(row.id_programa);
                      setPanelMode("edit");
                    }}
                    disabled={disabled}
                    className="icon-button tooltip-button"
                    aria-label="Editar programa"
                  >
                    <Icon name="edit" />
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 12, opacity: 0.8 }}>
                  No hay programas. Crea el primero desde el formulario superior.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
