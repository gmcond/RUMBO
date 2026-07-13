import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import {
  SimulacroRunner,
  type SimulacroModo,
  type SimulacroQuestion,
} from "@/components/study/simulacro-runner";
import { Button } from "@/components/ui/button";
import { parseDistribucion, parseTopes } from "@/lib/exam-grading";
import { getDegree, getUnitsForDegree, parseOpciones, shuffleOptions } from "@/lib/study/data";
import { buildSimulacroPool } from "@/lib/study/simulacro";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Simulacro" };

interface Candidate {
  id: string;
  enunciado: string;
  opciones: Json;
  unit: number;
  correcta?: number;
  explicacion?: string | null;
}

/**
 * Monta un simulacro nuevo respetando la distribución de la exam_config.
 * En modo examen las preguntas viajan SIN `correcta`; en práctica sí va
 * (contenido publicado, lectura pública por RLS) para la explicación
 * inmediata. Si hay una sesión guardada, el runner ofrece reanudarla y este
 * pool recién montado se descarta.
 */
export default async function SimulacroActivoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("study.simulacro");
  const supabase = await createClient();

  const modo: SimulacroModo = params.modo === "practica" ? "practica" : "examen";
  const ccaa = typeof params.ccaa === "string" ? params.ccaa : "CAT";
  const autoResume = params.resume === "1";

  const backButton = (
    <Button asChild variant="outline" size="sm" className="self-start">
      <Link href="/estudio/simulacro">
        <ArrowLeft aria-hidden />
        {t("backToStart")}
      </Link>
    </Button>
  );

  const degree = await getDegree(supabase, "per");
  if (!degree) return null;

  const { data: config } = await supabase
    .from("exam_configs")
    .select("id, ccaa, num_preguntas, duracion_min, min_aciertos, distribucion, topes")
    .eq("degree_id", degree.id)
    .eq("ccaa", ccaa)
    .maybeSingle();

  if (!config) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">{t("noConfig")}</p>
        {backButton}
      </div>
    );
  }

  const units = await getUnitsForDegree(supabase, degree.id);
  const unitIds = units.map((u) => u.id);

  let candidates: Candidate[];
  if (modo === "practica") {
    const { data, error } = await supabase
      .from("questions")
      .select("id, enunciado, opciones, correcta, explicacion, units(numero)")
      .eq("estado", "published")
      .in("unit_id", unitIds);
    if (error) throw new Error(`questions: ${error.message}`);
    candidates = (data ?? []).map((q) => ({
      id: q.id,
      enunciado: q.enunciado,
      opciones: q.opciones,
      unit: q.units.numero,
      correcta: q.correcta,
      explicacion: q.explicacion,
    }));
  } else {
    const { data, error } = await supabase
      .from("questions")
      .select("id, enunciado, opciones, units(numero)")
      .eq("estado", "published")
      .in("unit_id", unitIds);
    if (error) throw new Error(`questions: ${error.message}`);
    candidates = (data ?? []).map((q) => ({
      id: q.id,
      enunciado: q.enunciado,
      opciones: q.opciones,
      unit: q.units.numero,
    }));
  }

  const pool = buildSimulacroPool(candidates, parseDistribucion(config.distribucion));
  if (!pool.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          {t("insufficient", {
            units: pool.missing.map((m) => `UT${m.unit} (${m.available}/${m.needed})`).join(", "),
          })}
        </p>
        {backButton}
      </div>
    );
  }

  const questions: SimulacroQuestion[] = pool.questions.map((q) => {
    const { opciones, map } = shuffleOptions(parseOpciones(q.opciones));
    return {
      questionId: q.id,
      enunciado: q.enunciado,
      opciones,
      map,
      unit: q.unit,
      ...(modo === "practica" ? { correcta: q.correcta, explicacion: q.explicacion } : {}),
    };
  });

  return (
    <SimulacroRunner
      questions={questions}
      config={{
        configId: config.id,
        ccaa: config.ccaa,
        duracionMin: config.duracion_min,
        minAciertos: config.min_aciertos,
        topes: parseTopes(config.topes),
      }}
      modo={modo}
      autoResume={autoResume}
    />
  );
}
