"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { Database } from "@/lib/supabase/database.types";
import { createPresupuesto, updatePresupuestoHeader } from "./actions";

type PresupuestoRow = Database["public"]["Tables"]["presupuestos"]["Row"];
type SubvencionRow = Database["public"]["Tables"]["subvenciones"]["Row"];
type TipoPrograma = "clubes" | "eventos" | "eedd_ctd_discapacidad";
type PeriodoTipo = "ejercicio" | "temporada" | "evento";

/** Campos editables de una cabecera existente; en alta se reciben como null. */
type EditableHeader = Pick<
  PresupuestoRow,
  | "id_presupuesto"
  | "nombre"
  | "tipo_programa"
  | "subtipo_programa"
  | "periodo_tipo"
  | "anio_inicio"
  | "anio_fin"
  | "fecha_inicio"
  | "fecha_fin"
  | "subvencion_id"
  | "observaciones"
>;

const DEFAULT_PERIOD_BY_TYPE: Record<TipoPrograma, PeriodoTipo> = {
  clubes: "ejercicio",
  eventos: "evento",
  eedd_ctd_discapacidad: "temporada",
};

/**
 * Formulario cliente limitado a comportamiento visual. La escritura real se
 * delega siempre en Server Actions, que resuelven permisos y club activo.
 */
export function PresupuestoHeaderForm({
  initial,
  subvenciones,
  returnTo,
}: {
  initial: EditableHeader | null;
  subvenciones: Pick<SubvencionRow, "id_subvencion" | "nombre" | "anio">[];
  returnTo: string;
}) {
  const initialType = (initial?.tipo_programa ?? "clubes") as TipoPrograma;
  const [tipoPrograma, setTipoPrograma] = useState<TipoPrograma>(initialType);
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>(
    (initial?.periodo_tipo ?? DEFAULT_PERIOD_BY_TYPE[initialType]) as PeriodoTipo
  );
  const action = initial ? updatePresupuestoHeader : createPresupuesto;

  /** Al cambiar familia se elimina el subtipo incompatible y se propone su periodo habitual. */
  function changeTipo(next: TipoPrograma) {
    setTipoPrograma(next);
    setPeriodoTipo(DEFAULT_PERIOD_BY_TYPE[next]);
  }

  return (
    <form id="presupuesto-header-form" action={action} className="side-drawer-body">
      {/* Solo se envían ID de registro y retorno; club_id nunca sale del servidor. */}
      <input type="hidden" name="id_presupuesto" value={initial?.id_presupuesto ?? ""} />
      <input type="hidden" name="return_to" value={returnTo} />

      <label>
        Nombre
        <input name="nombre" required maxLength={200} defaultValue={initial?.nombre ?? ""} />
      </label>

      <div className="presupuesto-form-grid">
        <label>
          Tipo de programa
          <select
            name="tipo_programa"
            required
            value={tipoPrograma}
            onChange={(event) => changeTipo(event.target.value as TipoPrograma)}
          >
            <option value="clubes">Clubes deportivos</option>
            <option value="eventos">Eventos y competiciones</option>
            <option value="eedd_ctd_discapacidad">EEDD / CTD</option>
          </select>
        </label>

        {tipoPrograma === "eedd_ctd_discapacidad" ? (
          <label>
            Subtipo
            <select name="subtipo_programa" required defaultValue={initial?.subtipo_programa ?? "eedd"}>
              <option value="eedd">Escuela Deportiva</option>
              <option value="ctd">Centro de Tecnificación</option>
              <option value="eedd_discapacidad">Escuela Deportiva discapacidad</option>
            </select>
          </label>
        ) : (
          // El valor vacío se normaliza a NULL en la Server Action.
          <input type="hidden" name="subtipo_programa" value="" />
        )}

        <label>
          Periodo
          <select
            name="periodo_tipo"
            required
            value={periodoTipo}
            onChange={(event) => setPeriodoTipo(event.target.value as PeriodoTipo)}
          >
            <option value="ejercicio">Ejercicio</option>
            <option value="temporada">Temporada</option>
            <option value="evento">Evento</option>
          </select>
        </label>

        <label>
          Subvención (opcional)
          <select name="subvencion_id" defaultValue={initial?.subvencion_id ?? ""}>
            <option value="">Presupuesto interno</option>
            {subvenciones.map((subvencion) => (
              <option key={subvencion.id_subvencion} value={subvencion.id_subvencion}>
                {subvencion.anio} · {subvencion.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Año inicial
          <input name="anio_inicio" type="number" required min={2000} max={2200} defaultValue={initial?.anio_inicio ?? new Date().getFullYear()} />
        </label>

        <label>
          Año final
          <input name="anio_fin" type="number" required min={2000} max={2200} defaultValue={initial?.anio_fin ?? new Date().getFullYear()} />
        </label>

        <label>
          Fecha inicial
          <input name="fecha_inicio" type="date" required defaultValue={initial?.fecha_inicio ?? ""} />
        </label>

        <label>
          Fecha final
          <input name="fecha_fin" type="date" required defaultValue={initial?.fecha_fin ?? ""} />
        </label>
      </div>

      <label>
        Observaciones
        <textarea name="observaciones" rows={5} defaultValue={initial?.observaciones ?? ""} />
      </label>

      <div className="drawer-actions">
        <button type="submit" className="icon-button tooltip-button" aria-label={initial ? "Guardar cabecera" : "Crear presupuesto"}>
          <Icon name="save" />
        </button>
        <Link href={returnTo} className="icon-button icon-button-secondary tooltip-button" aria-label="Cancelar">
          <Icon name="logout" />
        </Link>
      </div>
    </form>
  );
}
