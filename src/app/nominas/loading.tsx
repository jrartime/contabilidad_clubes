export default function NominasLoading() {
  return (
    <div className="app-main">
      <div>
        {/* Toolbar */}
        <div className="page-toolbar">
          <div style={{ width: 100, height: 28, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 120, height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: 150, height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ width: 36, height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
          </div>
        </div>

        {/* Filtros */}
        <div className="filters-grid" style={{ marginBottom: 20 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gap: 6 }}>
              <div style={{ width: 65, height: 14, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ height: 36, borderRadius: 6, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          ))}
        </div>

        {/* Totales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {["Bruto", "SS", "Total imputado"].map((label) => (
            <div key={label} style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, display: "grid", gap: 8 }}>
              <div style={{ width: "50%", height: 12, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
              <div style={{ width: "75%", height: 20, borderRadius: 4, background: "#e5e7eb", animation: "pulse 1.5s ease-in-out infinite" }} />
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 90px 90px 90px 80px", gap: 16, padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ height: 12, borderRadius: 4, background: "#d1d5dc", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr 90px 90px 90px 80px", gap: 16, padding: "10px 16px", borderBottom: "1px solid #f3f4f6", opacity: 1 - i * 0.08 }}>
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
