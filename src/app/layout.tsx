import "./globals.css";
import Link from "next/link";
import { getActiveClubContext } from "@/lib/club";
import { getCurrentUser } from "@/lib/supabase/server";
import { AppTabs, type AppTab } from "@/components/AppTabs";
import { Icon } from "@/components/Icon";
import {
  canAccessConciliation,
  canEditClubData,
  canManageMembers,
  type ClubRole,
} from "@/lib/clubRole";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeClubContext, user] = await Promise.all([
    getActiveClubContext(),
    getCurrentUser(),
  ]);
  const activeClubId = activeClubContext?.clubId ?? null;
  const userEmail = user?.email ?? null;

  const activeClubName = activeClubContext?.clubName ?? null;
  const myRole = (activeClubContext?.role ?? null) as ClubRole | null;

  const showConciliacion = !!activeClubId && canAccessConciliation(myRole);
  const showEditModules = !!activeClubId && canEditClubData(myRole);
  const showMembers = !!activeClubId && canManageMembers(myRole);
  const showNominas = !!activeClubId && canEditClubData(myRole);
  const showPersonal = !!activeClubId;

  const tabs: AppTab[] = [
    { href: "/", label: "Inicio" },
    ...(showConciliacion
      ? [{ href: "/conciliacion/1a1", label: "Conciliacion" }]
      : []),
    ...(showEditModules
      ? [
          { href: "/contabilidad", label: "Contabilidad" },
          { href: "/bancos", label: "Banco" },
        ]
      : []),
    ...(showNominas ? [{ href: "/nominas", label: "Nominas" }] : []),
    ...((showEditModules || showPersonal || showMembers) ? [{ href: "/configuracion", label: "Configuración" }] : []),
  ];

  return (
    <html lang="es">
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="app-header-main">
              <Link href="/" className="app-title">
                <span className="app-logo-mark" aria-hidden="true">
                  PS
                </span>
                <span>Panel Subvenciones</span>
              </Link>

              <div className="app-club">
                <span className="app-meta-label">Club</span>
                <strong>
                  {activeClubId
                    ? `${activeClubName ?? "Club"} #${activeClubId}`
                    : "Sin club activo"}
                </strong>
              </div>
            </div>

            <div className="app-header-meta">
              <div className="app-meta-item">
                <span className="app-meta-label">Sesion</span>
                <strong>{userEmail ?? "-"}</strong>
              </div>

              <div className="app-meta-item">
                <span className="app-meta-label">Rol</span>
                <strong>{myRole ?? "-"}</strong>
              </div>

              <Link href="/clubs" className="app-action-link app-action-link-secondary">
                Cambiar club
              </Link>

              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="icon-button"
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                >
                  <Icon name="logout" />
                </button>
              </form>
            </div>
          </header>

          <AppTabs tabs={tabs} />

          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
