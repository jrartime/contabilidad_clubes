import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { addPresupuestoProgramaAction, removePresupuestoProgramaAction } from "./actions";

export type ProgramaPresupuestoItem = {
  id_presupuesto_programa: number;
  id_programa: number;
  programa: string;
  anio: number | null;
  activo: boolean;
};

export type ProgramaCompatibleOption = {
  id_programa: number;
  programa: string;
  anio: number | null;
  activo: boolean;
};

/**
 * Presenta las relaciones actuales y, solo para editores de borradores, los
 * controles que invocan Server Actions. No realiza escrituras en navegador.
 */
export function PresupuestoProgramas({
  presupuestoId,
  incluidos,
  compatibles,
  canModify,
  subvencionSinProgramas,
  returnTo,
}: {
  presupuestoId: number;
  incluidos: ProgramaPresupuestoItem[];
  compatibles: ProgramaCompatibleOption[];
  canModify: boolean;
  subvencionSinProgramas: boolean;
  returnTo: string;
}) {
  return (
    <section className="presupuesto-programas-section">
      <div>
        <h3>Programas incluidos</h3>
        <p>Segmentos contables que forman parte de este presupuesto.</p>
      </div>

      {incluidos.length ? (
        <div className="presupuesto-programas-list">
          {incluidos.map((item) => (
            <div className="presupuesto-programa-row" key={item.id_presupuesto_programa}>
              <div>
                <strong>{item.programa}</strong>
                <span>{item.anio ?? "Sin año"}</span>
                <span className={item.activo ? "programa-activo" : "programa-inactivo"}>
                  {item.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              {canModify ? (
                <form action={removePresupuestoProgramaAction}>
                  {/* La acción solo confía en el ID; club y permisos se resuelven en servidor. */}
                  <input type="hidden" name="id_presupuesto_programa" value={item.id_presupuesto_programa} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <ConfirmSubmitButton
                    message={`¿Quitar "${item.programa}" de este presupuesto?`}
                    className="presupuesto-quitar-programa"
                    ariaLabel={`Quitar ${item.programa}`}
                  >
                    Quitar
                  </ConfirmSubmitButton>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="presupuesto-programas-empty">
          <p>Este presupuesto todavía no tiene programas contables incluidos.</p>
          {canModify ? <p>Añade al menos uno antes de poder cerrar el presupuesto.</p> : null}
        </div>
      )}

      {subvencionSinProgramas ? (
        <div className="presupuesto-programas-warning">
          Esta subvención todavía no tiene programas contables asociados.
        </div>
      ) : canModify ? (
        compatibles.length ? (
          <form action={addPresupuestoProgramaAction} className="presupuesto-programa-add-form">
            {/* presupuesto_id identifica la cabecera; la acción obtiene club y usuario por sesión. */}
            <input type="hidden" name="presupuesto_id" value={presupuestoId} />
            <input type="hidden" name="return_to" value={returnTo} />
            <label>
              <span className="sr-only">Seleccionar programa compatible</span>
              <select name="programa_id" required defaultValue="">
                <option value="" disabled>Seleccionar programa compatible</option>
                {compatibles.map((programa) => (
                  <option key={programa.id_programa} value={programa.id_programa}>
                    {programa.programa} · {programa.anio ?? "sin año"}{programa.activo ? "" : " · inactivo"}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Añadir</button>
          </form>
        ) : (
          <div className="presupuesto-programas-warning">
            No hay más programas compatibles disponibles para este presupuesto.
          </div>
        )
      ) : null}
    </section>
  );
}
