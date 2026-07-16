"use client";

import { useState, useTransition } from "react";
import { conciliarManualAction, desconciliarAction } from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────────
export type AsientoRow = {
  id_contabilidad: number;
  fecha: string | null;
  numero_factura: string | null;
  proveedor: string | null;
  importe_total: number;
  programa: string | null;
  concepto: string | null;
  detalle: string | null;
};

export type BancoRow = {
  id_banco: number;
  fecha_operativa: string | null;
  importe: number;
  detalle: string | null;
  referencia_1: string | null;
};

export type PagoRow = {
  contabilidad_id: number;
  banco_id: number;
  fecha_pago_real: string | null;
  importe_pagado: number;
  asiento?: AsientoRow;
  banco?: BancoRow;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function fmtEur(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ConciliacionManualClient({
  asientos,
  movimientos,
  pagos,
}: {
  asientos: AsientoRow[];
  movimientos: BancoRow[];
  pagos: PagoRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedAsiento, setSelectedAsiento] = useState<number | null>(null);
  const [selectedBanco, setSelectedBanco] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"pendientes" | "conciliados">("pendientes");

  // Buscar info del seleccionado
  const asientoSel = asientos.find((a) => a.id_contabilidad === selectedAsiento);
  const bancoSel = movimientos.find((b) => b.id_banco === selectedBanco);
  const canConciliar = selectedAsiento !== null && selectedBanco !== null && !isPending;

  function handleConciliar() {
    if (!selectedAsiento || !selectedBanco) return;
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await conciliarManualAction(selectedAsiento, selectedBanco);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccessMsg("Conciliación registrada correctamente.");
      setSelectedAsiento(null);
      setSelectedBanco(null);
    });
  }

  function handleDesconciliar(contabilidadId: number, bancoId: number) {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await desconciliarAction(contabilidadId, bancoId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccessMsg("Conciliación eliminada.");
    });
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 10px",
    background: "#f5f5f5",
    fontWeight: 600,
    fontSize: 12,
    borderBottom: "2px solid #ddd",
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };
  const td: React.CSSProperties = {
    padding: "5px 10px",
    borderBottom: "1px solid #eee",
    fontSize: 13,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };

  // ── Tab: Pendientes ───────────────────────────────────────────────────────
  const pendientesTab = (
    <div style={{ display: "grid", gap: 16 }}>

      {/* Barra de selección activa */}
      <div style={{
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px",
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>ASIENTO SELECCIONADO</span>
          <div style={{ fontSize: 13, marginTop: 2 }}>
            {asientoSel
              ? <><b>{asientoSel.proveedor ?? "(sin proveedor)"}</b> · {fmtDate(asientoSel.fecha)} · {fmtEur(asientoSel.importe_total)}</>
              : <span style={{ opacity: 0.5 }}>Haz clic en un asiento ↓</span>}
          </div>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 20 }}>⇔</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>MOVIMIENTO BANCARIO SELECCIONADO</span>
          <div style={{ fontSize: 13, marginTop: 2 }}>
            {bancoSel
              ? <><b>{bancoSel.detalle ?? "(sin detalle)"}</b> · {fmtDate(bancoSel.fecha_operativa)} · {fmtEur(bancoSel.importe)}</>
              : <span style={{ opacity: 0.5 }}>Haz clic en un movimiento ↓</span>}
          </div>
        </div>
        <button
          type="button"
          disabled={!canConciliar}
          onClick={handleConciliar}
          style={{
            padding: "8px 20px", fontWeight: 700, fontSize: 14, borderRadius: 6, border: "none",
            background: canConciliar ? "var(--primary)" : "#e2e8f0",
            color: canConciliar ? "#fff" : "#94a3b8",
            cursor: canConciliar ? "pointer" : "default",
            whiteSpace: "nowrap",
          }}
        >
          {isPending ? "Conciliando…" : "✓ Conciliar"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fff0f0", border: "2px solid #f87171", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>
          ⚠ {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: "#f0fdf4", border: "2px solid #4ade80", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#15803d", fontWeight: 600 }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Dos paneles lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Panel asientos */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#475569" }}>
            Asientos contables sin conciliar ({asientos.length})
          </h3>
          <div style={{ maxHeight: 460, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Proveedor / Detalle</th>
                  <th style={{ ...th, textAlign: "right" }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {asientos.length === 0 && (
                  <tr><td colSpan={3} style={{ ...td, color: "#94a3b8", textAlign: "center", padding: 20 }}>Sin asientos pendientes</td></tr>
                )}
                {asientos.map((a) => {
                  const sel = selectedAsiento === a.id_contabilidad;
                  return (
                    <tr
                      key={a.id_contabilidad}
                      onClick={() => setSelectedAsiento(sel ? null : a.id_contabilidad)}
                      style={{
                        cursor: "pointer",
                        background: sel ? "#dbeafe" : undefined,
                        outline: sel ? "2px solid #3b82f6" : undefined,
                      }}
                    >
                      <td style={td}>{fmtDate(a.fecha)}</td>
                      <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                        <div style={{ fontWeight: 600 }}>{a.proveedor ?? "(sin proveedor)"}</div>
                        {a.numero_factura && <div style={{ fontSize: 11, opacity: 0.6 }}>Fac. {a.numero_factura}</div>}
                        {a.programa && <div style={{ fontSize: 11, opacity: 0.6 }}>{a.programa}</div>}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtEur(a.importe_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel movimientos bancarios */}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#475569" }}>
            Movimientos bancarios sin conciliar ({movimientos.length})
          </h3>
          <div style={{ maxHeight: 460, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={th}>Fecha</th>
                  <th style={th}>Detalle / Referencia</th>
                  <th style={{ ...th, textAlign: "right" }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.length === 0 && (
                  <tr><td colSpan={3} style={{ ...td, color: "#94a3b8", textAlign: "center", padding: 20 }}>Sin movimientos pendientes</td></tr>
                )}
                {movimientos.map((b) => {
                  const sel = selectedBanco === b.id_banco;
                  return (
                    <tr
                      key={b.id_banco}
                      onClick={() => setSelectedBanco(sel ? null : b.id_banco)}
                      style={{
                        cursor: "pointer",
                        background: sel ? "#dbeafe" : undefined,
                        outline: sel ? "2px solid #3b82f6" : undefined,
                      }}
                    >
                      <td style={td}>{fmtDate(b.fecha_operativa)}</td>
                      <td style={{ ...td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                        <div style={{ fontWeight: 600 }}>{b.detalle ?? "(sin detalle)"}</div>
                        {b.referencia_1 && <div style={{ fontSize: 11, opacity: 0.6 }}>{b.referencia_1}</div>}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtEur(b.importe)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Tab: Ya conciliados ────────────────────────────────────────────────────
  const conciliadosTab = (
    <div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
        {pagos.length} parejas conciliadas. Puedes deshacer cualquiera.
      </p>
      {error && (
        <div style={{ background: "#fff0f0", border: "2px solid #f87171", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#b91c1c", fontWeight: 600, marginBottom: 10 }}>
          ⚠ {error}
        </div>
      )}
      {successMsg && (
        <div style={{ background: "#f0fdf4", border: "2px solid #4ade80", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#15803d", fontWeight: 600, marginBottom: 10 }}>
          ✓ {successMsg}
        </div>
      )}
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Fecha asiento</th>
              <th style={th}>Proveedor</th>
              <th style={{ ...th, textAlign: "right" }}>Importe asiento</th>
              <th style={th}>Fecha banco</th>
              <th style={th}>Detalle banco</th>
              <th style={{ ...th, textAlign: "right" }}>Importe banco</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {pagos.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, color: "#94a3b8", textAlign: "center", padding: 20 }}>No hay conciliaciones registradas</td></tr>
            )}
            {pagos.map((p, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? undefined : "#fafafa" }}>
                <td style={td}>{fmtDate(p.asiento?.fecha ?? null)}</td>
                <td style={td}>{p.asiento?.proveedor ?? "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtEur(p.asiento?.importe_total)}</td>
                <td style={td}>{fmtDate(p.banco?.fecha_operativa ?? null)}</td>
                <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{p.banco?.detalle ?? "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{fmtEur(p.banco?.importe)}</td>
                <td style={td}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDesconciliar(p.contabilidad_id, p.banco_id)}
                    style={{ padding: "4px 10px", fontSize: 12, cursor: "pointer", borderRadius: 4, border: "1px solid #fca5a5", background: "#fff0f0", color: "#b91c1c" }}
                  >
                    Deshacer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Tabs UI ────────────────────────────────────────────────────────────────
  const tabBtn = (t: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => { setTab(t); setError(null); setSuccessMsg(null); }}
      style={{
        padding: "7px 18px", fontSize: 13, fontWeight: tab === t ? 700 : 400, cursor: "pointer",
        border: "none", borderBottom: tab === t ? "2px solid var(--primary)" : "2px solid transparent",
        background: "transparent", color: tab === t ? "var(--primary)" : "#64748b",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
        {tabBtn("pendientes", `Pendientes (${asientos.length})`)}
        {tabBtn("conciliados", `Ya conciliados (${pagos.length})`)}
      </div>
      {tab === "pendientes" ? pendientesTab : conciliadosTab}
    </div>
  );
}
