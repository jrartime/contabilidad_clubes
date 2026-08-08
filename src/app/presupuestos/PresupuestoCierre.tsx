import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { closePresupuestoAction } from "./actions";

export type CierreCheck = {
  label: string;
  ok: boolean;
  detail?: string;
};

/**
 * Presenta las comprobaciones de conveniencia calculadas por Next.js. No son
 * una barrera de seguridad: al enviar el formulario, PostgreSQL repite todas
 * las reglas dentro de la misma transacción que crea los snapshots.
 */
export function PresupuestoCierre({
  presupuestoId,
  estado,
  cerradoAt,
  checks,
  canClose,
  returnTo,
}: {
  presupuestoId: number;
  estado: "borrador" | "cerrado";
  cerradoAt: string | null;
  checks: CierreCheck[];
  canClose: boolean;
  returnTo: string;
}) {
  if (estado === "cerrado") {
    return (
      <section className="presupuesto-cierre presupuesto-cierre-closed">
        <div>
          <h3>Estado del presupuesto</h3>
          <p><strong>Estado:</strong> Cerrado</p>
          <p><strong>Cerrado el:</strong> {cerradoAt ?? "Fecha no disponible"}</p>
        </div>
        <p className="presupuesto-cierre-warning">
          Este presupuesto está cerrado y no admite modificaciones.
        </p>
      </section>
    );
  }

  const ready = checks.every((check) => check.ok);

  return (
    <section className="presupuesto-cierre">
      <div>
        <h3>Estado del presupuesto</h3>
        <p>Comprobaciones informativas previas al cierre.</p>
      </div>

      <ul className="presupuesto-cierre-checks">
        {checks.map((check) => (
          <li key={check.label} className={check.ok ? "check-ok" : "check-pending"}>
            <span aria-hidden="true">{check.ok ? "✓" : "✕"}</span>
            <div>
              <strong>{check.label}</strong>
              {check.detail ? <small>{check.detail}</small> : null}
            </div>
          </li>
        ))}
      </ul>

      <p className={ready ? "presupuesto-cierre-ready" : "presupuesto-cierre-pending"}>
        {ready ? "Preparado para cerrar." : "No se puede cerrar todavía."}
      </p>

      {canClose ? (
        <form action={closePresupuestoAction}>
          {/* Solo se envía el ID; usuario, rol y club activo se resuelven de nuevo en servidor. */}
          <input type="hidden" name="presupuesto_id" value={presupuestoId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <fieldset disabled={!ready} className="presupuesto-cierre-fieldset">
            <ConfirmSubmitButton
              className="presupuesto-close-button"
              ariaLabel="Cerrar presupuesto"
              message="Al cerrar el presupuesto quedará bloqueado y sus conceptos se congelarán históricamente. No podrá editarse después. ¿Deseas continuar?"
            >
              Cerrar presupuesto
            </ConfirmSubmitButton>
          </fieldset>
        </form>
      ) : null}
    </section>
  );
}
