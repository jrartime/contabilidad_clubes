"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SUBTABS = [
  { href: "/configuracion/proveedores", label: "Proveedores" },
  { href: "/configuracion/programas", label: "Programas" },
  { href: "/configuracion/personal", label: "Personal" },
  { href: "/configuracion/conceptos", label: "Conceptos" },
  { href: "/configuracion/miembros", label: "Miembros" },
];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <nav style={{ display: "flex", gap: 4, borderBottom: "2px solid var(--border)", marginBottom: 24, paddingBottom: 0 }}>
        {SUBTABS.map(tab => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link key={tab.href} href={tab.href} style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: active ? 750 : 600,
              color: active ? "var(--primary)" : "var(--muted)",
              borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -2,
              textDecoration: "none",
            }}>
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
