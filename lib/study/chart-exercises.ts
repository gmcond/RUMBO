/**
 * Generador de ejercicios numéricos de carta náutica (PRD §M3, v1): los 8
 * tipos del examen con datos aleatorios plausibles de la zona del Estrecho
 * (carta de prácticas L105) y resolución paso a paso. Los cálculos se
 * corrigen automáticamente; el trazado se explica con texto y esquemas
 * estáticos en la UI.
 *
 * Los enunciados son contenido de estudio y van en español (como el banco de
 * preguntas); la interfaz alrededor se traduce con next-intl. Puro y con RNG
 * inyectable, al estilo de lib/study/simulacro.ts.
 */

import {
  ctPorEnfilacion,
  demoraVerdadera,
  dmForYear,
  dmForYearExact,
  formatDuration,
  formatEW,
  formatLat,
  formatRumbo,
  norm360,
  rumboAguja,
  rumboVerdadero,
  totalCorrection,
  travelHours,
} from "@/lib/chart-math";
import type { Rng } from "@/lib/study/simulacro";

export const CHART_EXERCISE_TYPES = [
  {
    slug: "coordenadas",
    titulo: "Coordenadas",
    descripcion: "Diferencia de latitud y distancia navegando por un meridiano.",
  },
  {
    slug: "rumbo-distancia-eta",
    titulo: "Rumbo, distancia y ETA",
    descripcion: "Duración de un tramo y hora estimada de llegada.",
  },
  {
    slug: "correccion-total",
    titulo: "Corrección total",
    descripcion: "dm de la carta actualizada al año y Ct = dm + desvío.",
  },
  {
    slug: "rv-ra",
    titulo: "Rumbo verdadero ↔ rumbo de aguja",
    descripcion: "Convertir Rv y Ra aplicando la corrección total.",
  },
  {
    slug: "dos-demoras",
    titulo: "Situación por dos demoras",
    descripcion: "Pasar dos demoras de aguja a verdaderas para trazarlas.",
  },
  {
    slug: "enfilacion-demora",
    titulo: "Enfilación y demora",
    descripcion: "Obtener la Ct con una enfilación y aplicarla a una demora.",
  },
  {
    slug: "rumbo-tangente",
    titulo: "Rumbo tangente a un peligro",
    descripcion: "Rumbo que pasa a un resguardo dado de un peligro.",
  },
  {
    slug: "corriente",
    titulo: "Corriente básica",
    descripcion: "Velocidad efectiva y ETA con corriente a favor o en contra.",
  },
] as const;

export type ChartExerciseType = (typeof CHART_EXERCISE_TYPES)[number]["slug"];

export const CHART_EXERCISE_SLUGS = CHART_EXERCISE_TYPES.map((t) => t.slug);

export interface ExerciseField {
  id: string;
  /** Qué se pide, en español ("Corrección total (°, E+/W−)"). */
  label: string;
  kind: "number" | "time";
  /** Valor esperado: grados/millas/nudos… o minutos desde medianoche si kind=time. */
  answer: number;
  /** Tolerancia de aceptación en las unidades del campo. */
  tolerance: number;
  /** Comparación circular 0–360 (rumbos y demoras). */
  circular?: boolean;
  /** Respuesta formateada para la solución ("122°", "0°30'W", "12:30"). */
  display: string;
}

export interface ChartExercise {
  type: ChartExerciseType;
  statement: string;
  /** Datos del enunciado, como pares etiqueta→valor. */
  data: { label: string; value: string }[];
  fields: ExerciseField[];
  /** Resolución paso a paso. */
  steps: string[];
  /** Esquema estático que acompaña a la resolución (si aplica). */
  diagram?: "dos-demoras" | "rumbo-tangente" | null;
}

/** ¿La respuesta del alumno cae dentro de la tolerancia del campo? */
export function checkFieldAnswer(field: ExerciseField, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (field.circular) {
    const diff = Math.abs(norm360(value) - norm360(field.answer));
    return Math.min(diff, 360 - diff) <= field.tolerance;
  }
  return Math.abs(value - field.answer) <= field.tolerance;
}

// ── Helpers de aleatoriedad plausible ────────────────────────────────────────

function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function randStep(rng: Rng, min: number, max: number, step: number): number {
  const steps = Math.floor((max - min) / step);
  return min + randInt(rng, 0, steps) * step;
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)];
}

/** Faros reales de la zona de la carta de prácticas (Estrecho). */
const FAROS = [
  "Punta Carnero",
  "Punta Europa",
  "Isla de Tarifa",
  "Punta Paloma",
  "Punta Almina",
  "Cabo Espartel",
] as const;

function pickTwoFaros(rng: Rng): [string, string] {
  const first = randInt(rng, 0, FAROS.length - 1);
  const offset = randInt(rng, 1, FAROS.length - 1);
  return [FAROS[first], FAROS[(first + offset) % FAROS.length]];
}

/** Desvío de aguja plausible: ±(0,5°–4°) en pasos de 0,5. */
function randDesvio(rng: Rng): number {
  const magnitude = randStep(rng, 0.5, 4, 0.5);
  return rng() < 0.5 ? -magnitude : magnitude;
}

function formatSalida(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Paso común: dm del año con su redondeo, como texto de resolución. */
function dmSteps(year: number): { dm: number; steps: string[] } {
  const exact = dmForYearExact(year);
  const dm = dmForYear(year);
  const years = year - 2005;
  return {
    dm,
    steps: [
      `dm de la carta: 2°50'W en 2005, con variación anual 7'E. En ${year}: 2°50'W − ${years}×7' = ${formatEW(exact)}.`,
      `Se redondea al medio grado más cercano: dm ${year} = ${formatEW(dm)}.`,
    ],
  };
}

// ── Generadores por tipo ─────────────────────────────────────────────────────

function genCoordenadas(rng: Rng): ChartExercise {
  // Mismo meridiano: la diferencia de latitud en minutos son millas náuticas.
  const latDeg = 36;
  const latMinA = randStep(rng, 2, 28, 0.5);
  const deltaMin = randStep(rng, 3, 25, 0.5);
  const north = rng() < 0.5;
  const latMinB = north ? latMinA + deltaMin : latMinA - deltaMin;
  const latA = latDeg + latMinA / 60;
  const latB = latDeg + latMinB / 60;
  const lonMin = randStep(rng, 0, 55, 0.5);
  const lon = -(5 + lonMin / 60);

  return {
    type: "coordenadas",
    statement: `Navegamos por el meridiano ${formatLatLonLon(lon)} desde la situación A hasta la situación B, más al ${north ? "norte" : "sur"}. Calcula la diferencia de latitud y la distancia navegada.`,
    data: [
      { label: "Situación A", value: `${formatLat(latA)} · ${formatLatLonLon(lon)}` },
      { label: "Situación B", value: `${formatLat(latB)} · ${formatLatLonLon(lon)}` },
    ],
    fields: [
      {
        id: "delta",
        label: "Diferencia de latitud (minutos)",
        kind: "number",
        answer: deltaMin,
        tolerance: 0.2,
        display: `${deltaMin.toString().replace(".", ",")}'`,
      },
      {
        id: "dist",
        label: "Distancia navegada (millas)",
        kind: "number",
        answer: deltaMin,
        tolerance: 0.2,
        display: `${deltaMin.toString().replace(".", ",")} millas`,
      },
    ],
    steps: [
      `Diferencia de latitud: ${formatLat(latB)} − ${formatLat(latA)} = ${deltaMin.toString().replace(".", ",")}' hacia el ${north ? "norte" : "sur"}.`,
      `Sobre un meridiano, 1' de latitud = 1 milla náutica, así que la distancia es ${deltaMin.toString().replace(".", ",")} millas.`,
      "En la carta se mide siempre en la escala de latitudes (el lateral), a la altura de la derrota.",
    ],
  };
}

function formatLatLonLon(lon: number): string {
  // Alias local para no importar formatLon con nombre confuso en este archivo.
  const abs = Math.abs(lon);
  const degrees = Math.floor(abs);
  const minutes = Math.round((abs - degrees) * 60 * 10) / 10;
  return `${degrees}°${minutes.toString().replace(".", ",")}'${lon < 0 ? "W" : "E"}`;
}

function genRumboDistanciaEta(rng: Rng): ChartExercise {
  const salidaMin = randStep(rng, 8 * 60, 16 * 60, 5);
  const dist = randStep(rng, 6, 30, 0.5);
  const vel = randStep(rng, 4, 10, 0.5);
  const rumbo = randStep(rng, 0, 355, 5);
  const hours = travelHours(dist, vel);
  const etaMin = Math.round(salidaMin + hours * 60);

  return {
    type: "rumbo-distancia-eta",
    statement: `Salimos a las ${formatSalida(salidaMin)} navegando al rumbo verdadero ${formatRumbo(rumbo)} para recorrer ${dist.toString().replace(".", ",")} millas a ${vel.toString().replace(".", ",")} nudos. Calcula la duración del tramo y la hora estimada de llegada (ETA).`,
    data: [
      { label: "Hora de salida", value: formatSalida(salidaMin) },
      { label: "Rumbo verdadero", value: formatRumbo(rumbo) },
      { label: "Distancia", value: `${dist.toString().replace(".", ",")} millas` },
      { label: "Velocidad", value: `${vel.toString().replace(".", ",")} nudos` },
    ],
    fields: [
      {
        id: "duracion",
        label: "Duración del tramo (minutos)",
        kind: "number",
        answer: Math.round(hours * 60),
        tolerance: 1,
        display: formatDuration(hours),
      },
      {
        id: "eta",
        label: "Hora estimada de llegada",
        kind: "time",
        answer: etaMin % (24 * 60),
        tolerance: 1,
        display: formatSalida(etaMin % (24 * 60)),
      },
    ],
    steps: [
      `Tiempo = distancia / velocidad = ${dist.toString().replace(".", ",")} / ${vel.toString().replace(".", ",")} = ${formatDuration(hours)}.`,
      `ETA = ${formatSalida(salidaMin)} + ${formatDuration(hours)} = ${formatSalida(etaMin % (24 * 60))}.`,
    ],
  };
}

function genCorreccionTotal(rng: Rng, year: number): ChartExercise {
  const desvio = randDesvio(rng);
  const { dm, steps } = dmSteps(year);
  const ct = totalCorrection(dm, desvio);

  return {
    type: "correccion-total",
    statement: `Con la dm de la carta actualizada a ${year} y un desvío de aguja de ${formatEW(desvio)}, calcula la dm del año y la corrección total.`,
    data: [
      { label: "dm de la carta", value: "2°50'W (2005), variación anual 7'E" },
      { label: "Año", value: String(year) },
      { label: "Desvío (Δ)", value: formatEW(desvio) },
    ],
    fields: [
      {
        id: "dm",
        label: `dm ${year} (grados, E+/W−)`,
        kind: "number",
        answer: dm,
        tolerance: 0.05,
        display: formatEW(dm),
      },
      {
        id: "ct",
        label: "Corrección total (grados, E+/W−)",
        kind: "number",
        answer: ct,
        tolerance: 0.1,
        display: formatEW(ct),
      },
    ],
    steps: [
      ...steps,
      `Ct = dm + Δ = ${formatEW(dm)} + ${formatEW(desvio)} = ${formatEW(ct)} (Este positivo, Oeste negativo).`,
    ],
  };
}

function genRvRa(rng: Rng): ChartExercise {
  const ct = randDesvio(rng);
  const toVerdadero = rng() < 0.5;
  const rumbo = randStep(rng, 0, 355, 5);
  const answer = toVerdadero ? rumboVerdadero(rumbo, ct) : rumboAguja(rumbo, ct);

  return {
    type: "rv-ra",
    statement: toVerdadero
      ? `Gobernamos al rumbo de aguja ${formatRumbo(rumbo)} con una corrección total de ${formatEW(ct)}. Calcula el rumbo verdadero.`
      : `Queremos seguir el rumbo verdadero ${formatRumbo(rumbo)} con una corrección total de ${formatEW(ct)}. Calcula el rumbo de aguja que hay que gobernar.`,
    data: [
      {
        label: toVerdadero ? "Rumbo de aguja (Ra)" : "Rumbo verdadero (Rv)",
        value: formatRumbo(rumbo),
      },
      { label: "Corrección total (Ct)", value: formatEW(ct) },
    ],
    fields: [
      {
        id: toVerdadero ? "rv" : "ra",
        label: toVerdadero ? "Rumbo verdadero (°)" : "Rumbo de aguja (°)",
        kind: "number",
        answer,
        tolerance: 0.5,
        circular: true,
        display: formatRumbo(answer),
      },
    ],
    steps: toVerdadero
      ? [
          `Rv = Ra + Ct = ${formatRumbo(rumbo)} + (${formatEW(ct)}) = ${formatRumbo(answer)}.`,
          "La Ct se suma con su signo: Este positivo, Oeste negativo.",
        ]
      : [
          `Ra = Rv − Ct = ${formatRumbo(rumbo)} − (${formatEW(ct)}) = ${formatRumbo(answer)}.`,
          "Para pasar de verdadero a aguja la Ct se resta con su signo.",
        ],
  };
}

function genDosDemoras(rng: Rng, year: number): ChartExercise {
  const [faroA, faroB] = pickTwoFaros(rng);
  const desvio = randDesvio(rng);
  const { dm, steps } = dmSteps(year);
  const ct = totalCorrection(dm, desvio);
  const da1 = randStep(rng, 0, 355, 5);
  const separacion = randStep(rng, 40, 120, 5);
  const da2 = norm360(da1 + separacion);
  const dv1 = demoraVerdadera(da1, ct);
  const dv2 = demoraVerdadera(da2, ct);

  return {
    type: "dos-demoras",
    statement: `En ${year}, con desvío ${formatEW(desvio)}, tomamos simultáneamente demora de aguja a ${faroA} (${formatRumbo(da1)}) y a ${faroB} (${formatRumbo(da2)}). Calcula las dos demoras verdaderas para situarte en la carta.`,
    data: [
      { label: `Demora de aguja a ${faroA}`, value: formatRumbo(da1) },
      { label: `Demora de aguja a ${faroB}`, value: formatRumbo(da2) },
      { label: "Desvío (Δ)", value: formatEW(desvio) },
      { label: "Año", value: String(year) },
    ],
    fields: [
      {
        id: "dv1",
        label: `Demora verdadera a ${faroA} (°)`,
        kind: "number",
        answer: dv1,
        tolerance: 0.5,
        circular: true,
        display: formatRumbo(dv1),
      },
      {
        id: "dv2",
        label: `Demora verdadera a ${faroB} (°)`,
        kind: "number",
        answer: dv2,
        tolerance: 0.5,
        circular: true,
        display: formatRumbo(dv2),
      },
    ],
    steps: [
      ...steps,
      `Ct = dm + Δ = ${formatEW(dm)} + (${formatEW(desvio)}) = ${formatEW(ct)}.`,
      `Dv a ${faroA} = Da + Ct = ${formatRumbo(da1)} + (${formatEW(ct)}) = ${formatRumbo(dv1)}.`,
      `Dv a ${faroB} = Da + Ct = ${formatRumbo(da2)} + (${formatEW(ct)}) = ${formatRumbo(dv2)}.`,
      "Trazado: desde cada faro se dibuja la demora verdadera INVERSA (Dv ± 180°); el corte de las dos líneas es la situación del barco.",
    ],
    diagram: "dos-demoras",
  };
}

function genEnfilacionDemora(rng: Rng): ChartExercise {
  const [faroA, faroB] = pickTwoFaros(rng);
  const faroC = pick(
    rng,
    FAROS.filter((f) => f !== faroA && f !== faroB)
  );
  const dvCarta = randStep(rng, 0, 355, 5);
  const ct = randDesvio(rng);
  const daObservada = norm360(dvCarta - ct);
  const daFaroC = randStep(rng, 0, 355, 5);
  const dvFaroC = demoraVerdadera(daFaroC, ct);

  return {
    type: "enfilacion-demora",
    statement: `Al cruzar la enfilación ${faroA}–${faroB} (demora verdadera en la carta: ${formatRumbo(dvCarta)}) la aguja marca ${formatRumbo(daObservada)}. En ese instante tomamos demora de aguja a ${faroC}: ${formatRumbo(daFaroC)}. Calcula la corrección total y la demora verdadera a ${faroC}.`,
    data: [
      { label: `Enfilación ${faroA}–${faroB} (Dv de carta)`, value: formatRumbo(dvCarta) },
      { label: "Demora de aguja observada en la enfilación", value: formatRumbo(daObservada) },
      { label: `Demora de aguja a ${faroC}`, value: formatRumbo(daFaroC) },
    ],
    fields: [
      {
        id: "ct",
        label: "Corrección total (grados, E+/W−)",
        kind: "number",
        answer: ct,
        tolerance: 0.1,
        display: formatEW(ct),
      },
      {
        id: "dv",
        label: `Demora verdadera a ${faroC} (°)`,
        kind: "number",
        answer: dvFaroC,
        tolerance: 0.5,
        circular: true,
        display: formatRumbo(dvFaroC),
      },
    ],
    steps: [
      "Una enfilación tiene demora verdadera conocida (se lee en la carta), así que sirve para calibrar la aguja.",
      `Ct = Dv − Da = ${formatRumbo(dvCarta)} − ${formatRumbo(daObservada)} = ${formatEW(ctPorEnfilacion(dvCarta, daObservada))}.`,
      `Dv a ${faroC} = Da + Ct = ${formatRumbo(daFaroC)} + (${formatEW(ct)}) = ${formatRumbo(dvFaroC)}.`,
    ],
  };
}

function genRumboTangente(rng: Rng): ChartExercise {
  const peligro = pick(rng, [
    "un bajo señalizado",
    "una piedra a flor de agua",
    "un pecio balizado",
  ]);
  const demora = randStep(rng, 0, 355, 5);
  const dist = randStep(rng, 4, 10, 0.5);
  const resguardo = randStep(rng, 1, Math.min(3, dist - 1), 0.5);
  const alphaRad = Math.asin(resguardo / dist);
  const alpha = (alphaRad * 180) / Math.PI;
  const porEstribor = rng() < 0.5;
  // Dejando el peligro por estribor, el rumbo tangente queda a la izquierda
  // de la demora (se resta α); por babor, a la derecha (se suma α).
  const rumboTangente = norm360(porEstribor ? demora - alpha : demora + alpha);

  return {
    type: "rumbo-tangente",
    statement: `Observamos ${peligro} por la demora verdadera ${formatRumbo(demora)} a ${dist.toString().replace(".", ",")} millas. Queremos pasarlo dejándolo por ${porEstribor ? "estribor" : "babor"} con un resguardo de ${resguardo.toString().replace(".", ",")} millas. Calcula el ángulo de seguridad y el rumbo verdadero tangente.`,
    data: [
      { label: "Demora verdadera al peligro", value: formatRumbo(demora) },
      { label: "Distancia al peligro", value: `${dist.toString().replace(".", ",")} millas` },
      { label: "Resguardo", value: `${resguardo.toString().replace(".", ",")} millas` },
      { label: "El peligro queda por", value: porEstribor ? "estribor" : "babor" },
    ],
    fields: [
      {
        id: "alpha",
        label: "Ángulo de seguridad α (°)",
        kind: "number",
        answer: alpha,
        tolerance: 0.5,
        display: `${alpha.toFixed(1).replace(".", ",")}°`,
      },
      {
        id: "rumbo",
        label: "Rumbo verdadero tangente (°)",
        kind: "number",
        answer: rumboTangente,
        tolerance: 1,
        circular: true,
        display: formatRumbo(rumboTangente),
      },
    ],
    steps: [
      `El rumbo tangente forma con la demora el ángulo α tal que sen α = resguardo / distancia = ${resguardo.toString().replace(".", ",")} / ${dist.toString().replace(".", ",")}.`,
      `α = arcsen(${(resguardo / dist).toFixed(3).replace(".", ",")}) = ${alpha.toFixed(1).replace(".", ",")}°.`,
      `Dejando el peligro por ${porEstribor ? "estribor, el rumbo se abre hacia babor: Rv = demora − α" : "babor, el rumbo se abre hacia estribor: Rv = demora + α"} = ${formatRumbo(demora)} ${porEstribor ? "−" : "+"} ${alpha.toFixed(1).replace(".", ",")}° = ${formatRumbo(rumboTangente)}.`,
    ],
    diagram: "rumbo-tangente",
  };
}

function genCorriente(rng: Rng): ChartExercise {
  const salidaMin = randStep(rng, 8 * 60, 16 * 60, 5);
  const dist = randStep(rng, 8, 24, 0.5);
  const vel = randStep(rng, 5, 10, 0.5);
  const corriente = randStep(rng, 0.5, 3, 0.5);
  const aFavor = rng() < 0.5;
  const sog = aFavor ? vel + corriente : vel - corriente;
  const hours = travelHours(dist, sog);
  const etaMin = Math.round(salidaMin + hours * 60);
  const rumbo = randStep(rng, 0, 355, 5);

  return {
    type: "corriente",
    statement: `Salimos a las ${formatSalida(salidaMin)} al rumbo verdadero ${formatRumbo(rumbo)} a ${vel.toString().replace(".", ",")} nudos de máquina, con una corriente de ${corriente.toString().replace(".", ",")} nudos ${aFavor ? "a favor (misma dirección)" : "en contra (dirección opuesta)"}. La distancia al destino es de ${dist.toString().replace(".", ",")} millas. Calcula la velocidad efectiva y la ETA.`,
    data: [
      { label: "Velocidad de máquina", value: `${vel.toString().replace(".", ",")} nudos` },
      {
        label: "Corriente",
        value: `${corriente.toString().replace(".", ",")} nudos ${aFavor ? "a favor" : "en contra"}`,
      },
      { label: "Distancia", value: `${dist.toString().replace(".", ",")} millas` },
      { label: "Hora de salida", value: formatSalida(salidaMin) },
    ],
    fields: [
      {
        id: "sog",
        label: "Velocidad efectiva (nudos)",
        kind: "number",
        answer: sog,
        tolerance: 0.1,
        display: `${sog.toString().replace(".", ",")} nudos`,
      },
      {
        id: "eta",
        label: "Hora estimada de llegada",
        kind: "time",
        answer: etaMin % (24 * 60),
        tolerance: 2,
        display: formatSalida(etaMin % (24 * 60)),
      },
    ],
    steps: [
      `Con la corriente en la misma dirección de la derrota, la velocidad efectiva es la suma o resta directa: ${vel.toString().replace(".", ",")} ${aFavor ? "+" : "−"} ${corriente.toString().replace(".", ",")} = ${sog.toString().replace(".", ",")} nudos.`,
      `Tiempo = ${dist.toString().replace(".", ",")} / ${sog.toString().replace(".", ",")} = ${formatDuration(hours)}.`,
      `ETA = ${formatSalida(salidaMin)} + ${formatDuration(hours)} = ${formatSalida(etaMin % (24 * 60))}.`,
      "Si la corriente no fuese paralela a la derrota habría que resolver el triángulo de corrientes (se ve en el trazado sobre la carta).",
    ],
  };
}

/** Genera un ejercicio del tipo pedido. `year` = año en curso (dm actualizada). */
export function generateExercise(
  type: ChartExerciseType,
  year: number,
  rng: Rng = Math.random
): ChartExercise {
  switch (type) {
    case "coordenadas":
      return genCoordenadas(rng);
    case "rumbo-distancia-eta":
      return genRumboDistanciaEta(rng);
    case "correccion-total":
      return genCorreccionTotal(rng, year);
    case "rv-ra":
      return genRvRa(rng);
    case "dos-demoras":
      return genDosDemoras(rng, year);
    case "enfilacion-demora":
      return genEnfilacionDemora(rng);
    case "rumbo-tangente":
      return genRumboTangente(rng);
    case "corriente":
      return genCorriente(rng);
  }
}
