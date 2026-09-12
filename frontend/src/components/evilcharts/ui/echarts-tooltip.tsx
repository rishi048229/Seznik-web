import { indicatorBackground, type ResolvedColors } from "@/components/evilcharts/ui/echarts-chart";
import type { TooltipComponentOption } from "echarts/components";

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip — the shared HTML shell/row primitives and the chart-agnostic option
// fields. The tooltip DOM lives inside `[data-chart={id}]`, so the injected
// `--color-*` vars and Tailwind classes resolve directly (no color read). Each
// chart composes its own rows but shares the shell/styling and base option.
// ─────────────────────────────────────────────────────────────────────────────

export type TooltipVariant = "default" | "frosted-glass";
export type TooltipRoundness = "sm" | "md" | "lg" | "xl";
// Tooltip anchoring: "variable" follows both axes (ECharts default, current
// behavior); "fixed" tracks the pointer's X (centered) but stays pinned near
// the top (fixed Y).
export type TooltipPosition = "fixed" | "variable";

export const roundnessClass: Record<TooltipRoundness, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

export const tooltipVariantClass: Record<TooltipVariant, string> = {
  default: "bg-background",
  "frosted-glass": "bg-background/50 backdrop-blur-md",
};

// The standard series indicator swatch — a rounded square filled with the
// series' solid var or multi-stop gradient (indicatorBackground). A chart drops
// this into a tooltipRow's `indicatorHtml`.
export function tooltipIndicatorHtml(key: string, colorsCount: number): string {
  return `<div class="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm ring-2 ring-white/20 dark:ring-white/10" style="background:${indicatorBackground(key, colorsCount)}"></div>`;
}

// One tooltip row: indicator swatch + label/value pair. `dimmed` is a class
// fragment (e.g. " opacity-30") appended to the row so the selection/hover dim
// stays byte-identical to the inlined markup.
export function tooltipRow({
  indicatorHtml,
  labelText,
  valueText,
  dimmed,
}: {
  indicatorHtml: string;
  labelText: string;
  valueText: string;
  dimmed: string;
}): string {
  return `<div class="flex w-full items-center justify-between gap-6 py-1 text-xs ${dimmed}">
          <div class="flex items-center gap-2">
            ${indicatorHtml}
            <span class="text-gray-400 dark:text-gray-300 font-medium">${labelText}</span>
          </div>
          <span class="font-bold text-gray-900 dark:text-white font-mono tracking-tight tabular-nums">${valueText}</span>
        </div>`;
}

// The outer tooltip surface — border, padding, shadow, roundness + variant
// classes — wrapping the axis label and the composed rows.
export function tooltipShell({
  label,
  body,
  roundness = "lg",
  variant = "default",
}: {
  label: string;
  body: string;
  roundness?: TooltipRoundness;
  variant?: TooltipVariant;
}): string {
  return `<div class="grid min-w-[190px] gap-2 rounded-xl border border-gray-200/90 dark:border-gray-700/80 bg-white/95 dark:bg-[#13141f]/95 px-3.5 py-3 text-xs shadow-2xl backdrop-blur-xl dark:shadow-[0_12px_32px_rgba(0,0,0,0.7)]">
      <div class="font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-800/90 pb-1.5 text-xs flex items-center gap-1.5">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
        <span>${label}</span>
      </div>
      <div class="grid gap-1">${body}</div>
    </div>`;
}

// Maps the TooltipPosition prop onto the ECharts tooltip `position` field.
// "variable" → undefined (default follow-both-axes, current behavior); "fixed" →
// a callback that centers the tooltip on the pointer's X but pins it near the
// top (fixed Y).
export function resolveTooltipPosition(
  position: TooltipPosition,
): TooltipComponentOption["position"] {
  if (position === "variable") return undefined;
  return (point, _params, _dom, _rect, size) => [point[0] - size.contentSize[0] / 2, 8];
}

// The chart-agnostic tooltip option fields (show, trigger, confine,
// background/border/padding/extraCssText, axisPointer, position). The chart
// supplies only `formatter` and spreads this in. `axisPointerColor` is the
// pre-resolved cursor-line color, so this helper needs no live token read.
export function tooltipBaseOption(params: {
  present: boolean;
  cursor: boolean;
  tokens: ResolvedColors["tokens"];
  position: TooltipPosition;
  axisPointerColor: string;
  strokeWidth: number;
}): TooltipComponentOption {
  const { present, cursor, position, axisPointerColor, strokeWidth } = params;

  return {
    show: present,
    trigger: "axis",
    confine: true,
    displayTransition: false,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    extraCssText: "box-shadow:none;",
    axisPointer: cursor
      ? {
          type: "line",
          lineStyle: {
            color: axisPointerColor,
            width: strokeWidth,
            type: [3, 3] as [number, number],
          },
        }
      : { type: "none" },
    position: resolveTooltipPosition(position),
  };
}
