import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { Icon } from "@/components/Icon";
import ImportarCostesClient from "./ImportarCostesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ImportarCostesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const [
    { data: personal },
    { data: programas },
    { data: conceptos },
    { data: categorias },
    { data: entidades },
    { data: proveedores },
  ] = await Promise.all([
    supabase
      .from("personal")
      .select("id_personal, nombre")
      .eq("club_id", clubId)
      .eq("activo", true)
      .order("nombre", { ascending: true }),
    supabase
      .from("programas")
      .select("id_programa, programa, anio")
      .eq("club_id", clubId)
      .eq("activo", true)
      .order("programa", { ascending: true }),
    supabase
      .from("conceptos")
      .select("id_concepto, concepto")
      .order("concepto", { ascending: true }),
    supabase
      .from("categorias")
      .select("id_categoria, categoria")
      .order("id_categoria", { ascending: true }),
    supabase
      .from("entidades")
      .select("id_entidad, entidad")
      .order("entidad", { ascending: true }),
    supabase
      .from("proveedores")
      .select("id_proveedor, proveedor")
      .eq("club_id", clubId)
      .eq("activo", true)
      .order("proveedor", { ascending: true }),
  ]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link href="/nominas" className="icon-button icon-button-secondary" aria-label="Volver a nóminas" title="Volver a nóminas">
          <Icon name="logout" />
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
          Importar costes laborales desde Excel
        </h1>
      </div>

      <ImportarCostesClient
        personal={personal ?? []}
        programas={programas ?? []}
        conceptos={conceptos ?? []}
        categorias={categorias ?? []}
        entidades={entidades ?? []}
        proveedores={proveedores ?? []}
      />
    </div>
  );
}
