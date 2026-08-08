"use client";

import { useState } from "react";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Icon } from "@/components/Icon";
import { avisoConcepto, type ConceptoConfigurable, type TipoPrograma } from "@/lib/conceptRules";
import { formatDecimal, toDecimalInputValue } from "@/lib/format";
import {
  addPresupuestoPartidaAction,
  removePresupuestoPartidaAction,
  updatePresupuestoPartidaAction,
} from "./actions";

type Naturaleza = "gasto" | "ingreso";
type Subvencionabilidad = "subvencionable" | "condicionada" | "no_subvencionable";
type RequisitoDescripcion = "no" | "opcional" | "obligatoria";

export type ConceptoPresupuestoOption = ConceptoConfigurable & {
  id_concepto: number;
  naturaleza: Naturaleza;
  requisito_descripcion: RequisitoDescripcion;
  subvencionabilidad: Subvencionabilidad;
};

export type PresupuestoPartidaItem = {
  id_partida: number;
  concepto_id: number;
  concepto: string;
  naturaleza: Naturaleza;
  requisito_descripcion: RequisitoDescripcion;
  subvencionabilidad: Subvencionabilidad;
  descripcion: string | null;
  importe_presupuestado: number;
  orden: number;
  /** Indica que nombre, naturaleza y subvencionabilidad proceden del snapshot de cierre. */
  historical: boolean;
};

/** Etiquetas compartidas por filas y selector sin crear un catálogo de conceptos. */
const SUBVENCIONABILIDAD_LABELS: Record<Subvencionabilidad, string> = {
  subvencionable: "Subvencionable",
  condicionada: "Condicionada",
  no_subvencionable: "No subvencionable",
};

/** Muestra avisos informativos; en borrador ninguno de ellos bloquea la partida. */
function ConceptoWarnings({
  concepto,
  tipoPrograma,
  presupuestoConSubvencion,
}: {
  concepto: ConceptoPresupuestoOption | PresupuestoPartidaItem;
  tipoPrograma: TipoPrograma;
  presupuestoConSubvencion: boolean;
}) {
  const historical = "historical" in concepto && concepto.historical;
  // Los avisos del catálogo solo se calculan en borrador. En cerrados no se
  // reconstruye ninguna interpretación a partir de reglas actuales.
  const warning = historical ? null : avisoConcepto(tipoPrograma, concepto);
  return (
    <div className="partida-concepto-meta">
      <span className={`partida-subsidio partida-subsidio-${concepto.subvencionabilidad}`}>
        {SUBVENCIONABILIDAD_LABELS[concepto.subvencionabilidad]}
      </span>
      <span>{concepto.naturaleza === "gasto" ? "Gasto" : "Ingreso"}</span>
      {!historical ? (
        <span>{concepto.requisito_descripcion === "obligatoria" ? "Descripción obligatoria" : "Descripción no obligatoria"}</span>
      ) : (
        <span>Interpretación histórica congelada</span>
      )}
      {concepto.subvencionabilidad === "condicionada" && warning ? (
        <small className="partida-warning-conditioned">{warning}</small>
      ) : null}
      {!historical && presupuestoConSubvencion && concepto.subvencionabilidad === "no_subvencionable" ? (
        <small className="partida-warning-no-subsidio">
          Este concepto impedirá cerrar un presupuesto vinculado a subvención.
        </small>
      ) : null}
    </div>
  );
}

/**
 * Renderiza una naturaleza por separado. La agrupación procede siempre del
 * valor recibido por el Server Component: catálogo en borrador y snapshot en
 * un presupuesto cerrado.
 */
function PartidasGroup({
  title,
  items,
  total,
  canModify,
  presupuestoId,
  returnTo,
  tipoPrograma,
  presupuestoConSubvencion,
}: {
  title: string;
  items: PresupuestoPartidaItem[];
  total: string;
  canModify: boolean;
  presupuestoId: number;
  returnTo: string;
  tipoPrograma: TipoPrograma;
  presupuestoConSubvencion: boolean;
}) {
  return (
    <section className="partidas-naturaleza">
      <h4>{title}</h4>
      {items.length ? (
        <div className="partidas-list">
          {items.map((item) => (
            <article key={item.id_partida} className="partida-row">
              <div className="partida-row-header">
                <strong>{item.concepto}</strong>
                {!canModify ? <b>{formatDecimal(item.importe_presupuestado)} €</b> : null}
              </div>
              <ConceptoWarnings
                concepto={item}
                tipoPrograma={tipoPrograma}
                presupuestoConSubvencion={presupuestoConSubvencion}
              />
              {canModify ? (
                <form action={updatePresupuestoPartidaAction} className="partida-edit-form">
                  {/* IDs se revalidan contra presupuesto y club dentro de la Server Action. */}
                  <input type="hidden" name="presupuesto_id" value={presupuestoId} />
                  <input type="hidden" name="id_partida" value={item.id_partida} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <label>
                    Descripción
                    <input
                      name="descripcion"
                      defaultValue={item.descripcion ?? ""}
                      required={item.requisito_descripcion === "obligatoria"}
                    />
                  </label>
                  <label>
                    Importe presupuestado
                    <input
                      name="importe_presupuestado"
                      inputMode="decimal"
                      required
                      defaultValue={toDecimalInputValue(item.importe_presupuestado)}
                    />
                  </label>
                  <button type="submit" className="icon-button tooltip-button" aria-label={`Guardar ${item.concepto}`}>
                    <Icon name="save" />
                  </button>
                </form>
              ) : item.descripcion ? (
                <p className="partida-descripcion">{item.descripcion}</p>
              ) : null}
              {canModify ? (
                <form action={removePresupuestoPartidaAction} className="partida-remove-form">
                  <input type="hidden" name="presupuesto_id" value={presupuestoId} />
                  <input type="hidden" name="id_partida" value={item.id_partida} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <ConfirmSubmitButton
                    message={`¿Eliminar la partida "${item.concepto}"?`}
                    className="presupuesto-quitar-programa"
                    ariaLabel={`Eliminar partida ${item.concepto}`}
                  >
                    Eliminar
                  </ConfirmSubmitButton>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="partidas-group-empty">Sin {title.toLocaleLowerCase("es")}.</p>
      )}
      <div className="partidas-total"><span>Total {title.toLocaleLowerCase("es")}</span><strong>{total} €</strong></div>
    </section>
  );
}

/**
 * Gestiona la presentación de partidas. Los importes ya vienen totalizados de
 * forma segura por el servidor. En modo histórico, los campos interpretativos
 * proceden exclusivamente de los snapshots guardados al cerrar.
 */
export function PresupuestoPartidas({
  presupuestoId,
  tipoPrograma,
  presupuestoConSubvencion,
  partidas,
  conceptosDisponibles,
  totalGastos,
  totalIngresos,
  diferencia,
  canModify,
  returnTo,
}: {
  presupuestoId: number;
  tipoPrograma: TipoPrograma;
  presupuestoConSubvencion: boolean;
  partidas: PresupuestoPartidaItem[];
  conceptosDisponibles: ConceptoPresupuestoOption[];
  totalGastos: string;
  totalIngresos: string;
  diferencia: string;
  canModify: boolean;
  returnTo: string;
}) {
  const [selectedConceptoId, setSelectedConceptoId] = useState("");
  const selectedConcepto = conceptosDisponibles.find(
    (concepto) => String(concepto.id_concepto) === selectedConceptoId
  );
  const gastos = partidas.filter((item) => item.naturaleza === "gasto");
  const ingresos = partidas.filter((item) => item.naturaleza === "ingreso");

  return (
    <section className="presupuesto-partidas-section">
      <div>
        <h3>Partidas presupuestarias</h3>
        <p>
          {partidas.some((partida) => partida.historical)
            ? "Gastos e ingresos según los conceptos congelados al cerrar."
            : "Gastos e ingresos derivados del catálogo actual de conceptos."}
        </p>
      </div>

      {!partidas.length ? (
        <div className="presupuesto-programas-empty">
          <p>Este presupuesto todavía no tiene partidas.</p>
          {canModify ? <p>Añade gastos e ingresos para construir el presupuesto.</p> : null}
        </div>
      ) : null}

      <PartidasGroup
        title="Gastos"
        items={gastos}
        total={totalGastos}
        canModify={canModify}
        presupuestoId={presupuestoId}
        returnTo={returnTo}
        tipoPrograma={tipoPrograma}
        presupuestoConSubvencion={presupuestoConSubvencion}
      />
      <PartidasGroup
        title="Ingresos"
        items={ingresos}
        total={totalIngresos}
        canModify={canModify}
        presupuestoId={presupuestoId}
        returnTo={returnTo}
        tipoPrograma={tipoPrograma}
        presupuestoConSubvencion={presupuestoConSubvencion}
      />

      <div className="partidas-diferencia">
        <span>Diferencia (ingresos − gastos)</span>
        <strong>{diferencia} €</strong>
      </div>

      {canModify ? (
        conceptosDisponibles.length ? (
          <form action={addPresupuestoPartidaAction} className="partida-add-form">
            {/* No se envían naturaleza ni snapshots; ambos proceden de PostgreSQL. */}
            <input type="hidden" name="presupuesto_id" value={presupuestoId} />
            <input type="hidden" name="return_to" value={returnTo} />
            <label>
              Concepto
              <select
                name="concepto_id"
                required
                value={selectedConceptoId}
                onChange={(event) => setSelectedConceptoId(event.target.value)}
              >
                <option value="" disabled>Seleccionar concepto</option>
                <optgroup label="Gastos">
                  {conceptosDisponibles.filter((item) => item.naturaleza === "gasto").map((item) => (
                    <option key={item.id_concepto} value={item.id_concepto}>{item.concepto}</option>
                  ))}
                </optgroup>
                <optgroup label="Ingresos">
                  {conceptosDisponibles.filter((item) => item.naturaleza === "ingreso").map((item) => (
                    <option key={item.id_concepto} value={item.id_concepto}>{item.concepto}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            {selectedConcepto ? (
              <ConceptoWarnings
                concepto={selectedConcepto}
                tipoPrograma={tipoPrograma}
                presupuestoConSubvencion={presupuestoConSubvencion}
              />
            ) : null}
            <label>
              Descripción
              <input
                name="descripcion"
                required={selectedConcepto?.requisito_descripcion === "obligatoria"}
                placeholder={selectedConcepto?.requisito_descripcion === "obligatoria" ? "Obligatoria" : "Opcional"}
              />
            </label>
            <label>
              Importe presupuestado
              <input name="importe_presupuestado" inputMode="decimal" required placeholder="0,00" />
            </label>
            <button type="submit" disabled={!selectedConceptoId}>Añadir</button>
          </form>
        ) : (
          <div className="presupuesto-programas-warning">
            No hay más conceptos disponibles para este presupuesto.
          </div>
        )
      ) : null}
    </section>
  );
}
