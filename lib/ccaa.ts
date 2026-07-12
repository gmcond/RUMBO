// Comunidades autónomas (más Ceuta y Melilla). El código es el que usa
// exam_configs.ccaa y profiles.ccaa_objetivo.
export const CCAA = [
  { code: "AND", name: "Andalucía" },
  { code: "ARA", name: "Aragón" },
  { code: "AST", name: "Asturias" },
  { code: "BAL", name: "Illes Balears" },
  { code: "CAN", name: "Canarias" },
  { code: "CTB", name: "Cantabria" },
  { code: "CLM", name: "Castilla-La Mancha" },
  { code: "CYL", name: "Castilla y León" },
  { code: "CAT", name: "Cataluña" },
  { code: "VAL", name: "Comunitat Valenciana" },
  { code: "EXT", name: "Extremadura" },
  { code: "GAL", name: "Galicia" },
  { code: "MAD", name: "Madrid" },
  { code: "MUR", name: "Región de Murcia" },
  { code: "NAV", name: "Navarra" },
  { code: "PVA", name: "País Vasco" },
  { code: "RIO", name: "La Rioja" },
  { code: "CEU", name: "Ceuta" },
  { code: "MEL", name: "Melilla" },
] as const;

export type CcaaCode = (typeof CCAA)[number]["code"];

export const CCAA_CODES = CCAA.map((c) => c.code) as [CcaaCode, ...CcaaCode[]];
