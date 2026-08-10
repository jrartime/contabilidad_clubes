"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveClubId } from "@/lib/club";
import { canEditClubData, getMyClubRole } from "@/lib/clubRole";

const MAX_FILE_SIZE_BYTES = 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

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

async function requireEditContext() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const clubId = await getActiveClubId();
  if (!clubId) redirect("/clubs");

  const myRole = await getMyClubRole(clubId);
  if (!canEditClubData(myRole)) redirect("/no-autorizado");

  return { supabase, clubId };
}

async function requireOwnedChecklistItem(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  clubId: number,
  checklistId: number
) {
  const { data, error } = await supabase
    .from("checklist_justificacion")
    .select("id_check, subvencion_id")
    .eq("club_id", clubId)
    .eq("id_check", checklistId)
    .maybeSingle();

  if (error || !data) throw new Error("El elemento del checklist no existe.");
  return data;
}

export async function upsertChecklistItemAction(formData: FormData) {
  const redirectTo = ensureInternalRedirect(
    String(formData.get("redirect_to") ?? "").trim(),
    "/configuracion/subvenciones"
  );
  const subvencionId = Number(formData.get("subvencion_id"));
  if (!subvencionId || !Number.isFinite(subvencionId)) {
    redirect(appendErrorParam(redirectTo, "id_subvencion_invalido"));
  }

  const { supabase, clubId } = await requireEditContext();

  const idCheckRaw = String(formData.get("id_check") ?? "").trim();
  const idCheck = idCheckRaw ? Number(idCheckRaw) : null;
  const item = String(formData.get("item") ?? "").trim();
  const requerido = formData.get("requerido") === "on";
  const entregado = formData.get("entregado") === "on";
  const fecha_entrega = String(formData.get("fecha_entrega") ?? "").trim() || null;
  const comentario = String(formData.get("comentario") ?? "").trim() || null;

  if (idCheck) {
    if (!item) redirect(appendErrorParam(redirectTo, "texto_obligatorio"));

    const { error } = await supabase
      .from("checklist_justificacion")
      .update({ item, requerido, entregado, fecha_entrega, comentario })
      .eq("id_check", idCheck)
      .eq("club_id", clubId);

    if (error) redirect(appendErrorParam(redirectTo, error.message));
    redirect(redirectTo);
  }

  if (!item) redirect(appendErrorParam(redirectTo, "texto_obligatorio"));

  const { error } = await supabase.from("checklist_justificacion").insert({
    club_id: clubId,
    subvencion_id: subvencionId,
    item,
    requerido,
    entregado,
    fecha_entrega,
    comentario,
  });

  if (error) redirect(appendErrorParam(redirectTo, error.message));
  redirect(redirectTo);
}

export async function deleteChecklistItemAction(formData: FormData) {
  const redirectTo = ensureInternalRedirect(
    String(formData.get("redirect_to") ?? "").trim(),
    "/configuracion/subvenciones"
  );
  const checklistId = Number(formData.get("id_check"));
  if (!checklistId || !Number.isFinite(checklistId)) {
    redirect(appendErrorParam(redirectTo, "id_check_invalido"));
  }

  const { supabase, clubId } = await requireEditContext();
  await requireOwnedChecklistItem(supabase, clubId, checklistId).catch(() => {
    redirect(appendErrorParam(redirectTo, "elemento_no_encontrado"));
  });

  const { data: documentos } = await supabase
    .from("documentos")
    .select("bucket, path")
    .eq("checklist_id", checklistId);

  const paths = (documentos ?? []).map((doc) => doc.path);
  if (paths.length > 0) {
    await supabase.storage.from("justificantes").remove(paths);
  }

  const { error } = await supabase
    .from("checklist_justificacion")
    .delete()
    .eq("id_check", checklistId)
    .eq("club_id", clubId);

  if (error) redirect(appendErrorParam(redirectTo, "error_eliminando_elemento"));
  redirect(redirectTo);
}

export async function uploadChecklistDocumentoAction(formData: FormData) {
  const redirectTo = ensureInternalRedirect(
    String(formData.get("redirect_to") ?? "").trim(),
    "/configuracion/subvenciones"
  );
  const checklistId = Number(formData.get("checklist_id"));
  if (!checklistId || !Number.isFinite(checklistId)) {
    redirect(appendErrorParam(redirectTo, "id_check_invalido"));
  }

  const { supabase, clubId } = await requireEditContext();
  await requireOwnedChecklistItem(supabase, clubId, checklistId).catch(() => {
    redirect(appendErrorParam(redirectTo, "elemento_no_encontrado"));
  });

  const files = formData.getAll("documentos").filter((item) => item instanceof File) as File[];
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
    const objectPath = `club/${clubId}/checklist/${checklistId}/${randomUUID()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("justificantes")
      .upload(objectPath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      redirect(appendErrorParam(redirectTo, `error_subiendo_${safeName}`));
    }

    const { error: insertError } = await supabase.from("documentos").insert({
      tipo: "justificante",
      bucket: "justificantes",
      path: objectPath,
      filename: file.name || safeName,
      content_type: file.type,
      size_bytes: file.size,
      club_id: clubId,
      checklist_id: checklistId,
    });

    if (insertError) {
      await supabase.storage.from("justificantes").remove([objectPath]);
      redirect(appendErrorParam(redirectTo, "error_guardando_documento"));
    }
  }

  redirect(redirectTo);
}

export async function deleteChecklistDocumentoAction(formData: FormData) {
  const redirectTo = ensureInternalRedirect(
    String(formData.get("redirect_to") ?? "").trim(),
    "/configuracion/subvenciones"
  );
  const documentoId = String(formData.get("documento_id") ?? "").trim();
  if (!documentoId) redirect(appendErrorParam(redirectTo, "documento_id_invalido"));

  const { supabase, clubId } = await requireEditContext();

  const { data: documento, error: docError } = await supabase
    .from("documentos")
    .select("id, checklist_id, bucket, path")
    .eq("id", documentoId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (docError || !documento || !documento.checklist_id) {
    redirect(appendErrorParam(redirectTo, "documento_no_encontrado"));
  }

  const { error: storageError } = await supabase.storage
    .from(documento.bucket)
    .remove([documento.path]);
  if (storageError) redirect(appendErrorParam(redirectTo, "error_borrando_archivo"));

  const { error: deleteError } = await supabase.from("documentos").delete().eq("id", documentoId);
  if (deleteError) redirect(appendErrorParam(redirectTo, "error_borrando_documento"));

  redirect(redirectTo);
}

export async function downloadChecklistDocumentoAction(formData: FormData) {
  const redirectTo = ensureInternalRedirect(
    String(formData.get("redirect_to") ?? "").trim(),
    "/configuracion/subvenciones"
  );
  const documentoId = String(formData.get("documento_id") ?? "").trim();
  if (!documentoId) redirect(appendErrorParam(redirectTo, "documento_id_invalido"));

  const { supabase, clubId } = await requireEditContext();

  const { data: documento, error: docError } = await supabase
    .from("documentos")
    .select("id, checklist_id, bucket, path")
    .eq("id", documentoId)
    .eq("club_id", clubId)
    .maybeSingle();

  if (docError || !documento || !documento.checklist_id) {
    redirect(appendErrorParam(redirectTo, "documento_no_encontrado"));
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(documento.bucket)
    .createSignedUrl(documento.path, 60);

  if (signError || !signed?.signedUrl) {
    redirect(appendErrorParam(redirectTo, "error_generando_url"));
  }

  redirect(signed.signedUrl);
}
