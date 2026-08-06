"use client";

import { useMemo, useState } from "react";
import { avisoConcepto, conceptoPermitido, type TipoPrograma } from "@/lib/conceptRules";

type Programa = { id_programa: number; programa: string; anio?: number | null; tipo_programa: TipoPrograma };
type Concepto = { id_concepto: number; concepto: string };

export function ProgramaConceptoFields({ programas, conceptos, programaInicial, conceptoInicial }: {
  programas: Programa[];
  conceptos: Concepto[];
  programaInicial?: number | null;
  conceptoInicial?: number | null;
}) {
  const [programaId, setProgramaId] = useState(programaInicial ? String(programaInicial) : "");
  const [conceptoId, setConceptoId] = useState(conceptoInicial ? String(conceptoInicial) : "");
  const programa = programas.find((p) => String(p.id_programa) === programaId);
  const conceptoActual = conceptos.find((c) => String(c.id_concepto) === conceptoId);
  const opciones = useMemo(
    () => programa ? conceptos.filter((c) => conceptoPermitido(programa.tipo_programa, c.concepto)) : conceptos,
    [conceptos, programa]
  );
  const aviso = programa && conceptoActual ? avisoConcepto(programa.tipo_programa, conceptoActual.concepto) : null;

  const fieldStyle = { height: 32, minHeight: 32, padding: "0 8px", fontSize: 13, width: "100%", boxSizing: "border-box" as const };
  const labelStyle = { fontSize: 12, fontWeight: 600, display: "grid", gap: 4 };

  return <>
    <label style={labelStyle}>
      Concepto
      <select name="concepto_id" value={conceptoId} style={fieldStyle} onChange={(e) => setConceptoId(e.target.value)}>
        <option value="">(sin concepto)</option>
        {opciones.map((c) => <option key={c.id_concepto} value={c.id_concepto}>{c.concepto}</option>)}
      </select>
      {aviso ? <span role="alert" style={{ color: aviso.startsWith("Concepto no") ? "#b42318" : "#92580a", fontWeight: 600 }}>{aviso}</span> : null}
    </label>
    <label style={labelStyle}>
      Programa
      <select name="programa_id" value={programaId} style={fieldStyle} onChange={(e) => {
        const next = e.target.value;
        const nextPrograma = programas.find((p) => String(p.id_programa) === next);
        if (nextPrograma && conceptoActual && !conceptoPermitido(nextPrograma.tipo_programa, conceptoActual.concepto)) {
          alert(`El concepto "${conceptoActual.concepto}" no es válido para ${nextPrograma.programa}. Se ha desmarcado.`);
          setConceptoId("");
        }
        setProgramaId(next);
      }}>
        <option value="">(sin programa)</option>
        {programas.map((p) => <option key={p.id_programa} value={p.id_programa}>{p.anio ? `[${p.anio}] ` : ""}{p.programa}</option>)}
      </select>
    </label>
  </>;
}
