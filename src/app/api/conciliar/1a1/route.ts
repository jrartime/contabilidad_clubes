import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const formData = await req.formData();
  const club_id = Number(formData.get("club_id"));
  const contabilidad_id = Number(formData.get("contabilidad_id"));
  const banco_id = Number(formData.get("banco_id"));

  if (!club_id || !contabilidad_id || !banco_id) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // 1) Leer banco y contabilidad para armar el pago
  const { data: b, error: eb } = await supabase
    .from("bancos")
    .select("fecha_operativa, importe")
    .eq("club_id", club_id)
    .eq("id_banco", banco_id)
    .single();

  if (eb) return NextResponse.json({ error: eb.message }, { status: 400 });

  const { data: c, error: ec } = await supabase
    .from("contabilidad")
    .select("importe_total")
    .eq("club_id", club_id)
    .eq("id_contabilidad", contabilidad_id)
    .single();

  if (ec) return NextResponse.json({ error: ec.message }, { status: 400 });

  // 2) Insert en pagos (si ya existe, NO queremos error -> usamos upsert con ignore duplicates)
  // Supabase JS: upsert + onConflict + ignoreDuplicates
  const { error: ei } = await supabase.from("pagos").upsert(
    [
      {
        club_id,
        contabilidad_id,
        banco_id,
        fecha_pago_real: b.fecha_operativa,
        importe_pagado: c.importe_total, // típico 1a1
        metodo: "transferencia",
        observaciones: "Conciliación 1a1 (panel)",
      },
    ],
    { onConflict: "contabilidad_id,banco_id", ignoreDuplicates: true }
  );

  if (ei) return NextResponse.json({ error: ei.message }, { status: 400 });

  // Volver a la lista
  return NextResponse.redirect(new URL("/conciliacion/1a1", req.url));
}
