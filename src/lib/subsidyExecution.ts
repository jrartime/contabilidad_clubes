export async function getSubsidyExecutionTotals(
  supabase: any,
  clubId: number,
  programaId: number,
  periodo?: { fechaInicio?: string | null; fechaFin?: string | null }
) {
  let accountingQuery = supabase
    .from("contabilidad")
    .select("importe_imputado")
    .eq("club_id", clubId)
    .eq("programa_id", programaId);
  let bankQuery = supabase
    .from("bancos")
    .select("haber")
    .eq("club_id", clubId)
    .eq("programa_id", programaId);

  if (periodo?.fechaInicio) {
    accountingQuery = accountingQuery.gte("fecha", periodo.fechaInicio);
    bankQuery = bankQuery.gte("fecha_operativa", periodo.fechaInicio);
  }
  if (periodo?.fechaFin) {
    accountingQuery = accountingQuery.lte("fecha", periodo.fechaFin);
    bankQuery = bankQuery.lte("fecha_operativa", periodo.fechaFin);
  }

  const [{ data: accountingRows, error: accountingError }, { data: bankRows, error: bankError }] =
    await Promise.all([accountingQuery, bankQuery]);

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

export type ProgramaPeriodo = {
  fecha_inicio_periodo: string | null;
  fecha_fin_periodo: string | null;
  fecha_limite_justificacion: string | null;
  presupuesto_previsto: number | null;
  estado: string;
};

export async function getProgramaPeriodo(
  supabase: any,
  clubId: number,
  programaId: number
): Promise<ProgramaPeriodo | null> {
  const { data, error } = await supabase
    .from("subvencion_programas")
    .select("fecha_inicio_periodo, fecha_fin_periodo, fecha_limite_justificacion, presupuesto_previsto, estado")
    .eq("club_id", clubId)
    .eq("programa_id", programaId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ProgramaPeriodo | null) ?? null;
}
