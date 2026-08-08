import { formatDecimal } from "@/lib/format";

type Naturaleza = "gasto" | "ingreso";

export type EjecucionPresupuestoItem = {
  idPartida: number;
  conceptoId: number;
  concepto: string;
  naturaleza: Naturaleza;
  presupuestadoCents: bigint;
  /** NULL distingue un cero real de la ausencia de una fuente contable fiable. */
  ejecutadoCents: bigint | null;
};

/** Formatea céntimos exactos; los numeric(14,2) caben en el entero seguro de JS. */
function formatMoney(cents: bigint) {
  return `${formatDecimal(Number(cents) / 100)} €`;
}

/**
 * Calcula centésimas de porcentaje con enteros y redondeo al céntimo. No
 * limita el resultado a 100 %, por lo que representa también sobre-ejecución.
 */
function formatExecutionPercentage(executed: bigint | null, budgeted: bigint) {
  if (executed === null || budgeted === BigInt(0)) return "—";
  const negative = executed < BigInt(0);
  const absolute = negative ? -executed : executed;
  const hundredths = (absolute * BigInt(10000) + budgeted / BigInt(2)) / budgeted;
  const signed = negative ? -hundredths : hundredths;
  return `${formatDecimal(Number(signed) / 100)} %`;
}

/** Suma importes opcionales sin convertirlos a coma flotante. */
function sumKnownExecution(items: EjecucionPresupuestoItem[]) {
  return items.reduce(
    (total, item) => total + (item.ejecutadoCents ?? BigInt(0)),
    BigInt(0)
  );
}

/**
 * Presenta una naturaleza. Los gastos usan contabilidad.importe_imputado; los
 * ingresos conservan NULL porque el modelo real todavía no ofrece una fuente
 * contable coherente y Banco queda expresamente fuera de esta fase.
 */
function ExecutionGroup({
  title,
  items,
}: {
  title: "Gastos" | "Ingresos";
  items: EjecucionPresupuestoItem[];
}) {
  const budgeted = items.reduce((total, item) => total + item.presupuestadoCents, BigInt(0));
  const hasAccountingSource = items.every((item) => item.ejecutadoCents !== null);
  const executed = hasAccountingSource ? sumKnownExecution(items) : null;
  const difference = executed === null ? null : budgeted - executed;

  return (
    <section className="presupuesto-ejecucion-group">
      <h4>{title}</h4>
      <div className="presupuesto-ejecucion-table-wrap">
        <table className="presupuesto-ejecucion-table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Presupuestado</th>
              <th>Ejecutado</th>
              <th>Diferencia</th>
              <th>Ejecución</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const itemDifference = item.ejecutadoCents === null
                ? null
                : item.presupuestadoCents - item.ejecutadoCents;
              const overExecution = itemDifference !== null && itemDifference < BigInt(0);
              return (
                <tr key={item.idPartida} className={overExecution ? "ejecucion-over" : undefined}>
                  <td>
                    <strong>{item.concepto}</strong>
                    {/* conceptoId se conserva en el modelo aunque no se exponga como dato técnico. */}
                  </td>
                  <td>{formatMoney(item.presupuestadoCents)}</td>
                  <td>{item.ejecutadoCents === null ? "Sin dato contable" : formatMoney(item.ejecutadoCents)}</td>
                  <td>{itemDifference === null ? "—" : formatMoney(itemDifference)}</td>
                  <td>{formatExecutionPercentage(item.ejecutadoCents, item.presupuestadoCents)}</td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr><td colSpan={5} className="ejecucion-empty">Sin partidas de {title.toLocaleLowerCase("es")}.</td></tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className={difference !== null && difference < BigInt(0) ? "ejecucion-over" : undefined}>
              <th>Total {title.toLocaleLowerCase("es")}</th>
              <th>{formatMoney(budgeted)}</th>
              <th>{executed === null ? "Sin dato contable" : formatMoney(executed)}</th>
              <th>{difference === null ? "—" : formatMoney(difference)}</th>
              <th>{formatExecutionPercentage(executed, budgeted)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/**
 * Comparativa de solo lectura. La agrupación ya respeta catálogo actual o
 * snapshots porque recibe las partidas normalizadas por el Server Component.
 */
export function PresupuestoEjecucion({ items }: { items: EjecucionPresupuestoItem[] }) {
  const gastos = items.filter((item) => item.naturaleza === "gasto");
  const ingresos = items.filter((item) => item.naturaleza === "ingreso");

  return (
    <section className="presupuesto-ejecucion-section">
      <div>
        <h3>Presupuestado vs Ejecutado</h3>
        <p>El ejecutado de gastos procede exclusivamente de Contabilidad y de los programas incluidos.</p>
      </div>
      <ExecutionGroup title="Gastos" items={gastos} />
      <ExecutionGroup title="Ingresos" items={ingresos} />
      <p className="presupuesto-ejecucion-note">
        Los ingresos figuran como sin dato contable porque actualmente no existe ejecución de ingresos
        registrada de forma consistente en Contabilidad. No se utilizan movimientos de Banco.
      </p>
    </section>
  );
}
