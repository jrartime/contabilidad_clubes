"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";
import { parseDecimalToNumber } from "@/lib/decimal";

const MAX_FILE_SIZE_BYTES = 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

function sanitizeFilename(name: string) {
  const normalized = name.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "archivo";
}

function ensureInternalRedirect(path: string, fallback: string) {
  if (!path) return fallback;
  if (!path.startsWith("/")) return fallback;
  return path;
}

function appendErrorParam(path: string, message: string) {
  const [base, hashPart] = path.split("#");
  const [pathname, query] = base.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("error", message);
  const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
  return hashPart ? `${next}#${hashPart}` : next;
}

export async function updateContabilidadAction(payload: {
  id_contabilidad: number;
  fecha?: string | null;
  fecha_pago?: string | null;
  numero_factura?: string | null;
  tipo_id?: number | null;
  proveedor_id?: number | null;
  personal_id?: number | null;
  categoria_id?: number | null;
  concepto_id?: number | null;
  programa_id?: number | null;
  importe_total?: string | number | null;
  importe_imputado?: string | number | null;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const update: any = {};
  if ("fecha" in payload) update.fecha = payload.fecha || null;
  if ("fecha_pago" in payload) update.fecha_pago = payload.fecha_pago || null;
  if ("numero_factura" in payload)
    update.numero_factura = (payload.numero_factura ?? "").trim() || null;
  if ("tipo_id" in payload) update.tipo_id = payload.tipo_id ?? null;
  if ("proveedor_id" in payload) update.proveedor_id = payload.proveedor_id ?? null;
  if ("personal_id" in payload) update.personal_id = payload.personal_id ?? null;
  if ("categoria_id" in payload) update.categoria_id = payload.categoria_id ?? null;
  if ("concepto_id" in payload) update.concepto_id = payload.concepto_id ?? null;
  if ("programa_id" in payload) update.programa_id = payload.programa_id ?? null;

  if ("importe_total" in payload) {
    const n =
      typeof payload.importe_total === "number"
        ? payload.importe_total
        : parseDecimalToNumber(payload.importe_total);
    update.importe_total = n ?? null;
  }

  if ("importe_imputado" in payload) {
    const n =
      typeof payload.importe_imputado === "number"
        ? payload.importe_imputado
        : parseDecimalToNumber(payload.importe_imputado);
    update.importe_imputado = n ?? null;
  }

  const { error } = await supabase
    .from("contabilidad")
    .update(update)
    .eq("club_id", clubId)
    .eq("id_contabilidad", payload.id_contabilidad);

  if (error) throw new Error(error.message);
}

export async function uploadDocumentosAction(formData: FormData) {
  const redirectTo = ensureInternalRedirect(
    String(formData.get("redirect_to") ?? "").trim(),
    "/contabilidad"
  );
  const clubId = Number(formData.get("club_id"));
  const contabilidadId = Number(formData.get("contabilidad_id"));

  if (!clubId || !Number.isFinite(clubId)) {
    redirect(appendErrorParam(redirectTo, "club_id_invalido"));
  }
  if (!contabilidadId || !Number.isFinite(contabilidadId)) {
    redirect(appendErrorParam(redirectTo, "contabilidad_id_invalido"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { data: asiento, error: asientoError } = await supabase
    .from("contabilidad")
    .select("id_contabilidad, tipo_id, club_id")
    .eq("club_id", clubId)
    .eq("id_contabilidad", contabilidadId)
    .maybeSingle();

  if (asientoError || !asiento) {
    redirect(appendErrorParam(redirectTo, "asiento_no_encontrado"));
  }

  const tipoId = Number(asiento.tipo_id ?? 0);
  const bucket = tipoId === 3 ? "nominas" : "facturas";

  const files = formData
    .getAll("documentos")
    .filter((item) => item instanceof File) as File[];

  if (files.length === 0) {
    redirect(appendErrorParam(redirectTo, "sin_archivos"));
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      redirect(appendErrorParam(redirectTo, "tipo_archivo_no_permitido"));
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      redirect(appendErrorParam(redirectTo, "archivo_supera_1mb"));
    }

    const safeName = sanitizeFilename(file.name || "archivo");
    const objectPath = `club/${clubId}/contabilidad/${contabilidadId}/${randomUUID()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      redirect(
        appendErrorParam(redirectTo, `error_subiendo_${safeName}`)
      );
    }

    const { error: insertError } = await supabase
      .from("documentos")
      .insert({
        tipo: bucket === "nominas" ? "nomina" : "factura",
        bucket,
        path: objectPath,
        filename: file.name || safeName,
        content_type: file.type,
        size_bytes: file.size,
        club_id: clubId,
        contabilidad_id: bucket === "nominas" ? null : contabilidadId,
        nomina_id: bucket === "nominas" ? contabilidadId : null,
      });

    if (insertError) {
      await supabase.storage.from(bucket).remove([objectPath]);
      redirect(appendErrorParam(redirectTo, "error_guardando_documento"));
    }
  }

  redirect(redirectTo);
}

export async function deleteDocumentoAction(formData: FormData) {
  const redirectTo = ensureInternalRedirect(
    String(formData.get("redirect_to") ?? "").trim(),
    "/contabilidad"
  );
  const clubId = Number(formData.get("club_id"));
  const documentoId = String(formData.get("documento_id") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId)) {
    redirect(appendErrorParam(redirectTo, "club_id_invalido"));
  }
  if (!documentoId) {
    redirect(appendErrorParam(redirectTo, "documento_id_invalido"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { data: documento, error: docError } = await supabase
    .from("documentos")
    .select("id, contabilidad_id, nomina_id, bucket, path")
    .eq("id", documentoId)
    .maybeSingle();

  if (docError || !documento) {
    redirect(appendErrorParam(redirectTo, "documento_no_encontrado"));
  }

  const { data: asiento, error: asientoError } = await supabase
    .from("contabilidad")
    .select("id_contabilidad")
    .eq("club_id", clubId)
    .eq("id_contabilidad", documento.contabilidad_id ?? documento.nomina_id)
    .maybeSingle();

  if (asientoError || !asiento) {
    redirect(appendErrorParam(redirectTo, "asiento_no_encontrado"));
  }

  const { error: storageError } = await supabase.storage
    .from(documento.bucket)
    .remove([documento.path]);
  if (storageError) {
    redirect(appendErrorParam(redirectTo, "error_borrando_archivo"));
  }

  const { error: deleteError } = await supabase
    .from("documentos")
    .delete()
    .eq("id", documentoId);

  if (deleteError) {
    redirect(appendErrorParam(redirectTo, "error_borrando_documento"));
  }

  redirect(redirectTo);
}

export async function downloadDocumentoAction(formData: FormData) {
  const redirectTo = ensureInternalRedirect(
    String(formData.get("redirect_to") ?? "").trim(),
    "/contabilidad"
  );
  const clubId = Number(formData.get("club_id"));
  const documentoId = String(formData.get("documento_id") ?? "").trim();

  if (!clubId || !Number.isFinite(clubId)) {
    redirect(appendErrorParam(redirectTo, "club_id_invalido"));
  }
  if (!documentoId) {
    redirect(appendErrorParam(redirectTo, "documento_id_invalido"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: documento, error: docError } = await supabase
    .from("documentos")
    .select("id, contabilidad_id, nomina_id, bucket, path")
    .eq("id", documentoId)
    .maybeSingle();

  if (docError || !documento) {
    redirect(appendErrorParam(redirectTo, "documento_no_encontrado"));
  }

  const { data: asiento, error: asientoError } = await supabase
    .from("contabilidad")
    .select("id_contabilidad")
    .eq("club_id", clubId)
    .eq("id_contabilidad", documento.contabilidad_id ?? documento.nomina_id)
    .maybeSingle();

  if (asientoError || !asiento) {
    redirect(appendErrorParam(redirectTo, "asiento_no_encontrado"));
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(documento.bucket)
    .createSignedUrl(documento.path, 60);

  if (signError || !signed?.signedUrl) {
    redirect(appendErrorParam(redirectTo, "error_generando_url"));
  }

  redirect(signed.signedUrl);
}

export async function deleteContabilidadWithDocsAction(formData: FormData) {
  const redirectTo = ensureInternalRedirect(
    String(formData.get("redirect_to") ?? "").trim(),
    "/contabilidad"
  );
  const clubId = Number(formData.get("club_id"));
  const contabilidadId = Number(formData.get("id_contabilidad"));
  const expectedTipoId = Number(formData.get("expected_tipo_id") ?? 0) || null;

  if (!clubId || !Number.isFinite(clubId)) {
    redirect(appendErrorParam(redirectTo, "club_id_invalido"));
  }
  if (!contabilidadId || !Number.isFinite(contabilidadId)) {
    redirect(appendErrorParam(redirectTo, "contabilidad_id_invalido"));
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  const { data: asiento, error: asientoError } = await supabase
    .from("contabilidad")
    .select("id_contabilidad, tipo_id")
    .eq("club_id", clubId)
    .eq("id_contabilidad", contabilidadId)
    .maybeSingle();

  if (asientoError || !asiento) {
    redirect(appendErrorParam(redirectTo, "asiento_no_encontrado"));
  }

  if (expectedTipoId && Number(asiento.tipo_id) !== expectedTipoId) {
    redirect(appendErrorParam(redirectTo, "tipo_id_no_valido"));
  }

  const { data: documentos, error: docsError } = await supabase
    .from("documentos")
    .select("id, bucket, path")
    .or(`contabilidad_id.eq.${contabilidadId},nomina_id.eq.${contabilidadId}`);

  if (docsError) {
    redirect(appendErrorParam(redirectTo, "error_leyendo_documentos"));
  }

  const bucketGroups = new Map<string, string[]>();
  (documentos ?? []).forEach((doc: any) => {
    if (!doc?.bucket || !doc?.path) return;
    const list = bucketGroups.get(doc.bucket) ?? [];
    list.push(doc.path);
    bucketGroups.set(doc.bucket, list);
  });

  for (const [bucket, paths] of bucketGroups.entries()) {
    if (!paths.length) continue;
    const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
    if (storageError) {
      redirect(appendErrorParam(redirectTo, "error_borrando_archivos"));
    }
  }

  if (documentos && documentos.length > 0) {
    const { error: deleteDocsError } = await supabase
      .from("documentos")
      .delete()
      .or(`contabilidad_id.eq.${contabilidadId},nomina_id.eq.${contabilidadId}`);
    if (deleteDocsError) {
      redirect(appendErrorParam(redirectTo, "error_borrando_documentos"));
    }
  }

  const { error } = await supabase
    .from("contabilidad")
    .delete()
    .eq("club_id", clubId)
    .eq("id_contabilidad", contabilidadId);

  if (error) {
    redirect(appendErrorParam(redirectTo, error.message));
  }

  redirect(redirectTo);
}
