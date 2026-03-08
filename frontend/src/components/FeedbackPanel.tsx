import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, Lightbulb, TrendingUp } from "lucide-react"
import type { AnalysisScores } from "@/types/practice"

interface FeedbackPanelProps {
  scores: AnalysisScores
  llmFeedback: string
  prosodyFeedback: string
  pronunciationFeedback: string
  strengths: string[]
  areasToImprove: string[]
  suggestions: string[]
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
        <circle
          cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 36 36)"
          className="transition-all duration-1000"
        />
        <text x="36" y="36" textAnchor="middle" dominantBaseline="central"
          className="text-sm font-bold fill-foreground">{score}</text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  )
}

export function FeedbackPanel({
  scores, llmFeedback, prosodyFeedback, pronunciationFeedback,
  strengths, areasToImprove, suggestions,
}: FeedbackPanelProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-6">
            <ScoreRing score={scores.overall} label="Overall" color="#2563EB" />
            <ScoreRing score={scores.grammar} label="Grammar" color="#22C55E" />
            <ScoreRing score={scores.fluency} label="Fluency" color="#F59E0B" />
            <ScoreRing score={scores.pronunciation} label="Pronunciation" color="#8B5CF6" />
            <ScoreRing score={scores.prosody} label="Prosody" color="#EF4444" />
          </div>
        </CardContent>
      </Card>

      {llmFeedback && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Overall Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{llmFeedback}</p>
          </CardContent>
        </Card>
      )}

      {strengths.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {areasToImprove.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              Areas to Improve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {areasToImprove.map((a, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">!</span>
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-blue-600">
              <Lightbulb className="h-4 w-4" />
              Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 list-decimal list-inside">
              {suggestions.map((s, i) => (
                <li key={i} className="text-sm">{s}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {prosodyFeedback && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Prosody Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{prosodyFeedback}</p>
          </CardContent>
        </Card>
      )}

      {pronunciationFeedback && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Pronunciation Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{pronunciationFeedback}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
