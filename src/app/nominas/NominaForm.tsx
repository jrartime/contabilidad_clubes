"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { parseDecimalToNumber } from "@/lib/decimal";

type NominaFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  clubId: number;
  editRow: any;
  personal: any[];
  proveedores: any[];
  conceptos: any[];
  entidades: any[];
  programas: any[];
  categorias: any[];
  documentos: any[];
  uploadDocumentosAction: (formData: FormData) => void | Promise<void>;
  deleteDocumentoAction: (formData: FormData) => void | Promise<void>;
  downloadDocumentoAction: (formData: FormData) => void | Promise<void>;
  redirectTo: string;
};

function parseNumber(value: string): number | null {
  return parseDecimalToNumber(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  return String(round2(value)).replace(/\./g, ",");
}

function formatInputValue(value: any): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return formatNumber(value);
  return String(value).replace(/\./g, ",");
}

export default function NominaForm({
  action,
  clubId,
  editRow,
  personal,
  proveedores,
  conceptos,
  entidades,
  programas,
  categorias,
  documentos,
  uploadDocumentosAction,
  deleteDocumentoAction,
  downloadDocumentoAction,
  redirectTo,
}: NominaFormProps) {
  const toDateInputValue = (value: any): string => {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (typeof value === "string") return value.slice(0, 10);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return "";
  };

  const toSelectValue = (value: any): string => {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  };
  const brutoRef = useRef<HTMLInputElement>(null);
  const costeRef = useRef<HTMLInputElement>(null);
  const ssRef = useRef<HTMLInputElement>(null);
  const brutoImputadoRef = useRef<HTMLInputElement>(null);
  const ssImputadoRef = useRef<HTMLInputElement>(null);
  const importeTotalRef = useRef<HTMLInputElement>(null);
  const importeImputadoRef = useRef<HTMLInputElement>(null);

  const recompute = useCallback(() => {
    const bruto = parseNumber(brutoRef.current?.value ?? "");
    const coste = parseNumber(costeRef.current?.value ?? "");
    const currentSs = parseNumber(ssRef.current?.value ?? "");
    if (bruto !== null && coste !== null) {
      const computedSs = round2(coste - bruto);

      if (ssRef.current && ssRef.current.value.trim() === "") {
        ssRef.current.value = formatNumber(computedSs);
      }
      if (brutoImputadoRef.current && brutoImputadoRef.current.value.trim() === "") {
        brutoImputadoRef.current.value = formatNumber(bruto);
      }
      if (ssImputadoRef.current && ssImputadoRef.current.value.trim() === "") {
        ssImputadoRef.current.value = formatNumber(currentSs ?? computedSs);
      }
    }

    const finalBruto = parseNumber(brutoRef.current?.value ?? "");
    const finalSs = parseNumber(ssRef.current?.value ?? "");
    const finalBrutoImputado = parseNumber(brutoImputadoRef.current?.value ?? "");
    const finalSsImputado = parseNumber(ssImputadoRef.current?.value ?? "");

    if (importeTotalRef.current) {
      if (finalBruto !== null && finalSs !== null) {
        importeTotalRef.current.value = formatNumber(round2(finalBruto + finalSs));
      } else {
        importeTotalRef.current.value = "";
      }
    }

    if (importeImputadoRef.current) {
      if (finalBrutoImputado !== null && finalSsImputado !== null) {
        importeImputadoRef.current.value = formatNumber(
          round2(finalBrutoImputado + finalSsImputado)
        );
      } else {
        importeImputadoRef.current.value = "";
      }
    }
  }, []);

  useEffect(() => {
    recompute();
  }, [recompute]);

  const compactFieldStyle: React.CSSProperties = {
    height: 32,
    minHeight: 32,
    lineHeight: "32px",
    padding: "0 8px",
    fontSize: 13,
    boxSizing: "border-box",
    display: "block",
    width: "100%",
  };

  const compactSelectStyle: React.CSSProperties = {
    ...compactFieldStyle,
    lineHeight: "normal",
    padding: "0 8px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    display: "grid",
    gap: 4,
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <form
        key={editRow ? `edit-${editRow.id_contabilidad}` : "new"}
        action={action}
        style={{ display: "grid", gap: 10 }}
      >
        <input type="hidden" name="club_id" value={clubId} />
        <input type="hidden" name="id_contabilidad" value={editRow?.id_contabilidad ?? ""} />

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        }}
      >
        <label style={labelStyle}>
          Personal
          <select
            name="personal_id"
            defaultValue={toSelectValue(editRow?.personal_id)}
            style={{ ...compactSelectStyle, width: "100%" }}
            required
          >
            <option value="">(sin personal)</option>
            {personal.map((p: any) => (
              <option key={p.id_personal} value={p.id_personal}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Fecha (devengo)
          <input
            name="fecha"
            type="date"
            defaultValue={toDateInputValue(editRow?.fecha)}
            style={{ ...compactFieldStyle, width: 120 }}
          />
        </label>

        <label style={labelStyle}>
          Fecha pago
          <input
            name="fecha_pago"
            type="date"
            defaultValue={toDateInputValue(editRow?.fecha_pago)}
            style={{ ...compactFieldStyle, width: 120 }}
          />
        </label>

        <label style={labelStyle}>
          Bruto
          <input
            ref={brutoRef}
            name="bruto"
            type="text"
            inputMode="decimal"
            defaultValue={formatInputValue(editRow?.bruto ?? "")}
            onBlur={recompute}
            style={{ ...compactFieldStyle, width: 120 }}
          />
        </label>

        <label style={labelStyle}>
          Coste empresarial
          <input
            ref={costeRef}
            name="coste_empresarial"
            type="text"
            inputMode="decimal"
            defaultValue={formatInputValue(editRow?.coste_empresarial ?? "")}
            onBlur={recompute}
            style={{ ...compactFieldStyle, width: 120 }}
          />
        </label>

        <label style={labelStyle}>
          SS
          <input
            ref={ssRef}
            name="ss"
            type="text"
            inputMode="decimal"
            defaultValue={formatInputValue(editRow?.ss ?? "")}
            onBlur={recompute}
            style={{ ...compactFieldStyle, width: 120 }}
          />
        </label>

        <label style={labelStyle}>
          Bruto imputado
          <input
            ref={brutoImputadoRef}
            name="bruto_imputado"
            type="text"
            inputMode="decimal"
            defaultValue={formatInputValue(editRow?.bruto_imputado ?? "")}
            onBlur={recompute}
            style={{ ...compactFieldStyle, width: 120 }}
          />
        </label>

        <label style={labelStyle}>
          SS imputado
          <input
            ref={ssImputadoRef}
            name="ss_imputado"
            type="text"
            inputMode="decimal"
            defaultValue={formatInputValue(editRow?.ss_imputado ?? "")}
            onBlur={recompute}
            style={{ ...compactFieldStyle, width: 120 }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1.2fr 1fr 1fr" }}>
        <label style={labelStyle}>
          Proveedor
          <select
            name="proveedor_id"
            defaultValue={toSelectValue(editRow?.proveedor_id)}
            style={{ ...compactSelectStyle, width: "100%" }}
          >
            <option value="">(sin proveedor)</option>
            {proveedores.map((p: any) => (
              <option key={p.id_proveedor} value={p.id_proveedor}>
                {p.proveedor}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Categoría (A/B/C)
          <select
            name="categoria_id"
            defaultValue={toSelectValue(editRow?.categoria_id)}
            style={{ ...compactSelectStyle, width: "100%" }}
          >
            <option value="">(sin categoría)</option>
            {categorias.map((c: any) => (
              <option key={c.id_categoria} value={c.id_categoria}>
                {c.categoria}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Programa
          <select
            name="programa_id"
            defaultValue={toSelectValue(editRow?.programa_id)}
            style={{ ...compactSelectStyle, width: "100%" }}
          >
            <option value="">(sin programa)</option>
            {programas.map((p: any) => (
              <option key={p.id_programa} value={p.id_programa}>
                {p.programa}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <label style={labelStyle}>
          Concepto
          <select
            name="concepto_id"
            defaultValue={toSelectValue(editRow?.concepto_id)}
            style={{ ...compactSelectStyle, width: "100%" }}
          >
            <option value="">(sin concepto)</option>
            {conceptos.map((c: any) => (
              <option key={c.id_concepto} value={c.id_concepto}>
                {c.concepto}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Entidad
          <select
            name="entidad_id"
            defaultValue={toSelectValue(editRow?.entidad_id)}
            style={{ ...compactSelectStyle, width: "100%" }}
          >
            <option value="">(sin entidad)</option>
            {entidades.map((e: any) => (
              <option key={e.id_entidad} value={e.id_entidad}>
                {e.entidad}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Detalle
          <input
            name="detalle"
            defaultValue={editRow?.detalle ?? ""}
            style={{ ...compactFieldStyle, width: "100%" }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <label style={labelStyle}>
          Importe total
          <input
            ref={importeTotalRef}
            name="importe_total"
            type="text"
            inputMode="decimal"
            required
            defaultValue={formatInputValue(editRow?.importe_total ?? 0)}
            onBlur={recompute}
            style={{ ...compactFieldStyle, width: "100%" }}
          />
        </label>

        <label style={labelStyle}>
          Importe imputado
          <input
            ref={importeImputadoRef}
            name="importe_imputado"
            type="text"
            inputMode="decimal"
            required
            defaultValue={formatInputValue(editRow?.importe_imputado ?? 0)}
            onBlur={recompute}
            style={{ ...compactFieldStyle, width: "100%" }}
          />
        </label>
      </div>

      <div className="drawer-actions">
        <button
          type="submit"
          className="icon-button tooltip-button"
          aria-label={editRow ? "Guardar cambios" : "Crear nomina"}
        >
          {editRow ? "Guardar cambios" : "Crear nómina"}
        </button>
        {editRow && (
          <a href="/nominas" style={{ opacity: 0.8 }}>
            Cancelar edición
          </a>
        )}
      </div>
    </form>

    {editRow && (
      <div
        style={{
          border: "1px dashed #ddd",
          borderRadius: 10,
          padding: 12,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800 }}>Documentos</div>
        <form
          action={uploadDocumentosAction}
          style={{ display: "grid", gap: 6, alignItems: "start" }}
        >
          <input type="hidden" name="club_id" value={clubId} />
          <input type="hidden" name="contabilidad_id" value={editRow.id_contabilidad} />
          <input type="hidden" name="redirect_to" value={redirectTo} />
          <input
            type="file"
            name="documentos"
            multiple
            accept="application/pdf,image/jpeg,image/png"
          />
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Max 1MB. Tipos permitidos: PDF/JPG/PNG.
          </div>
          <button type="submit" style={{ padding: "8px 10px", cursor: "pointer" }}>
            Subir documentos
          </button>
        </form>

        {documentos.length > 0 ? (
          <div style={{ display: "grid", gap: 6 }}>
            {documentos.map((doc: any) => (
              <div
                key={doc.id_documento}
                style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
              >
                <span style={{ fontSize: 13 }}>
                  {doc.filename} ({doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : "-"})
                </span>
                <form action={downloadDocumentoAction}>
                  <input type="hidden" name="club_id" value={clubId} />
                  <input type="hidden" name="documento_id" value={doc.id_documento} />
                  <input type="hidden" name="redirect_to" value={redirectTo} />
                  <button type="submit" style={{ padding: "4px 8px", cursor: "pointer" }}>
                    Descargar
                  </button>
                </form>
                <form action={deleteDocumentoAction}>
                  <input type="hidden" name="club_id" value={clubId} />
                  <input type="hidden" name="documento_id" value={doc.id_documento} />
                  <input type="hidden" name="redirect_to" value={redirectTo} />
                  <button type="submit" style={{ padding: "4px 8px", cursor: "pointer" }}>
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>No hay documentos.</div>
        )}
      </div>
    )}
  </div>
);
}
