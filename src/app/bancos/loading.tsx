export default function BancosLoading() {
  return (
    <div className="app-main">
      <div>
        {/* Toolbar */}
        <div className="page-toolbar">
          <div style={{ width: 80, height: 28, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 140, height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: 36, height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Filtros */}
        <div className="filters-grid" style={{ marginBottom: 20 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gap: 6 }}>
              <div style={{ width: 70, height: 14, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          ))}
        </div>

        {/* Totales */}
        <div style={{ display: "flex", gap: 24, marginBottom: 20, padding: "16px", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          {["Debe", "Haber", "Importe"].map((label) => (
            <div key={label} style={{ display: "grid", gap: 6 }}>
              <div style={{ width: 50, height: 12, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ width: 90, height: 20, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 80px 80px 80px 80px 80px", gap: 16, padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ height: 12, borderRadius: 4, background: "#d1d5dc", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 80px 80px 80px 80px 80px", gap: 16, padding: "10px 16px", borderBottom: "1px solid #f3f4f6", opacity: 1 - i * 0.07 }}>
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} style={{ height: 14, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
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
