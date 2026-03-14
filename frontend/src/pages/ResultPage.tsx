import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, Play, Pause, Volume2 } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { TranscriptDisplay } from "@/components/TranscriptDisplay"
import { FeedbackPanel } from "@/components/FeedbackPanel"
import { ProsodyChart } from "@/components/ProsodyChart"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

function AudioPlayer({ sessionId }: { sessionId: string }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    fetch(`/api/practice/session/${sessionId}/audio`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error("No audio")
        return res.blob()
      })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        const audio = new Audio(url)
        audio.addEventListener("ended", () => setPlaying(false))
        setAudioEl(audio)
      })
      .catch(() => setError(true))

    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      audioEl?.pause()
    }
  }, [sessionId])

  if (error) return null

  const toggle = () => {
    if (!audioEl) return
    if (playing) {
      audioEl.pause()
    } else {
      audioEl.play()
    }
    setPlaying(!playing)
  }

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">Student Recording</span>
        <Button size="sm" variant="outline" onClick={toggle} disabled={!audioEl} className="ml-auto gap-1.5">
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {playing ? "Pause" : "Play"}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function ResultPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    api.get(`/practice/session/${sessionId}`)
      .then(setSession)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg pt-20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen gradient-bg pt-20 px-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-lg">Session not found</p>
          <Button className="mt-4" onClick={() => navigate("/history")}>Back to History</Button>
        </div>
      </div>
    )
  }

  const practiceResult = session.practice_results?.[0] || {}
  const exercise = session.exercises
  const llmFeedback = practiceResult.llm_feedback ? JSON.parse(practiceResult.llm_feedback) : {}
  const errors = practiceResult.errors ? JSON.parse(practiceResult.errors) : []
  const suggestions = practiceResult.suggestions ? JSON.parse(practiceResult.suggestions) : []

  const scores = {
    overall: practiceResult.overall_score || 0,
    grammar: practiceResult.grammar_score || 0,
    fluency: practiceResult.fluency_score || 0,
    pronunciation: practiceResult.pronunciation_score || 0,
    prosody: practiceResult.prosody_score || 0,
  }

  const prosodyMetrics = {
    speech_rate: practiceResult.speech_rate || 0,
    articulation_rate: 0,
    pause_count: practiceResult.pause_count || 0,
    mean_pause_duration: practiceResult.mean_pause_duration || 0,
    long_pause_count: 0,
    f0_mean: practiceResult.f0_mean || 0,
    f0_std: practiceResult.f0_std || 0,
    intonation_index: practiceResult.intonation_index || 0,
    total_speech_time: 0,
    total_duration: session.duration_seconds || 0,
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/history")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> History
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{exercise?.title || "Free Practice"}</h1>
            <p className="text-sm text-muted-foreground">
              {session.created_at ? new Date(session.created_at).toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }) : ""}
            </p>
          </div>
          {practiceResult.is_read_aloud !== null && (
            <Badge variant={practiceResult.is_read_aloud ? "warning" : "success"}>
              {practiceResult.is_read_aloud ? "Read Aloud" : "Spontaneous"}
            </Badge>
          )}
        </div>

        <div className="space-y-6">
          {sessionId && session.has_audio && (
            <AudioPlayer sessionId={sessionId} />
          )}
          <TranscriptDisplay
            transcript={session.transcript || ""}
            errors={errors}
            pronunciationIssues={[]}
          />
          <ProsodyChart metrics={prosodyMetrics} />
          <FeedbackPanel
            scores={scores}
            llmFeedback={llmFeedback.overall_assessment || ""}
            prosodyFeedback={llmFeedback.prosody_feedback || ""}
            pronunciationFeedback={llmFeedback.pronunciation_feedback || ""}
            strengths={llmFeedback.strengths || []}
            areasToImprove={llmFeedback.areas_to_improve || []}
            suggestions={suggestions}
          />

          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/practice")}>Practice Again</Button>
            <Button variant="outline" onClick={() => navigate("/")}>Dashboard</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
