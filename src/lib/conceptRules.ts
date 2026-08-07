export type TipoPrograma = "clubes" | "eventos" | "eedd_ctd_discapacidad";
export type ConceptoConfigurable = {
  concepto: string;
  en_listado?: boolean;
  valido_clubes?: boolean;
  valido_eventos?: boolean;
  valido_eedd_ctd_discapacidad?: boolean;
};

export const TIPOS_PROGRAMA: { value: TipoPrograma; label: string }[] = [
  { value: "clubes", label: "Club" },
  { value: "eventos", label: "Eventos" },
  { value: "eedd_ctd_discapacidad", label: "EEDD / CTD / discapacidad" },
];

export const CONCEPTOS_OFICIALES = new Set([
  "Personal", "Derechos federativos", "Licencias federativas", "Arbitrajes y jueces",
  "Desplazamientos", "Alojamiento", "Transportes", "Servicios profesionales", "Gastos sanitarios",
  "Seguros", "Vestuario deportivo", "Material deportivo", "Trofeos", "Premios", "Comunicación",
  "Material de oficina", "Imprenta", "Publicidad y propaganda", "Local o sede del club", "Otros gastos",
  "Subvención del Ayuntamiento de Oviedo", "Aportaciones y/o subvenciones de otras Administraciones Públicas",
  "Aportaciones privadas", "Recursos propios", "Otros ingresos",
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
    "Material de oficina", "Imprenta", "Publicidad y propaganda", "Local o sede del club", "Otros gastos",
    "Subvención del Ayuntamiento de Oviedo", "Aportaciones y/o subvenciones de otras Administraciones Públicas",
    "Aportaciones privadas", "Recursos propios", "Otros ingresos",
  ]),
  eventos: new Set([
    "Personal", "Derechos federativos", "Arbitrajes y jueces", "Desplazamientos", "Alojamiento",
    "Transportes", "Servicios profesionales", "Gastos sanitarios", "Seguros", "Material deportivo",
    "Trofeos", "Premios", "Comunicación", "Material de oficina", "Imprenta", "Publicidad y propaganda", "Otros gastos",
    "Subvención del Ayuntamiento de Oviedo", "Aportaciones y/o subvenciones de otras Administraciones Públicas",
    "Aportaciones privadas", "Recursos propios", "Otros ingresos",
  ]),
  eedd_ctd_discapacidad: new Set([
    "Personal", "Derechos federativos", "Arbitrajes y jueces", "Desplazamientos", "Alojamiento",
    "Transportes", "Servicios profesionales", "Seguros", "Material deportivo", "Trofeos", "Premios", "Otros gastos",
    "Subvención del Ayuntamiento de Oviedo", "Aportaciones y/o subvenciones de otras Administraciones Públicas",
    "Aportaciones privadas", "Recursos propios", "Otros ingresos",
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

export function conceptoPermitido(tipo: TipoPrograma, concepto: string | ConceptoConfigurable): boolean {
  if (typeof concepto !== "string") {
    if (tipo === "clubes" && typeof concepto.valido_clubes === "boolean") return concepto.valido_clubes;
    if (tipo === "eventos" && typeof concepto.valido_eventos === "boolean") return concepto.valido_eventos;
    if (tipo === "eedd_ctd_discapacidad" && typeof concepto.valido_eedd_ctd_discapacidad === "boolean") return concepto.valido_eedd_ctd_discapacidad;
    return conceptoPermitido(tipo, concepto.concepto);
  }
  return permitidosNormalizados[tipo].has(normalizarConcepto(concepto));
}

export function avisoConcepto(tipo: TipoPrograma, concepto: string | ConceptoConfigurable): string | null {
  if (!conceptoPermitido(tipo, concepto)) return "Concepto no admitido para este tipo de programa.";
  const conceptoNormalizado = normalizarConcepto(typeof concepto === "string" ? concepto : concepto.concepto);
  if (tipo === "eventos" && conceptoNormalizado === normalizarConcepto("Material deportivo")) return "En Eventos solo es admisible el material deportivo fungible.";
  if (tipo === "eedd_ctd_discapacidad" && conceptoNormalizado === normalizarConcepto("Servicios profesionales")) return "Debe justificarse su encaje en el apartado Otros gastos cuando proceda.";
  return null;
}
