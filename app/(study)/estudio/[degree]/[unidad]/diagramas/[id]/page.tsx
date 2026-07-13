import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DiagramViewer } from "@/components/study/diagram-viewer";
import { Button } from "@/components/ui/button";
import { getDegree, getUnit, parseUnidadParam } from "@/lib/study/data";
import { createClient } from "@/lib/supabase/server";
import { hotspotsSchema } from "@/lib/validation/study";

export const metadata: Metadata = { title: "Diagrama" };

export default async function DiagramPage({
  params,
}: {
  params: Promise<{ degree: string; unidad: string; id: string }>;
}) {
  const { degree: degreeSlug, unidad, id } = await params;
  const numero = parseUnidadParam(unidad);
  if (!numero) notFound();

  const supabase = await createClient();
  const degree = await getDegree(supabase, degreeSlug);
  if (!degree) notFound();
  const unit = await getUnit(supabase, degree.id, numero);
  if (!unit) notFound();

  const { data: diagram } = await supabase
    .from("diagrams")
    .select("id, titulo, svg_path, hotspots, unit_id")
    .eq("id", id)
    .maybeSingle();
  if (!diagram || diagram.unit_id !== unit.id) notFound();

  const hotspots = hotspotsSchema.safeParse(diagram.hotspots);
  if (!hotspots.success || !diagram.svg_path.startsWith("/diagrams/")) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href={`/estudio/${degree.slug}/ut${unit.numero}`}>
            <ArrowLeft aria-hidden />
            UT{unit.numero} · {unit.titulo}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{diagram.titulo}</h1>
      </div>

      <DiagramViewer svgUrl={diagram.svg_path} hotspots={hotspots.data} />
    </div>
  );
}
