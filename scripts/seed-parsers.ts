/**
 * Parsers de content/seed/manual-per.md para la Fase 1:
 *   - parseLessons: subsecciones `### n.m Título` de cada UT → lessons
 *   - parseBateria: las 60 preguntas con respuesta inline `**R: x**`
 *   - parseSimulacro: las 45 preguntas cuya respuesta vive en la hoja final
 *
 * parseUnits (cabeceras de UT) sigue viviendo en scripts/seed.ts.
 */

export interface ParsedLesson {
  unitNumero: number;
  orden: number;
  titulo: string;
  slug: string;
  cuerpoMd: string;
}

export type Opciones = [string, string, string, string];

export interface ParsedQuestion {
  /** Número dentro de su bloque del manual (1-60 batería, 1-45 simulacro). */
  numero: number;
  unitNumero: number;
  enunciado: string;
  opciones: Opciones;
  /** Índice 0-3 (a=0 … d=3). */
  correcta: number;
  explicacion: string | null;
}

/** Distribución oficial UT1→UT11 del examen catalán (Anexo II RD 875/2014). */
export const SIMULACRO_DISTRIBUCION = [4, 2, 4, 2, 5, 10, 2, 3, 4, 5, 4] as const;

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const UNIT_HEADER = /^## UT(\d+) — (.+)$/;
const LESSON_HEADER = /^### (\d+)\.(\d+) (.+)$/;

/** Trocea cada UT en lecciones a partir de sus subsecciones `### n.m Título`. */
export function parseLessons(markdown: string): ParsedLesson[] {
  const lines = markdown.split(/\r?\n/);
  const lessons: ParsedLesson[] = [];

  let currentUnit: number | null = null;
  let current: ParsedLesson | null = null;
  let introLines: string[] = [];
  let firstLessonOfUnit: ParsedLesson | null = null;

  const flush = () => {
    if (!current) return;
    current.cuerpoMd = current.cuerpoMd.trim();
    lessons.push(current);
    current = null;
  };

  const attachIntro = () => {
    // Los párrafos de introducción de la UT posteriores a su descripción
    // (p. ej. las regiones IALA en UT5) se anteponen a la primera lección
    // para no perder contenido.
    if (!firstLessonOfUnit) return;
    const paragraphs = introLines
      .join("\n")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    const extra = paragraphs.slice(1); // el primero es la descripción de la UT
    if (extra.length > 0) {
      firstLessonOfUnit.cuerpoMd = `${extra.join("\n\n")}\n\n${firstLessonOfUnit.cuerpoMd}`.trim();
    }
    firstLessonOfUnit = null;
    introLines = [];
  };

  for (const line of lines) {
    const unitMatch = UNIT_HEADER.exec(line);
    if (unitMatch) {
      flush();
      attachIntro();
      currentUnit = Number(unitMatch[1]);
      introLines = [];
      continue;
    }

    if (/^## /.test(line)) {
      // Sección no-UT (batería, simulacro, consejos…): cierra el modo UT.
      flush();
      attachIntro();
      currentUnit = null;
      continue;
    }

    if (currentUnit === null) continue;

    const lessonMatch = LESSON_HEADER.exec(line);
    if (lessonMatch) {
      flush();
      const numero = Number(lessonMatch[1]);
      if (numero !== currentUnit) {
        throw new Error(`Sección ${lessonMatch[1]}.${lessonMatch[2]} bajo la UT${currentUnit}`);
      }
      const titulo = lessonMatch[3].trim();
      current = {
        unitNumero: currentUnit,
        orden: Number(lessonMatch[2]),
        titulo,
        slug: slugify(titulo),
        cuerpoMd: "",
      };
      if (!firstLessonOfUnit) firstLessonOfUnit = current;
      continue;
    }

    if (current) {
      current.cuerpoMd += `${line}\n`;
    } else {
      introLines.push(line);
    }
  }

  flush();
  attachIntro();
  return lessons;
}

/** Divide "enunciado: a) … b) … c) … d) …" en enunciado + 4 opciones. */
function splitOptions(body: string): { enunciado: string; opciones: Opciones } {
  const letters = ["a", "b", "c", "d"] as const;
  const positions: number[] = [];
  let searchFrom = 0;

  for (const letter of letters) {
    const marker = ` ${letter}) `;
    const idx = body.indexOf(marker, searchFrom);
    if (idx === -1) throw new Error(`Falta la opción "${letter})" en: ${body}`);
    positions.push(idx);
    searchFrom = idx + marker.length;
  }

  const enunciado = body.slice(0, positions[0]).trim();
  const opciones = letters.map((letter, i) => {
    const start = positions[i] + ` ${letter}) `.length;
    const end = i < 3 ? positions[i + 1] : body.length;
    return body.slice(start, end).trim().replace(/\.$/, "");
  }) as Opciones;

  if (!enunciado || opciones.some((o) => !o)) {
    throw new Error(`Pregunta mal formada: ${body}`);
  }
  return { enunciado, opciones };
}

function letterToIndex(letter: string): number {
  return letter.charCodeAt(0) - "a".charCodeAt(0);
}

/** Devuelve las líneas de una sección `## Título…` (hasta el siguiente `## `). */
function sectionLines(markdown: string, headingPrefix: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(headingPrefix));
  if (start === -1) throw new Error(`Sección no encontrada: ${headingPrefix}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

/** Batería de 60 preguntas con respuesta inline `**R: x**` y explicación opcional. */
export function parseBateria(markdown: string): ParsedQuestion[] {
  const lines = sectionLines(markdown, "## Batería de preguntas tipo test");
  const questions: ParsedQuestion[] = [];
  let currentUnit: number | null = null;

  for (const line of lines) {
    const unitMatch = /^### UT(\d+) — /.exec(line);
    if (unitMatch) {
      currentUnit = Number(unitMatch[1]);
      continue;
    }

    const questionMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (!questionMatch) continue;
    if (currentUnit === null) throw new Error(`Pregunta fuera de una UT: ${line}`);

    const answerMatch = /\*\*R:\s*([a-d])\*\*\.?(?:\s*\((.+?)\)\.?)?\s*$/.exec(questionMatch[2]);
    if (!answerMatch) throw new Error(`Batería sin respuesta inline: ${line}`);

    const body = questionMatch[2].slice(0, answerMatch.index).trim();
    const { enunciado, opciones } = splitOptions(body);

    questions.push({
      numero: Number(questionMatch[1]),
      unitNumero: currentUnit,
      enunciado,
      opciones,
      correcta: letterToIndex(answerMatch[1]),
      explicacion: answerMatch[2]?.trim() || null,
    });
  }

  return questions;
}

/** Simulacro de 45 preguntas; la UT se deduce del nº global vía la distribución. */
export function parseSimulacro(markdown: string): ParsedQuestion[] {
  const lines = sectionLines(markdown, "## Simulacro de examen completo");

  // UT por nº de pregunta: 1-4 → UT1, 5-6 → UT2, … 42-45 → UT11.
  const unitByNumero = new Map<number, number>();
  let numero = 1;
  SIMULACRO_DISTRIBUCION.forEach((count, i) => {
    for (let k = 0; k < count; k++) unitByNumero.set(numero++, i + 1);
  });

  const answers = new Map<number, number>();
  let inAnswerSheet = false;
  const questions: ParsedQuestion[] = [];

  for (const line of lines) {
    if (/^### Hoja de respuestas/.test(line)) {
      inAnswerSheet = true;
      continue;
    }
    if (/^### /.test(line)) {
      inAnswerSheet = false;
      continue;
    }
    if (line.startsWith(">")) continue; // avisos en blockquote

    if (inAnswerSheet) {
      // Solo líneas que son la hoja en sí ("1-b, 2-b, …"), no las notas al pie.
      if (!/^\d+-[a-d]/.test(line.trim())) continue;
      for (const pair of line.matchAll(/(\d+)-([a-d])\b/g)) {
        answers.set(Number(pair[1]), letterToIndex(pair[2]));
      }
      continue;
    }

    const questionMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (!questionMatch) continue;

    const n = Number(questionMatch[1]);
    const unitNumero = unitByNumero.get(n);
    if (!unitNumero) throw new Error(`Pregunta ${n} fuera de la distribución del simulacro`);

    const { enunciado, opciones } = splitOptions(questionMatch[2].trim());
    questions.push({
      numero: n,
      unitNumero,
      enunciado,
      opciones,
      correcta: -1, // se resuelve con la hoja de respuestas
      explicacion: null,
    });
  }

  for (const q of questions) {
    const correcta = answers.get(q.numero);
    if (correcta === undefined) {
      throw new Error(`Pregunta ${q.numero} sin respuesta en la hoja del simulacro`);
    }
    q.correcta = correcta;
  }

  return questions;
}
