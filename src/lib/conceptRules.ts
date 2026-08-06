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

export function conceptoOficial(concepto: string): boolean {
  return CONCEPTOS_OFICIALES.has(concepto.trim());
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

export function isTipoPrograma(value: unknown): value is TipoPrograma {
  return value === "clubes" || value === "eventos" || value === "eedd_ctd_discapacidad";
}

export function conceptoPermitido(tipo: TipoPrograma, concepto: string): boolean {
  return permitidos[tipo].has(concepto.trim());
}

export function avisoConcepto(tipo: TipoPrograma, concepto: string): string | null {
  if (!conceptoPermitido(tipo, concepto)) return "Concepto no admitido para este tipo de programa.";
  if (tipo === "eventos" && concepto === "Material deportivo") return "En Eventos solo es admisible el material deportivo fungible.";
  if (tipo === "eedd_ctd_discapacidad" && concepto === "Servicios profesionales") return "Debe justificarse su encaje en el apartado Otros cuando proceda.";
  return null;
}
