"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  demoraDesdeMarcacion,
  dmForYear,
  dmForYearExact,
  eta,
  formatDuration,
  formatEW,
  formatHm,
  formatRumbo,
  rumboAguja,
  rumboVerdadero,
  totalCorrection,
  travelHours,
} from "@/lib/chart-math";

function num(raw: string): number {
  if (raw.trim() === "") return NaN;
  return Number(raw.trim().replace(",", "."));
}

/**
 * Calculadoras sueltas del trainer de carta (PRD §M3): dm del año, Ct,
 * conversor de rumbos y ETA. Todo cálculo puro en cliente con lib/chart-math.
 */
export function ChartCalculators() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DmCalculator />
      <CtCalculator />
      <ConversorCalculator />
      <EtaCalculator />
    </div>
  );
}

function DmCalculator() {
  const t = useTranslations("study.carta");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const parsed = num(year);
  const valid = Number.isInteger(parsed) && parsed >= 2005 && parsed <= 2100;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("calcDm")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dm-year">{t("calcDmYear")}</Label>
          <Input
            id="dm-year"
            inputMode="numeric"
            className="max-w-32"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        {valid && (
          <dl className="text-sm">
            <div className="flex justify-between gap-3 py-0.5">
              <dt className="text-muted-foreground">{t("calcDmExact")}</dt>
              <dd className="font-medium tabular-nums">{formatEW(dmForYearExact(parsed))}</dd>
            </div>
            <div className="flex justify-between gap-3 py-0.5">
              <dt className="text-muted-foreground">{t("calcDmRounded")}</dt>
              <dd className="font-medium tabular-nums">{formatEW(dmForYear(parsed))}</dd>
            </div>
          </dl>
        )}
        <p className="text-muted-foreground text-xs">{t("calcDmHint")}</p>
      </CardContent>
    </Card>
  );
}

function CtCalculator() {
  const t = useTranslations("study.carta");
  const [dm, setDm] = useState("");
  const [desvio, setDesvio] = useState("");
  const dmN = num(dm);
  const desvioN = num(desvio);
  const valid = Number.isFinite(dmN) && Number.isFinite(desvioN);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("calcCt")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-dm">{t("calcCtDm")}</Label>
            <Input
              id="ct-dm"
              inputMode="decimal"
              className="max-w-32"
              placeholder="-0,5"
              value={dm}
              onChange={(e) => setDm(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ct-desvio">{t("calcCtDesvio")}</Label>
            <Input
              id="ct-desvio"
              inputMode="decimal"
              className="max-w-32"
              placeholder="2"
              value={desvio}
              onChange={(e) => setDesvio(e.target.value)}
            />
          </div>
        </div>
        {valid && (
          <p className="text-sm">
            <span className="text-muted-foreground">Ct = </span>
            <span className="font-medium tabular-nums">
              {formatEW(totalCorrection(dmN, desvioN))}
            </span>
          </p>
        )}
        <p className="text-muted-foreground text-xs">{t("signHint")}</p>
      </CardContent>
    </Card>
  );
}

const CONV_MODES = ["ra-rv", "rv-ra", "rv-dv"] as const;
type ConvMode = (typeof CONV_MODES)[number];

function ConversorCalculator() {
  const t = useTranslations("study.carta");
  const [mode, setMode] = useState<ConvMode>("ra-rv");
  const [rumbo, setRumbo] = useState("");
  const [correccion, setCorreccion] = useState("");
  const rumboN = num(rumbo);
  const corrN = num(correccion);
  const valid = Number.isFinite(rumboN) && Number.isFinite(corrN);

  const result = !valid
    ? null
    : mode === "ra-rv"
      ? rumboVerdadero(rumboN, corrN)
      : mode === "rv-ra"
        ? rumboAguja(rumboN, corrN)
        : demoraDesdeMarcacion(rumboN, corrN);

  const modeLabels: Record<ConvMode, string> = {
    "ra-rv": t("calcConvRaRv"),
    "rv-ra": t("calcConvRvRa"),
    "rv-dv": t("calcConvRvDv"),
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("calcConv")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("calcConv")}>
          {CONV_MODES.map((m) => (
            <label
              key={m}
              className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium"
            >
              <input
                type="radio"
                name="conv-mode"
                checked={mode === m}
                onChange={() => setMode(m)}
                className="accent-primary size-3.5"
              />
              {modeLabels[m]}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conv-rumbo">{mode === "ra-rv" ? "Ra (°)" : "Rv (°)"}</Label>
            <Input
              id="conv-rumbo"
              inputMode="decimal"
              className="max-w-32"
              value={rumbo}
              onChange={(e) => setRumbo(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conv-corr">
              {mode === "rv-dv" ? t("calcConvMarcacion") : "Ct (°, E+/W−)"}
            </Label>
            <Input
              id="conv-corr"
              inputMode="decimal"
              className="max-w-40"
              value={correccion}
              onChange={(e) => setCorreccion(e.target.value)}
            />
          </div>
        </div>
        {result !== null && (
          <p className="text-sm">
            <span className="text-muted-foreground">
              {mode === "ra-rv" ? "Rv = " : mode === "rv-ra" ? "Ra = " : "Dv = "}
            </span>
            <span className="font-medium tabular-nums">{formatRumbo(result)}</span>
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {mode === "rv-dv" ? t("calcConvMarcacionHint") : t("signHint")}
        </p>
      </CardContent>
    </Card>
  );
}

function EtaCalculator() {
  const t = useTranslations("study.carta");
  const [salida, setSalida] = useState("10:00");
  const [dist, setDist] = useState("");
  const [vel, setVel] = useState("");
  const distN = num(dist);
  const velN = num(vel);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(salida);
  const valid = timeMatch !== null && Number.isFinite(distN) && distN > 0 && velN > 0;

  let resultado: { duracion: string; llegada: string } | null = null;
  if (valid && timeMatch) {
    const base = new Date(2000, 0, 1, Number(timeMatch[1]), Number(timeMatch[2]));
    resultado = {
      duracion: formatDuration(travelHours(distN, velN)),
      llegada: formatHm(eta(base, distN, velN)),
    };
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("calcEta")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eta-salida">{t("calcEtaStart")}</Label>
            <Input
              id="eta-salida"
              type="time"
              className="max-w-32"
              value={salida}
              onChange={(e) => setSalida(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eta-dist">{t("calcEtaDist")}</Label>
            <Input
              id="eta-dist"
              inputMode="decimal"
              className="max-w-32"
              value={dist}
              onChange={(e) => setDist(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eta-vel">{t("calcEtaSpeed")}</Label>
            <Input
              id="eta-vel"
              inputMode="decimal"
              className="max-w-32"
              value={vel}
              onChange={(e) => setVel(e.target.value)}
            />
          </div>
        </div>
        {resultado && (
          <dl className="text-sm">
            <div className="flex justify-between gap-3 py-0.5">
              <dt className="text-muted-foreground">{t("calcEtaDuration")}</dt>
              <dd className="font-medium tabular-nums">{resultado.duracion}</dd>
            </div>
            <div className="flex justify-between gap-3 py-0.5">
              <dt className="text-muted-foreground">{t("calcEtaResult")}</dt>
              <dd className="font-medium tabular-nums">{resultado.llegada}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
