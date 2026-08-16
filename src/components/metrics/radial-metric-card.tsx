import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { formatPercent } from "@/lib/format"
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts"

interface RadialMetricCardProps {
  title: string
  description?: string
  /** 0–100, or null while no data has arrived yet */
  value: number | null
  colorVar: string
  /** Absolute reading behind the percentage, e.g. "10.5 GiB / 16.0 GiB". */
  caption?: string
  /** Qualifier for the caption, e.g. where the limit came from. */
  footnote?: string
}

export function RadialMetricCard({
  title,
  description,
  value,
  colorVar,
  caption,
  footnote,
}: RadialMetricCardProps) {
  const chartConfig = {
    value: { label: title, color: colorVar },
  } satisfies ChartConfig

  const clamped = value === null ? 0 : Math.min(100, Math.max(0, value))

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-2">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[160px] w-full"
        >
          <RadialBarChart
            data={[{ name: title, value: clamped, fill: "var(--color-value)" }]}
            startAngle={90}
            endAngle={90 - (clamped / 100) * 360}
            innerRadius={58}
            outerRadius={74}
          >
            <RadialBar dataKey="value" background cornerRadius={8} />
            <PolarRadiusAxis
              tick={false}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            >
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                    return null
                  }
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-2xl font-bold"
                      >
                        {value === null ? "n/a" : formatPercent(value)}
                      </tspan>
                    </text>
                  )
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
        {caption ? (
          <div className="flex flex-col items-center gap-0.5 text-center">
            <span className="text-sm font-medium tabular-nums">{caption}</span>
            {footnote ? (
              <span className="text-xs text-muted-foreground">{footnote}</span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
