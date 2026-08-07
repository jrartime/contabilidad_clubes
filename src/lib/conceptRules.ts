export type TipoPrograma = "clubes" | "eventos" | "eedd_ctd_discapacidad";

export const TIPOS_PROGRAMA: { value: TipoPrograma; label: string }[] = [
  { value: "clubes", label: "Club" },
  { value: "eventos", label: "Eventos" },
  { value: "eedd_ctd_discapacidad", label: "EEDD / CTD / discapacidad" },
];

export const CONCEPTOS_OFICIALES = new Set([
  "Personal", "Derechos federativos", "Licencias federativas", "Arbitrajes y jueces",
  "Desplazamientos", "Alojamiento", "Transportes", "Servicios profesionales", "Gastos sanitarios",
  "Seguros", "Vestuario deportivo", "Material deportivo", "Trofeos", "Premios", "Comunicación",
  "Material de oficina", "Imprenta", "Publicidad y propaganda", "Local o sede del club", "Otros",
]);

function normalizarConcepto(concepto: string): string {
  return concepto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es");
}

const conceptosOficialesNormalizados = new Set(
  [...CONCEPTOS_OFICIALES].map(normalizarConcepto)
);

export function conceptoOficial(concepto: string): boolean {
  return conceptosOficialesNormalizados.has(normalizarConcepto(concepto));
}

const permitidos: Record<TipoPrograma, Set<string>> = {
  clubes: new Set([
    "Personal", "Derechos federativos", "Licencias federativas", "Arbitrajes y jueces",
    "Desplazamientos", "Alojamiento", "Transportes", "Servicios profesionales", "Seguros",
    "Vestuario deportivo", "Material deportivo", "Trofeos", "Premios", "Comunicación",
    "Material de oficina", "Imprenta", "Publicidad y propaganda", "Local o sede del club", "Otros",
  ]),
  eventos: new Set([
    "Personal", "Derechos federativos", "Arbitrajes y jueces", "Desplazamientos", "Alojamiento",
    "Transportes", "Servicios profesionales", "Gastos sanitarios", "Seguros", "Material deportivo",
    "Trofeos", "Premios", "Comunicación", "Material de oficina", "Imprenta", "Publicidad y propaganda",
  ]),
  eedd_ctd_discapacidad: new Set([
    "Personal", "Derechos federativos", "Arbitrajes y jueces", "Desplazamientos", "Alojamiento",
    "Transportes", "Servicios profesionales", "Seguros", "Material deportivo", "Trofeos", "Premios", "Otros",
  ]),
};

const permitidosNormalizados: Record<TipoPrograma, Set<string>> = {
  clubes: new Set([...permitidos.clubes].map(normalizarConcepto)),
  eventos: new Set([...permitidos.eventos].map(normalizarConcepto)),
  eedd_ctd_discapacidad: new Set([...permitidos.eedd_ctd_discapacidad].map(normalizarConcepto)),
};

export function isTipoPrograma(value: unknown): value is TipoPrograma {
  return value === "clubes" || value === "eventos" || value === "eedd_ctd_discapacidad";
}

export function conceptoPermitido(tipo: TipoPrograma, concepto: string): boolean {
  return permitidosNormalizados[tipo].has(normalizarConcepto(concepto));
}

export function avisoConcepto(tipo: TipoPrograma, concepto: string): string | null {
  if (!conceptoPermitido(tipo, concepto)) return "Concepto no admitido para este tipo de programa.";
  const conceptoNormalizado = normalizarConcepto(concepto);
  if (tipo === "eventos" && conceptoNormalizado === normalizarConcepto("Material deportivo")) return "En Eventos solo es admisible el material deportivo fungible.";
  if (tipo === "eedd_ctd_discapacidad" && conceptoNormalizado === normalizarConcepto("Servicios profesionales")) return "Debe justificarse su encaje en el apartado Otros cuando proceda.";
  return null;
}
