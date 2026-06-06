import Link from "next/link";

export default function NoAutorizado() {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>No autorizado</h1>
      <p>No tienes permisos para acceder a esta sección.</p>
      <Link href="/">Volver al inicio</Link>
    </div>
  );
}
