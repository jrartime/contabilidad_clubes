export default function ContabilidadLoading() {
  return (
    <div className="app-main">
      <div>
        {/* Toolbar */}
        <div className="page-toolbar">
          <div style={{ width: 160, height: 28, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 120, height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: 180, height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Filtros */}
        <div className="filters-grid contabilidad-filters" style={{ marginBottom: 20 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gap: 6 }}>
              <div style={{ width: 60, height: 14, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          ))}
        </div>

        {/* Totales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, display: "grid", gap: 8 }}>
              <div style={{ width: "60%", height: 12, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ width: "80%", height: 20, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          {/* Cabecera */}
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 1fr 90px 90px 80px", gap: 16, padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {["Fecha", "Proveedor", "Tipo", "Programa", "Total", "Imputado", ""].map((col) => (
              <div key={col} style={{ height: 12, borderRadius: 4, background: "#d1d5dc", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
          {/* Filas */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 1fr 90px 90px 80px", gap: 16, padding: "12px 16px", borderBottom: "1px solid #f3f4f6", opacity: 1 - i * 0.08 }}>
              <div style={{ height: 14, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 14, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 14, width: "70%", borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 14, width: "85%", borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 14, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 14, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 28, width: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          ))}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.45; }
          }
        `}</style>
      </div>
    </div>
  );
}
