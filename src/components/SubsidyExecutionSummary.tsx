import { formatDecimal } from "@/lib/format";

export function SubsidyExecutionSummary({
  programa,
  anio,
  subvencion,
  ingresosBanco,
  ejecutado,
  fechaLimite,
}: {
  programa: string;
  anio?: number | null;
  subvencion: number;
  ingresosBanco: number;
  ejecutado: number;
  fechaLimite?: string | null;
}) {
  const pendiente = Math.max(0, subvencion - ejecutado);
  const porcentaje = subvencion > 0 ? (ejecutado / subvencion) * 100 : 0;
  const cards = [
    { label: "Subvención", value: `${formatDecimal(subvencion)} €` },
    {
      label: "Ingresos banco",
      value: `${formatDecimal(ingresosBanco)} €`,
      color: ingresosBanco > 0 ? "#1a6b2e" : undefined,
    },
    { label: "Ejecutado", value: `${formatDecimal(ejecutado)} €` },
    {
      label: "Pendiente",
      value: `${formatDecimal(pendiente)} €`,
      color: pendiente > 0 ? "#92580a" : "#1a6b2e",
    },
    {
      label: "% ejecución",
      value: `${porcentaje.toFixed(1).replace(".", ",")}%`,
      color: porcentaje > 100 ? "#b93a48" : porcentaje >= 80 ? "#92580a" : undefined,
    },
    { label: "Fecha límite", value: fechaLimite ?? "-" },
  ];

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800 }}>
        Resumen de ejecución de la subvención
      </div>
      <div style={{ fontWeight: 700 }}>
        {anio ? `[${anio}] ` : ""}
        {programa}
      </div>
      <div
        className="conta-totals-subv-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}
      >
        {cards.map((card) => (
          <div key={card.label} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                marginBottom: 4,
              }}
            >
              {card.label}
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 1000px) {
          .conta-totals-subv-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 700px) {
          .conta-totals-subv-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}
