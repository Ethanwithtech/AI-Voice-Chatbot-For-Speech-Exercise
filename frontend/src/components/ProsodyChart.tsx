import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { BarChart3, Clock, Zap, Activity } from "lucide-react"
import type { ProsodyMetrics } from "@/types/practice"

interface ProsodyChartProps {
  metrics: ProsodyMetrics
}

function MetricCard({ icon: Icon, label, value, unit, status }: {
  icon: React.ElementType; label: string; value: string | number; unit: string; status: "good" | "warning" | "bad"
}) {
  const colors = {
    good: "text-green-600 bg-green-50 dark:bg-green-950/30",
    warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
    bad: "text-red-600 bg-red-50 dark:bg-red-950/30",
  }

  return (
    <div className={`p-4 rounded-xl ${colors[status]} transition-all`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs opacity-70">{unit}</span>
      </div>
    </div>
  )
}

export function ProsodyChart({ metrics }: ProsodyChartProps) {
  const rateStatus = metrics.speech_rate >= 120 && metrics.speech_rate <= 170 ? "good"
    : metrics.speech_rate >= 80 && metrics.speech_rate <= 200 ? "warning" : "bad"

  const pauseStatus = metrics.long_pause_count <= 2 ? "good"
    : metrics.long_pause_count <= 5 ? "warning" : "bad"

  const intonationStatus = metrics.intonation_index >= 0.2 ? "good"
    : metrics.intonation_index >= 0.1 ? "warning" : "bad"

  const f0Status = metrics.f0_std >= 30 ? "good"
    : metrics.f0_std >= 15 ? "warning" : "bad"

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Voice Analysis Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            icon={Zap} label="Speech Rate"
            value={Math.round(metrics.speech_rate)} unit="wpm"
            status={rateStatus}
          />
          <MetricCard
            icon={Clock} label="Long Pauses"
            value={metrics.long_pause_count} unit="times"
            status={pauseStatus}
          />
          <MetricCard
            icon={Activity} label="Intonation"
            value={metrics.intonation_index.toFixed(2)} unit="index"
            status={intonationStatus}
          />
          <MetricCard
            icon={Activity} label="Pitch Variation"
            value={Math.round(metrics.f0_std)} unit="Hz"
            status={f0Status}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">Avg Pause:</span>
            <span className="font-medium ml-1">{metrics.mean_pause_duration.toFixed(2)}s</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">Total Pauses:</span>
            <span className="font-medium ml-1">{metrics.pause_count}</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">F0 Mean:</span>
            <span className="font-medium ml-1">{Math.round(metrics.f0_mean)} Hz</span>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">Speech Time:</span>
            <span className="font-medium ml-1">{metrics.total_speech_time.toFixed(1)}s / {metrics.total_duration.toFixed(1)}s</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
