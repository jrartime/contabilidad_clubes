import { redirect } from "next/navigation";
import { getActiveClubId } from "@/lib/club";
import { getMyClubRole, canManageMembers, type ClubRole } from "@/lib/clubRole";

type Permission = {
  label: string;
  description: string;
  roles: ClubRole[];
};

const PERMISSIONS: Permission[] = [
  {
    label: "Ver contabilidad y nóminas",
    description: "Acceso a los módulos de contabilidad, banco y nóminas",
    roles: ["owner", "admin", "manager"],
  },
  {
    label: "Editar contabilidad y nóminas",
    description: "Crear, editar y eliminar registros contables y de nóminas",
    roles: ["owner", "admin", "manager"],
  },
  {
    label: "Conciliación bancaria",
    description: "Acceso al módulo de conciliación 1 a 1",
    roles: ["owner", "admin", "manager"],
  },
  {
    label: "Gestionar proveedores y programas",
    description: "Crear y editar proveedores, programas y conceptos",
    roles: ["owner", "admin", "manager"],
  },
  {
    label: "Gestionar personal",
    description: "Ver y editar el personal del club",
    roles: ["owner", "admin", "manager", "viewer"],
  },
  {
    label: "Gestionar miembros",
    description: "Añadir, editar y eliminar miembros del club",
    roles: ["owner", "admin"],
  },
  {
    label: "Invitar usuarios",
    description: "Enviar invitaciones por email a nuevos usuarios",
    roles: ["owner", "admin"],
  },
  {
    label: "Configuración del club",
    description: "Acceso completo a la sección de configuración",
    roles: ["owner", "admin", "manager"],
  },
];

const ROLES: { role: ClubRole; label: string; description: string; color: string }[] = [
  {
    role: "owner",
    label: "Owner",
    description: "Propietario del club. Acceso total sin restricciones.",
    color: "#7c3aed",
  },
  {
    role: "admin",
    label: "Admin",
    description: "Administrador. Puede gestionar miembros y toda la operativa.",
    color: "#2563eb",
  },
  {
    role: "manager",
    label: "Manager",
    description: "Gestor. Puede operar contabilidad y nóminas pero no gestionar miembros.",
    color: "#0891b2",
  },
  {
    role: "viewer",
    label: "Viewer",
    description: "Solo puede ver el personal del club. Sin acceso a datos económicos.",
    color: "#64748b",
  },
];

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#16a34a" }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "#d1d5db" }}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

export default async function RolesPage() {
  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canManageMembers(myRole)) redirect("/no-autorizado");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Roles y permisos</h1>
      <p style={{ marginTop: 0, marginBottom: 24, opacity: 0.7, fontSize: 14 }}>
        Descripción de los niveles de acceso disponibles en el club.
      </p>

      {/* Tarjetas de roles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
        {ROLES.map(({ role, label, description, color }) => (
          <div key={role} style={{ border: `1px solid ${color}22`, borderRadius: 10, padding: 14, background: `${color}08` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                background: color,
                color: "#fff",
              }}>
                {label}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8, lineHeight: 1.4 }}>{description}</p>
          </div>
        ))}
      </div>

      {/* Tabla de permisos */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Tabla de permisos</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, width: "40%" }}>
                Permiso
              </th>
              {ROLES.map(({ role, label, color }) => (
                <th key={role} style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, color }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((perm, i) => (
              <tr
                key={perm.label}
                style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? undefined : "#fafafa" }}
              >
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 600 }}>{perm.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{perm.description}</div>
                </td>
                {ROLES.map(({ role }) => (
                  <td key={role} style={{ textAlign: "center", padding: "10px 12px" }}>
                    {perm.roles.includes(role) ? <Check /> : <Cross />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
