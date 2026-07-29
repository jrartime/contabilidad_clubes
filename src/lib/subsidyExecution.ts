export async function getSubsidyExecutionTotals(
  supabase: any,
  clubId: number,
  programaId: number
) {
  const [{ data: accountingRows, error: accountingError }, { data: bankRows, error: bankError }] =
    await Promise.all([
      supabase
        .from("contabilidad")
        .select("importe_imputado")
        .eq("club_id", clubId)
        .eq("programa_id", programaId),
      supabase
        .from("bancos")
        .select("haber")
        .eq("club_id", clubId)
        .eq("programa_id", programaId),
    ]);

  if (accountingError) throw new Error(accountingError.message);
  if (bankError) throw new Error(bankError.message);

  return {
    ejecutado: (accountingRows ?? []).reduce(
      (sum: number, row: any) => sum + (Number(row.importe_imputado) || 0),
      0
    ),
    ingresosBanco: (bankRows ?? []).reduce(
      (sum: number, row: any) => sum + (Number(row.haber) || 0),
      0
    ),
  };
}
