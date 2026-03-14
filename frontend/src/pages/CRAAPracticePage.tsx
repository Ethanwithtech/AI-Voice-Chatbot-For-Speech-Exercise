import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  Loader2, Upload, CheckCircle, ArrowLeft, Play, Pause, Volume2,
  Clock, Mic, Square, Headphones, PenLine, FileText, Swords,
  ChevronRight, AlertCircle, Lightbulb, TrendingUp
} from "lucide-react"
import { api } from "@/lib/api"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { AudioRecorder } from "@/components/AudioRecorder"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Exercise } from "@/types/exercise"

type CRAAStage = "intro" | "listen" | "prepare" | "record" | "analyzing" | "result"

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

// ---------- Score Ring ----------
function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 30, c = 2 * Math.PI * r, off = c - (score / 100) * c
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 36 36)"
          className="transition-all duration-1000" />
        <text x="36" y="36" textAnchor="middle" dominantBaseline="central" className="text-sm font-bold fill-foreground">{score}</text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  )
}

// ---------- Grade Badge ----------
function GradeBadge({ grade }: { grade: string }) {
  const color = grade.startsWith("A") ? "success" : grade.startsWith("B") ? "warning" : "destructive"
  return <Badge variant={color} className="text-lg px-3 py-1 font-bold">{grade}</Badge>
}

export default function CRAAPracticePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const exerciseId = searchParams.get("exerciseId")

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [stage, setStage] = useState<CRAAStage>("intro")
  const [notes, setNotes] = useState("")
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  // Timers
  const [prepTimeLeft, setPrepTimeLeft] = useState(120)
  const [recordTimeLeft, setRecordTimeLeft] = useState(120)
  const prepTimerRef = useRef<number | null>(null)
  const recordTimerRef = useRef<number | null>(null)

  // Audio player for argument
  const [argAudioUrl, setArgAudioUrl] = useState<string | null>(null)
  const [argPlaying, setArgPlaying] = useState(false)
  const argAudioRef = useRef<HTMLAudioElement | null>(null)
  const [argAudioLoaded, setArgAudioLoaded] = useState(false)

  // Audio playback for result
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [isPlayingResult, setIsPlayingResult] = useState(false)
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null)

  const loadPlaybackAudio = (sessionId: number) => {
    const token = localStorage.getItem("token")
    fetch(`/api/practice/session/${sessionId}/audio`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        setPlaybackUrl(url)
        const audio = new Audio(url)
        audio.addEventListener("ended", () => setIsPlayingResult(false))
        playbackAudioRef.current = audio
      })
      .catch(() => { })
  }

  const togglePlayback = () => {
    if (!playbackAudioRef.current) return
    if (isPlayingResult) {
      playbackAudioRef.current.pause()
    } else {
      playbackAudioRef.current.play()
    }
    setIsPlayingResult(!isPlayingResult)
  }

  // Cleanup playback audio
  useEffect(() => {
    return () => {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl)
    }
  }, [playbackUrl])

  // Recorder
  const recorder = useAudioRecorder()

  // Load exercise
  useEffect(() => {
    if (!exerciseId) return
    api.get<Exercise>(`/exercises/${exerciseId}`).then(ex => {
      setExercise(ex)
      setPrepTimeLeft(ex.preparation_time || 120)
      setRecordTimeLeft(ex.response_time || 120)
    }).catch(err => {
      setError("Exercise not found")
    })
  }, [exerciseId])

  // Load argument audio if available
  useEffect(() => {
    if (!exercise?.has_argument_audio || !exercise.id) return
    const token = localStorage.getItem("token")
    fetch(`/api/exercises/${exercise.id}/argument-audio`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(blob => {
        const url = URL.createObjectURL(blob)
        setArgAudioUrl(url)
        const audio = new Audio(url)
        audio.addEventListener("ended", () => setArgPlaying(false))
        audio.addEventListener("canplaythrough", () => setArgAudioLoaded(true))
        argAudioRef.current = audio
      })
      .catch(() => { })

    return () => { if (argAudioUrl) URL.revokeObjectURL(argAudioUrl) }
  }, [exercise])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (prepTimerRef.current) clearInterval(prepTimerRef.current)
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    }
  }, [])

  // ---------- Stage transitions ----------
  const startListening = () => {
    setStage("listen")
    // Auto-play argument audio if available
    if (argAudioRef.current) {
      argAudioRef.current.play()
      setArgPlaying(true)
    }
  }

  const finishListening = () => {
    if (argAudioRef.current) { argAudioRef.current.pause(); argAudioRef.current.currentTime = 0 }
    setArgPlaying(false)
    setStage("prepare")
    // Start preparation countdown
    const prepTime = exercise?.preparation_time || 120
    setPrepTimeLeft(prepTime)
    prepTimerRef.current = window.setInterval(() => {
      setPrepTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(prepTimerRef.current!)
          prepTimerRef.current = null
          startRecordingPhase()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const startRecordingPhase = () => {
    if (prepTimerRef.current) { clearInterval(prepTimerRef.current); prepTimerRef.current = null }
    setStage("record")
    recorder.reset()
    const respTime = exercise?.response_time || 120
    setRecordTimeLeft(respTime)
  }

  // Auto-stop when time runs out
  useEffect(() => {
    if (stage !== "record" || recorder.state !== "recording") return
    const respTime = exercise?.response_time || 120
    setRecordTimeLeft(respTime)
    recordTimerRef.current = window.setInterval(() => {
      setRecordTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(recordTimerRef.current!)
          recordTimerRef.current = null
          recorder.stopRecording()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (recordTimerRef.current) clearInterval(recordTimerRef.current) }
  }, [stage, recorder.state])

  // Submit audio when recording stops
  useEffect(() => {
    if (recorder.state === "stopped" && recorder.audioBlob && stage === "record") {
      submitAudio(recorder.audioBlob)
    }
  }, [recorder.state])

  const handleStopRecording = () => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
    recorder.stopRecording()
  }

  const submitAudio = async (blob: Blob) => {
    setStage("analyzing")
    setError("")
    const formData = new FormData()
    formData.append("audio", blob, "recording.webm")
    formData.append("exercise_id", String(exercise?.id))

    try {
      const data = await api.upload<any>("/practice/craa-analyze", formData)
      setResult(data)
      setStage("result")
      // Load audio for playback in result page
      if (data.session_id) {
        loadPlaybackAudio(data.session_id)
      }
    } catch (err: any) {
      setError(err.message || "Analysis failed")
      setStage("record")
    }
  }

  const toggleArgAudio = () => {
    if (!argAudioRef.current) return
    if (argPlaying) { argAudioRef.current.pause() } else { argAudioRef.current.play() }
    setArgPlaying(!argPlaying)
  }

  // ---------- Render stages ----------

  if (!exercise && !error) {
    return (
      <div className="min-h-screen gradient-bg pt-20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !result) {
    return (
      <div className="min-h-screen gradient-bg pt-20 px-6">
        <div className="max-w-3xl mx-auto text-center py-12">
          <p className="text-lg text-destructive">{error}</p>
          <Button className="mt-4" onClick={() => navigate("/practice")}>Back to Practice</Button>
        </div>
      </div>
    )
  }

  // --- RESULT STAGE ---
  if (stage === "result" && result) {
    const craa = result.craa_feedback || {}
    const sa = craa.summary_accuracy || {}
    const cq = craa.counterargument_quality || {}
    const vd = craa.verbal_delivery || {}

    return (
      <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => navigate("/practice")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">CRAA Results</h1>
              <p className="text-sm text-muted-foreground">{exercise?.title}</p>
            </div>
            {result.overall_grade && <GradeBadge grade={result.overall_grade} />}
          </div>

          <div className="space-y-6">
            {/* Overall Scores */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> CRAA Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap justify-center gap-6">
                  <ScoreRing score={result.scores?.overall || 0} label="Overall" color="#2563EB" />
                  <ScoreRing score={result.scores?.summary_accuracy || 0} label="Summary (40%)" color="#22C55E" />
                  <ScoreRing score={result.scores?.counterargument || 0} label="Counter (30%)" color="#F59E0B" />
                  <ScoreRing score={result.scores?.verbal_delivery || 0} label="Delivery (30%)" color="#8B5CF6" />
                </div>
              </CardContent>
            </Card>

            {/* Summary Accuracy */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  Summary Accuracy
                  {sa.grade && <Badge variant="outline" className="ml-2">{sa.grade}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed">{sa.feedback}</p>
                {sa.main_ideas_covered?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-1">Main ideas covered:</p>
                    <ul className="text-sm space-y-1">{sa.main_ideas_covered.map((idea: string, i: number) => <li key={i} className="flex gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />{idea}</li>)}</ul>
                  </div>
                )}
                {sa.main_ideas_missed?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-600 mb-1">Main ideas missed:</p>
                    <ul className="text-sm space-y-1">{sa.main_ideas_missed.map((idea: string, i: number) => <li key={i} className="flex gap-2"><AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />{idea}</li>)}</ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Counterargument Quality */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Swords className="h-4 w-4 text-amber-600" />
                  Counterargument Quality
                  {cq.grade && <Badge variant="outline" className="ml-2">{cq.grade}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-relaxed">{cq.feedback}</p>
                {cq.strategy_used && <p className="text-xs"><span className="font-semibold">Strategy:</span> {cq.strategy_used}</p>}
                {cq.logical_issues?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-1">Logical issues:</p>
                    <ul className="text-sm space-y-1">{cq.logical_issues.map((issue: string, i: number) => <li key={i} className="flex gap-2"><AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />{issue}</li>)}</ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Verbal Delivery */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mic className="h-4 w-4 text-purple-600" />
                  Verbal Delivery
                  {vd.grade && <Badge variant="outline" className="ml-2">{vd.grade}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm leading-relaxed">{vd.feedback}</p>
                {vd.pronunciation_notes && <p className="text-xs text-muted-foreground"><span className="font-semibold">Pronunciation:</span> {vd.pronunciation_notes}</p>}
                {vd.fluency_notes && <p className="text-xs text-muted-foreground"><span className="font-semibold">Fluency:</span> {vd.fluency_notes}</p>}
              </CardContent>
            </Card>

            {/* Play Your Recording */}
            {playbackAudioRef.current && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Volume2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Your Recording</p>
                        <p className="text-xs text-muted-foreground">Listen to your response</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={togglePlayback} className="gap-2">
                      {isPlayingResult ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {isPlayingResult ? "Pause" : "Play"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transcript */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Your Response (Transcription)</CardTitle></CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-muted/50 text-sm leading-relaxed">{result.transcript}</div>
              </CardContent>
            </Card>

            {/* Strengths & Improvements */}
            {result.strengths?.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2 text-green-600"><CheckCircle className="h-4 w-4" />Strengths</CardTitle></CardHeader>
                <CardContent><ul className="space-y-2">{result.strengths.map((s: string, i: number) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-green-500 mt-0.5">+</span>{s}</li>)}</ul></CardContent>
              </Card>
            )}

            {result.suggestions?.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2 text-blue-600"><Lightbulb className="h-4 w-4" />Suggestions</CardTitle></CardHeader>
                <CardContent><ol className="space-y-2 list-decimal list-inside">{result.suggestions.map((s: string, i: number) => <li key={i} className="text-sm">{s}</li>)}</ol></CardContent>
              </Card>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={() => { setStage("intro"); setResult(null); recorder.reset(); setError("") }}>Practice Again</Button>
              <Button variant="outline" onClick={() => navigate("/practice")}>Back to Practice</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/practice")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Practice
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{exercise?.title || "CRAA Practice"}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline"><Swords className="h-3 w-3 mr-1" />CRAA</Badge>
              <Badge variant={exercise?.difficulty === "easy" ? "success" : exercise?.difficulty === "hard" ? "destructive" : "warning"}>
                {exercise?.difficulty}
              </Badge>
            </div>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {(["listen", "prepare", "record"] as const).map((s, i) => {
            const icons = [Headphones, PenLine, Mic]
            const labels = ["Listen", "Prepare", "Record"]
            const stageOrder = { intro: -1, listen: 0, prepare: 1, record: 2, analyzing: 3, result: 3 }
            const current = stageOrder[stage]
            const Icon = icons[i]
            const isActive = current === i
            const isDone = current > i

            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isActive ? "bg-primary text-primary-foreground shadow-md" : isDone ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  {labels[i]}
                </div>
              </div>
            )
          })}
        </div>

        <Card className="min-h-[400px]">
          <CardContent className="p-6">
            {/* INTRO */}
            {stage === "intro" && (
              <div className="text-center py-8 space-y-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto shadow-lg">
                  <Swords className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">Critical Response to Academic Arguments</h2>
                  <p className="text-muted-foreground max-w-lg mx-auto">{exercise?.description}</p>
                </div>

                {exercise?.topic_context && (
                  <div className="text-left max-w-lg mx-auto p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 uppercase">Topic Background</p>
                    <p className="text-sm leading-relaxed">{exercise.topic_context}</p>
                  </div>
                )}

                {exercise?.video_url && (
                  <div className="max-w-lg mx-auto">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">📺 Background Video</p>
                    <div className="relative w-full rounded-lg overflow-hidden border" style={{ paddingBottom: "56.25%" }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={exercise.video_url.replace("watch?v=", "embed/").replace("&t=", "?start=").replace("s", "")}
                        title="Background Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Watch this video to learn about the topic before starting the exercise.</p>
                  </div>
                )}

                <div className="text-left max-w-lg mx-auto space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">How it works</h3>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0"><Headphones className="h-4 w-4 text-blue-600" /></div>
                    <div><p className="font-medium text-sm">Step 1: Listen</p><p className="text-xs text-muted-foreground">Listen to the academic argument recording carefully</p></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0"><PenLine className="h-4 w-4 text-amber-600" /></div>
                    <div><p className="font-medium text-sm">Step 2: Prepare ({formatTime(exercise?.preparation_time || 120)})</p><p className="text-xs text-muted-foreground">Take notes and organise your response</p></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0"><Mic className="h-4 w-4 text-red-600" /></div>
                    <div><p className="font-medium text-sm">Step 3: Record ({formatTime(exercise?.response_time || 120)})</p><p className="text-xs text-muted-foreground">Present your summary and counterargument</p></div>
                  </div>
                </div>

                <Button size="lg" onClick={startListening} className="mt-4 px-8">
                  <Headphones className="h-4 w-4 mr-2" /> Begin Listening
                </Button>
              </div>
            )}

            {/* LISTEN */}
            {stage === "listen" && (
              <div className="py-8 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mx-auto mb-4">
                    <Headphones className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Listen to the Argument</h2>
                  <p className="text-sm text-muted-foreground">Listen carefully and identify the main ideas, claim, and evidence.</p>
                </div>

                {/* Audio player or text display */}
                {exercise?.has_argument_audio && argAudioRef.current ? (
                  <div className="flex justify-center">
                    <Button size="lg" variant="outline" onClick={toggleArgAudio} className="gap-2">
                      {argPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      {argPlaying ? "Pause Audio" : "Play Audio"}
                    </Button>
                  </div>
                ) : null}

                {exercise?.argument_text && (
                  <div className="max-w-lg mx-auto p-5 rounded-lg bg-muted/50 border">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Argument Transcript</p>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{exercise.argument_text}</p>
                  </div>
                )}

                {exercise?.key_claim && (
                  <div className="max-w-lg mx-auto p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 uppercase">Key Claim</p>
                    <p className="text-sm font-medium leading-relaxed">{exercise.key_claim}</p>
                  </div>
                )}

                {/* Note-taking area */}
                <div className="max-w-lg mx-auto">
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">📝 Your Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={"Take notes here while reading the argument...\n\n• Context: ...\n• Main Claim: ...\n• Evidence 1: ...\n• Evidence 2: ...\n• Explanation: ..."}
                    className="w-full h-40 p-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">Read or listen to the argument above, then click below to begin your preparation time.</p>
                  <Button size="lg" onClick={finishListening} className="px-8">
                    <Clock className="h-4 w-4 mr-2" /> I'm Ready — Start Preparation Time
                  </Button>
                </div>
              </div>
            )}

            {/* PREPARE */}
            {stage === "prepare" && (
              <div className="py-8 space-y-6">
                <div className="text-center">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${prepTimeLeft <= 30 ? "bg-red-100 dark:bg-red-900/50" : "bg-amber-100 dark:bg-amber-900/50"}`}>
                    <span className={`text-3xl font-mono font-bold ${prepTimeLeft <= 30 ? "text-red-600" : "text-amber-600"}`}>
                      {formatTime(prepTimeLeft)}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold mb-2">Preparation Time</h2>
                  <p className="text-sm text-muted-foreground">Organise your summary and counterargument.</p>
                </div>

                {/* Show key claim for reference */}
                {exercise?.key_claim && (
                  <div className="max-w-lg mx-auto p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-semibold text-amber-600 mb-1">Key Claim to address:</p>
                    <p className="text-sm">{exercise.key_claim}</p>
                  </div>
                )}

                {/* Argument text for reference during preparation */}
                {exercise?.argument_text && (
                  <details className="max-w-lg mx-auto">
                    <summary className="text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> View Argument Text
                    </summary>
                    <div className="mt-2 p-3 rounded-lg bg-muted/50 border max-h-40 overflow-y-auto">
                      <p className="text-xs whitespace-pre-line leading-relaxed">{exercise.argument_text}</p>
                    </div>
                  </details>
                )}

                <div className="max-w-lg mx-auto">
                  <label className="text-xs font-semibold text-muted-foreground uppercase block mb-2">Your Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Summary points:&#10;- Context: ...&#10;- Claim: ...&#10;- Evidence: ...&#10;&#10;Counterargument:&#10;- ..."
                    className="w-full h-48 p-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-center gap-3">
                  <Button size="lg" onClick={startRecordingPhase}>
                    <Mic className="h-4 w-4 mr-2" /> Start Recording Now
                  </Button>
                </div>
              </div>
            )}

            {/* RECORD */}
            {stage === "record" && (
              <div className="py-6 space-y-4">
                <div className="text-center mb-2">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${recordTimeLeft <= 30 ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400" : "bg-muted"}`}>
                    <Clock className="h-4 w-4" />
                    <span className="font-mono font-bold text-lg">{formatTime(recordTimeLeft)}</span>
                    <span className="text-xs">remaining</span>
                  </div>
                </div>

                {/* Exercise materials for reference */}
                <details className="max-w-md mx-auto">
                  <summary className="text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> View Materials
                  </summary>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {exercise?.key_claim && (
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs font-semibold text-amber-600 mb-0.5">Key Claim</p>
                        <p className="text-xs">{exercise.key_claim}</p>
                      </div>
                    )}
                    {exercise?.argument_text && (
                      <div className="p-2 rounded-lg bg-muted/50 border">
                        <p className="text-xs font-semibold text-muted-foreground mb-0.5">Argument</p>
                        <p className="text-xs whitespace-pre-line leading-relaxed">{exercise.argument_text}</p>
                      </div>
                    )}
                    {exercise?.topic_context && (
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-semibold text-blue-600 mb-0.5">Topic Context</p>
                        <p className="text-xs">{exercise.topic_context}</p>
                      </div>
                    )}
                  </div>
                </details>

                {/* Show notes for reference */}
                {notes && (
                  <div className="max-w-md mx-auto p-3 rounded-lg bg-muted/50 border max-h-24 overflow-y-auto">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Your Notes</p>
                    <p className="text-xs whitespace-pre-line">{notes}</p>
                  </div>
                )}

                <AudioRecorder
                  state={recorder.state}
                  countdown={recorder.countdown}
                  duration={recorder.duration}
                  analyserNode={recorder.analyserNode}
                  onStart={recorder.startCountdown}
                  onStop={handleStopRecording}
                />

                {error && <p className="text-center text-sm text-destructive">{error}</p>}
              </div>
            )}

            {/* ANALYZING */}
            {stage === "analyzing" && (
              <div className="py-12 space-y-6 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <div className="max-w-xs mx-auto space-y-3">
                  {["Uploading audio...", "Transcribing speech...", "Evaluating summary & counterargument...", "Generating CRAA feedback..."].map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      <span className="text-sm text-muted-foreground">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
