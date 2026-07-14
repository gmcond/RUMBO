/**
 * Diff campo a campo para los changesets del pipeline de contenido (PRD §M5).
 * Lógica pura y testeada (CLAUDE.md regla 3): el pipeline la usa para generar
 * `content_changesets.diff` y el admin para aplicar lo aprobado.
 */

export type DiffEntry = {
  old: unknown;
  new: unknown;
  source_url: string;
  confidence: number;
};

export type ChangesetDiff = Record<string, DiffEntry>;

export type ExtractedField = {
  value: unknown;
  source_url: string;
  confidence: number;
};

/** Igualdad estructural de valores JSON: las claves de objeto no tienen orden. */
export function jsonEquals(a: unknown, b: unknown): boolean {
  return normalize(a) === normalize(b);
}

function normalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)])
    );
  }
  return value;
}

/**
 * Compara la fila actual (o null si no existe) con los campos extraídos y
 * devuelve solo lo que cambia. Un diff vacío significa «nada que proponer».
 */
export function buildChangesetDiff(
  current: Record<string, unknown> | null,
  extracted: Record<string, ExtractedField | undefined>
): ChangesetDiff {
  const diff: ChangesetDiff = {};

  for (const [field, entry] of Object.entries(extracted)) {
    if (!entry) continue;
    const oldValue = current?.[field] ?? null;
    if (jsonEquals(oldValue, entry.value)) continue;

    diff[field] = {
      old: oldValue,
      new: entry.value,
      source_url: entry.source_url,
      confidence: entry.confidence,
    };
  }

  return diff;
}

/** Payload de update/insert a partir de un diff aprobado: {campo: valor nuevo}. */
export function diffToUpdatePayload(diff: ChangesetDiff): Record<string, unknown> {
  return Object.fromEntries(Object.entries(diff).map(([field, entry]) => [field, entry.new]));
}
