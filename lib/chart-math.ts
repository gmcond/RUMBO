/**
 * Cálculos de carta náutica para la carta de prácticas L105 (PRD §7.3).
 *
 * Reglas fijadas (no inventar):
 * - dm de la carta: 2°50'W en 2005, variación anual 7'E; la dm del año se
 *   redondea al MEDIO GRADO más cercano.
 * - Convención de signos: Este positivo, Oeste negativo (dm, desvío, Ct).
 * - Ct = dm + Δ · Rv = Ra + Ct · Dv = Rv + marcación (estribor +, babor −).
 * - ETA = salida + distancia/velocidad · 1 milla náutica = 1852 m.
 *
 * Ángulos en grados decimales; los rumbos/demoras se normalizan a [0, 360).
 * Funciones puras, sin BD: la UI y el generador de ejercicios las componen.
 */

/** dm de referencia de la carta L105: 2°50'W en 2005 (signo −, Oeste). */
export const L105_DM_2005 = -(2 + 50 / 60);
export const L105_DM_YEAR = 2005;
/** Variación anual: 7' hacia el Este (signo +). */
export const L105_DM_ANNUAL_CHANGE = 7 / 60;

export const METERS_PER_NM = 1852;

/** Normaliza un rumbo/demora al rango [0, 360). */
export function norm360(degrees: number): number {
  const r = degrees % 360;
  return r < 0 ? r + 360 : r;
}

/**
 * Redondeo al medio grado más cercano, simétrico respecto a 0 (el empate
 * 0,25° se aleja de cero, también con valores W/negativos).
 */
export function roundToHalfDegree(degrees: number): number {
  const sign = degrees < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(degrees) * 2)) / 2;
}

/**
 * dm de la carta L105 actualizada al año indicado y redondeada al medio
 * grado (regla del examen). Ej.: 2024 → 2°50'W − 19×7'E = 37'W → −0,5°.
 */
export function dmForYear(year: number): number {
  const raw = L105_DM_2005 + (year - L105_DM_YEAR) * L105_DM_ANNUAL_CHANGE;
  return roundToHalfDegree(raw);
}

/** dm sin redondear (para mostrar el paso intermedio en las resoluciones). */
export function dmForYearExact(year: number): number {
  return L105_DM_2005 + (year - L105_DM_YEAR) * L105_DM_ANNUAL_CHANGE;
}

/** Corrección total: Ct = dm + desvío (ambos con signo E+/W−). */
export function totalCorrection(dm: number, desvio: number): number {
  return dm + desvio;
}

/** Rumbo verdadero desde rumbo de aguja: Rv = Ra + Ct. */
export function rumboVerdadero(ra: number, ct: number): number {
  return norm360(ra + ct);
}

/** Rumbo de aguja desde rumbo verdadero: Ra = Rv − Ct. */
export function rumboAguja(rv: number, ct: number): number {
  return norm360(rv - ct);
}

/** Demora verdadera desde demora de aguja: Dv = Da + Ct. */
export function demoraVerdadera(da: number, ct: number): number {
  return norm360(da + ct);
}

/**
 * Demora verdadera desde rumbo verdadero y marcación:
 * Dv = Rv + marcación (estribor +, babor −).
 */
export function demoraDesdeMarcacion(rv: number, marcacion: number): number {
  return norm360(rv + marcacion);
}

/**
 * Ct despejada de una enfilación: la Dv de la enfilación se lee en la carta
 * y la Da se observa → Ct = Dv − Da (normalizada a ±180 para que salga el
 * signo E/W y no un ángulo de 350°).
 */
export function ctPorEnfilacion(dvCarta: number, daObservada: number): number {
  const diff = norm360(dvCarta - daObservada);
  return diff > 180 ? diff - 360 : diff;
}

/** Horas decimales de un tramo: distancia (millas) / velocidad (nudos). */
export function travelHours(distanciaNm: number, velocidadKn: number): number {
  if (velocidadKn <= 0) throw new Error("La velocidad debe ser positiva");
  return distanciaNm / velocidadKn;
}

/** ETA = salida + distancia/velocidad. */
export function eta(salida: Date, distanciaNm: number, velocidadKn: number): Date {
  const hours = travelHours(distanciaNm, velocidadKn);
  return new Date(salida.getTime() + Math.round(hours * 3600) * 1000);
}

export function nmToMeters(millas: number): number {
  return millas * METERS_PER_NM;
}

export function metersToNm(metros: number): number {
  return metros / METERS_PER_NM;
}

/** Descompone grados decimales en grados y minutos (minutos con 1 decimal). */
export function toDegreesMinutes(value: number): { degrees: number; minutes: number } {
  const abs = Math.abs(value);
  let degrees = Math.floor(abs);
  let minutes = Math.round((abs - degrees) * 60 * 10) / 10;
  if (minutes >= 60) {
    degrees += 1;
    minutes = 0;
  }
  return { degrees, minutes };
}

/** Compone grados decimales desde grados y minutos (con signo aparte). */
export function fromDegreesMinutes(degrees: number, minutes: number, negative = false): number {
  const value = degrees + minutes / 60;
  return negative ? -value : value;
}

/** Formatea una corrección/declinación con signo E/W: −0,5 → "0°30'W". */
export function formatEW(value: number): string {
  if (value === 0) return "0°";
  const { degrees, minutes } = toDegreesMinutes(value);
  const suffix = value < 0 ? "W" : "E";
  const min = minutes > 0 ? `${formatMinutes(minutes)}'` : "";
  return `${degrees}°${min}${suffix}`;
}

/** Formatea un rumbo/demora a grado entero: 86,7 → "087°". */
export function formatRumbo(value: number): string {
  const rounded = Math.round(norm360(value)) % 360;
  return `${rounded.toString().padStart(3, "0")}°`;
}

/** Formatea una latitud en grados y minutos: 41,3917 → "41°23,5'N". */
export function formatLat(value: number): string {
  const { degrees, minutes } = toDegreesMinutes(value);
  return `${degrees}°${formatMinutes(minutes)}'${value < 0 ? "S" : "N"}`;
}

/** Formatea una longitud en grados y minutos: −2,225 → "2°13,5'W". */
export function formatLon(value: number): string {
  const { degrees, minutes } = toDegreesMinutes(value);
  return `${degrees}°${formatMinutes(minutes)}'${value < 0 ? "W" : "E"}`;
}

/** Formatea horas decimales como "2 h 30 min". */
export function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Formatea una hora como "HH:MM". */
export function formatHm(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Minutos con coma decimal española y sin decimales espurios: 23,5. */
function formatMinutes(minutes: number): string {
  return (Math.round(minutes * 10) / 10).toString().replace(".", ",");
}
