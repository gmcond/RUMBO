"use client";

import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SimulacroHistoryPoint {
  /** ISO date del attempt. */
  date: string;
  aciertos: number;
  total: number;
  veredicto: string | null;
}

const dateFormat = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" });

interface ChartDatum extends SimulacroHistoryPoint {
  label: string;
}

function HistoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartDatum }[];
}) {
  const t = useTranslations("study.simulacro");
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="tabular-nums">{t("score", { aciertos: p.aciertos, total: p.total })}</p>
      {p.veredicto && (
        <p
          className={
            p.veredicto === "APTO" ? "text-success font-medium" : "text-danger font-medium"
          }
        >
          {p.veredicto === "APTO" ? t("apto") : t("noApto")}
        </p>
      )}
    </div>
  );
}

/**
 * Evolución de aciertos en simulacros (serie única con el color primario del
 * tema) con la línea del mínimo global como referencia. La lista que la
 * acompaña en la portada es la vista-tabla accesible de estos mismos datos.
 */
export function SimulacroHistoryChart({
  points,
  minAciertos,
}: {
  points: SimulacroHistoryPoint[];
  minAciertos: number;
}) {
  const t = useTranslations("study.simulacro");
  const data: ChartDatum[] = points.map((p) => ({
    ...p,
    label: dateFormat.format(new Date(p.date)),
  }));
  const maxY = Math.max(minAciertos, ...points.map((p) => p.total));

  return (
    <div className="h-56 w-full" role="img" aria-label={t("historyChartLabel")}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            domain={[0, maxY]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<HistoryTooltip />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          />
          <ReferenceLine
            y={minAciertos}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{
              value: t("historyMinLabel", { count: minAciertos }),
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="aciertos"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
