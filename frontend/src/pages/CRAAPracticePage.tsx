import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Brain, Headphones, Clock, Mic, CheckCircle, Loader2, Volume2, PlayCircle } from "lucide-react"
import { api } from "@/lib/api"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Exercise } from "@/types/exercise"

type Stage = "intro" | "listen" | "prepare" | "record" | "analyzing" | "result"

interface CRAAResult {
  session_id: number
  transcript: string
  transcription_source?: "client" | "server"
  overall_grade: number
  summary_score: number
  counterargument_score: number
  delivery_score: number
  overall_assessment: string
  summary_feedback: string
  counterargument_feedback: string
  delivery_feedback: string
  strengths: string[]
  areas_to_improve: string[]
  suggestions: string[]
}

function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    let videoId: string | null = null
    if (u.hostname.includes("youtu.be")) {
      videoId = u.pathname.slice(1)
    } else if (u.hostname.includes("youtube.com")) {
      videoId = u.searchParams.get("v")
    }
    if (!videoId) return null
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
  } catch {
    return null
  }
}

function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = seconds / total
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="absolute" width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="64" cy="64" r={radius} fill="none"
          stroke="hsl(var(--primary))" strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="text-center">
        <p className="text-3xl font-bold">{seconds}</p>
        <p className="text-xs text-muted-foreground">seconds</p>
      </div>
    </div>
  )
}

function ScoreDimension({ label, score, weight, feedback, color }: {
  label: string
  score: number
  weight: string
  feedback: string
  color: string
}) {
  const getGradeLabel = (s: number) => {
    if (s >= 85) return "Excellent"
    if (s >= 70) return "Good"
    if (s >= 55) return "Satisfactory"
    return "Needs Improvement"
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">{label}</h3>
            <p className="text-xs text-muted-foreground">{weight} of final grade</p>
          </div>
          <div className="text-right">
            <span className={`text-3xl font-bold ${color}`}>{score}</span>
            <p className={`text-xs font-medium ${color}`}>{getGradeLabel(score)}</p>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mb-3">
          <div className={`h-2 rounded-full transition-all duration-700 ${
            score >= 70 ? "bg-green-500" : score >= 55 ? "bg-amber-500" : "bg-red-500"
          }`} style={{ width: `${score}%` }} />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{feedback}</p>
      </CardContent>
    </Card>
  )
}

export default function CRAAPracticePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const exerciseId = searchParams.get("exerciseId")

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [stage, setStage] = useState<Stage>("intro")
  const [prepCountdown, setPrepCountdown] = useState(0)
  const [recCountdown, setRecCountdown] = useState(0)
  const [result, setResult] = useState<CRAAResult | null>(null)
  const [error, setError] = useState("")

  // Audio playback state for the listen stage
  const [audioStatus, setAudioStatus] = useState<"idle" | "loading" | "playing-narration" | "playing-argument" | "done">("idle")
  const [audioError, setAudioError] = useState("")
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null)
  const argumentAudioRef = useRef<HTMLAudioElement | null>(null)

  const recorder = useAudioRecorder()

  useEffect(() => {
    if (!exerciseId) {
      navigate("/practice")
      return
    }
    api.get<Exercise>(`/exercises/${exerciseId}`)
      .then(ex => {
        if (ex.exercise_type !== "craa") {
          navigate("/practice")
          return
        }
        setExercise(ex)
        setPrepCountdown(ex.preparation_time ?? 120)
        setRecCountdown(ex.response_time ?? 120)
      })
      .catch(() => navigate("/practice"))
  }, [exerciseId])

  const fetchAudioBlob = useCallback(async (url: string): Promise<HTMLAudioElement> => {
    const token = localStorage.getItem("token")
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error("Audio unavailable")
    const blob = await res.blob()
    return new Audio(URL.createObjectURL(blob))
  }, [])

  const playArgumentAudio = useCallback((audioEl: HTMLAudioElement) => {
    argumentAudioRef.current = audioEl
    audioEl.addEventListener("ended", () => setAudioStatus("done"))
    setAudioStatus("playing-argument")
    audioEl.play().catch(() => setAudioStatus("done"))
  }, [])

  const startListening = useCallback(async () => {
    if (!exerciseId || !exercise) return
    setAudioStatus("loading")
    setAudioError("")
    try {
      if (exercise.has_narration_audio) {
        const narrationEl = await fetchAudioBlob(`/api/exercises/${exerciseId}/narration-audio`)
        narrationAudioRef.current = narrationEl
        if (exercise.has_argument_audio) {
          const argumentEl = await fetchAudioBlob(`/api/exercises/${exerciseId}/argument-audio`)
          narrationEl.addEventListener("ended", () => playArgumentAudio(argumentEl))
        } else {
          narrationEl.addEventListener("ended", () => setAudioStatus("done"))
        }
        setAudioStatus("playing-narration")
        narrationEl.play().catch(() => setAudioStatus("done"))
      } else if (exercise.has_argument_audio) {
        const argumentEl = await fetchAudioBlob(`/api/exercises/${exerciseId}/argument-audio`)
        playArgumentAudio(argumentEl)
      } else {
        setAudioStatus("done")
      }
    } catch {
      setAudioError("Could not load audio. You may still read the argument text below.")
      setAudioStatus("done")
    }
  }, [exerciseId, exercise, fetchAudioBlob, playArgumentAudio])

  const replayAudio = useCallback(() => {
    narrationAudioRef.current?.pause()
    argumentAudioRef.current?.pause()
    narrationAudioRef.current = null
    argumentAudioRef.current = null
    startListening()
  }, [startListening])

  // Auto-start audio when entering listen stage
  useEffect(() => {
    if (stage === "listen" && audioStatus === "idle") {
      startListening()
    }
  }, [stage])

  // Countdown timer for prepare stage
  useEffect(() => {
    if (stage !== "prepare") return
    if (prepCountdown <= 0) {
      setStage("record")
      recorder.reset()
      recorder.startCountdown()
      return
    }
    const timer = setTimeout(() => setPrepCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [stage, prepCountdown])

  // Countdown timer for record stage
  useEffect(() => {
    if (stage !== "record") return
    if (recorder.state !== "recording") return
    if (recCountdown <= 0) {
      recorder.stopRecording()
      return
    }
    const timer = setTimeout(() => setRecCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [stage, recorder.state, recCountdown])

  useEffect(() => {
    if (recorder.state === "stopped" && recorder.audioBlob && stage === "record") {
      submitCRAAResponse(recorder.audioBlob, recorder.transcript)
    }
  }, [recorder.state])

  const submitCRAAResponse = async (blob: Blob, transcript?: string) => {
    setStage("analyzing")
    setError("")
    const formData = new FormData()
    formData.append("audio", blob, "craa_response.webm")
    formData.append("exercise_id", exerciseId!)
    if (transcript) {
      formData.append("transcript", transcript)
    }

    try {
      const data = await api.upload<CRAAResult>("/practice/craa-analyze", formData)
      setResult(data)
      setStage("result")
    } catch (err: any) {
      setError(err.message || "Analysis failed")
      setStage("record")
    }
  }

  const getScoreColor = (s: number) =>
    s >= 70 ? "text-green-600" : s >= 55 ? "text-amber-600" : "text-red-600"

  if (!exercise) {
    return (
      <div className="min-h-screen gradient-bg pt-20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/practice")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">CRAA Practice</h1>
            <Badge variant="default">CRAA</Badge>
          </div>
        </div>

        {/* INTRO */}
        {stage === "intro" && (
          <div className="space-y-5">

            {/* Exercise title + description */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-xl font-bold leading-tight">{exercise.title}</h2>
                  <Badge variant="default" className="shrink-0">CRAA</Badge>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{exercise.description}</p>

                {exercise.topic_context && (
                  <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase mb-1">Topic Context</p>
                    <p className="text-sm leading-relaxed">{exercise.topic_context}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Optional background video */}
            {exercise.video_url && (() => {
              const embedUrl = getYouTubeEmbedUrl(exercise.video_url)
              return embedUrl ? (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <PlayCircle className="h-4 w-4 text-red-500" />
                      <h3 className="font-semibold text-sm">Background Video</h3>
                    </div>
                    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                      <iframe
                        className="absolute inset-0 w-full h-full rounded-lg"
                        src={embedUrl}
                        title="Background video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </CardContent>
                </Card>
              ) : null
            })()}

            {/* Assessment steps */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-base mb-4">How this assessment works</h3>
                <div className="space-y-4">

                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="shrink-0 flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                        1
                      </div>
                      <div className="w-px flex-1 bg-border mt-2" />
                    </div>
                    <div className="pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Headphones className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold">Listening</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          2 min
                        </span>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>You will hear an audio clip with background information and one argument</li>
                        <li>You may take notes while listening</li>
                        <li>The clip is played once — listen carefully</li>
                      </ul>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4">
                    <div className="shrink-0 flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                        2
                      </div>
                      <div className="w-px flex-1 bg-border mt-2" />
                    </div>
                    <div className="pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold">Preparation</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {Math.round((exercise.preparation_time ?? 120) / 60)} min
                        </span>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Organise your notes and plan your summary</li>
                        <li>Develop a counterargument with evidence and logical reasoning</li>
                        <li>Recording does not start until you are ready</li>
                      </ul>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4">
                    <div className="shrink-0">
                      <div className="w-9 h-9 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 flex items-center justify-center font-bold text-sm">
                        3
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Mic className="h-4 w-4 text-green-500" />
                        <span className="font-semibold">Critical Response</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {Math.round((exercise.response_time ?? 120) / 60)} min
                        </span>
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Summarise the argument (claim, evidence, explanation)</li>
                        <li>State your counterargument with supporting evidence</li>
                        <li>Conclude by reiterating your main points</li>
                      </ul>
                      <div className="mt-2 p-3 rounded-lg bg-muted/60 text-xs text-muted-foreground">
                        Tip: Aim for ~1 minute on the summary and ~1 minute on your counterargument and conclusion
                      </div>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* Scoring breakdown */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-base mb-4">How you will be scored</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Summary Accuracy</p>
                      <p className="text-xs text-muted-foreground">Accurately restating the claim, evidence, and explanation from the audio</p>
                    </div>
                    <span className="text-lg font-bold text-primary shrink-0 ml-4">40%</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Counterargument Quality</p>
                      <p className="text-xs text-muted-foreground">Strength, relevance, and logical support of your counterargument</p>
                    </div>
                    <span className="text-lg font-bold text-primary shrink-0 ml-4">30%</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Verbal Delivery</p>
                      <p className="text-xs text-muted-foreground">Pronunciation, fluency, pace, and clarity of speech</p>
                    </div>
                    <span className="text-lg font-bold text-primary shrink-0 ml-4">30%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button size="lg" className="w-full" onClick={() => setStage("listen")}>
              <Headphones className="h-4 w-4 mr-2" /> I'm Ready — Start Listening
            </Button>
          </div>
        )}

        {/* LISTEN */}
        {stage === "listen" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-bold mb-1">Listening Stage</h2>
                  <p className="text-sm text-muted-foreground">The audio is played once. Take notes as you listen.</p>
                </div>

                {/* Audio playback status */}
                <div className="rounded-xl border border-border bg-muted/40 p-5 space-y-4">
                  {audioStatus === "loading" && (
                    <div className="flex items-center justify-center gap-3 py-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm font-medium">Loading audio...</span>
                    </div>
                  )}

                  {(audioStatus === "playing-narration" || audioStatus === "playing-argument" || audioStatus === "done") && (
                    <div className="space-y-3">
                      {/* Clip 1 row */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          audioStatus === "playing-narration"
                            ? "bg-primary text-primary-foreground"
                            : "bg-green-500/15 text-green-600 dark:text-green-400"
                        }`}>
                          {audioStatus === "playing-narration"
                            ? <Volume2 className="h-4 w-4 animate-pulse" />
                            : <CheckCircle className="h-4 w-4" />
                          }
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${audioStatus === "playing-narration" ? "text-foreground" : "text-muted-foreground"}`}>
                            Part 1: Background Information
                          </p>
                          {audioStatus === "playing-narration" && (
                            <p className="text-xs text-primary font-medium mt-0.5">Now playing...</p>
                          )}
                        </div>
                      </div>

                      {/* Clip 2 row */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          audioStatus === "playing-argument"
                            ? "bg-primary text-primary-foreground"
                            : audioStatus === "done"
                            ? "bg-green-500/15 text-green-600 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {audioStatus === "playing-argument"
                            ? <Volume2 className="h-4 w-4 animate-pulse" />
                            : audioStatus === "done"
                            ? <CheckCircle className="h-4 w-4" />
                            : <span className="text-xs font-bold">2</span>
                          }
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            audioStatus === "playing-argument" ? "text-foreground"
                            : audioStatus === "done" ? "text-muted-foreground"
                            : "text-muted-foreground opacity-50"
                          }`}>
                            Part 2: The Argument
                          </p>
                          {audioStatus === "playing-argument" && (
                            <p className="text-xs text-primary font-medium mt-0.5">Now playing...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {audioError && (
                    <p className="text-xs text-destructive text-center">{audioError}</p>
                  )}

                  {audioStatus === "done" && (
                    <div className="text-center pt-1">
                      <button
                        onClick={replayAudio}
                        className="text-xs text-primary underline underline-offset-2 hover:no-underline"
                      >
                        Replay audio
                      </button>
                    </div>
                  )}
                </div>

                {/* Argument text (visible once audio is done or if no audio) */}
                {exercise.argument_text && audioStatus === "done" && (
                  <div className="text-left p-4 rounded-lg bg-muted/50 max-h-56 overflow-y-auto">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Argument (for reference)</p>
                    <p className="text-sm leading-relaxed">{exercise.argument_text}</p>
                  </div>
                )}

                <Button
                  size="lg"
                  className="w-full"
                  disabled={audioStatus !== "done"}
                  onClick={() => {
                    narrationAudioRef.current?.pause()
                    argumentAudioRef.current?.pause()
                    setPrepCountdown(exercise.preparation_time ?? 120)
                    setStage("prepare")
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {audioStatus === "done" ? "I'm Ready — Start Preparation Time" : "Waiting for audio to finish..."}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* PREPARE */}
        {stage === "prepare" && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <h2 className="text-xl font-bold">Preparation Time</h2>
              <p className="text-muted-foreground">Use this time to organise your thoughts. Recording will begin automatically.</p>
              <CountdownRing seconds={prepCountdown} total={exercise.preparation_time ?? 120} />
              <div className="text-left p-4 rounded-lg bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Key Claim to Respond To</p>
                <p className="text-sm font-medium">"{exercise.key_claim}"</p>
              </div>
              <p className="text-sm text-muted-foreground">Tip: Plan to briefly <strong>summarize</strong> the argument, then provide your <strong>counterargument</strong>.</p>
            </CardContent>
          </Card>
        )}

        {/* RECORD */}
        {stage === "record" && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <h2 className="text-xl font-bold">Recording Your Response</h2>
              <CountdownRing seconds={recCountdown} total={exercise.response_time ?? 120} />
              {!recorder.isSpeechRecognitionSupported && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm">
                  <span>Live transcription is not supported in this browser. Please use Chrome or Edge for the best experience.</span>
                </div>
              )}
              {recorder.state === "idle" || recorder.state === "countdown" ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-muted-foreground">Starting microphone...</p>
                </div>
              ) : recorder.state === "recording" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-medium text-red-500">Recording</span>
                  </div>
                  {recorder.interimTranscript && (
                    <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground italic truncate">{recorder.interimTranscript}</p>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Speak clearly. Recording stops automatically when time runs out.</p>
                  <Button variant="destructive" onClick={() => recorder.stopRecording()}>
                    Stop Recording Early
                  </Button>
                </div>
              ) : null}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        )}

        {/* ANALYZING */}
        {stage === "analyzing" && (
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <Brain className="h-12 w-12 mx-auto text-primary animate-pulse" />
              <h2 className="text-xl font-bold">Analyzing Your Response</h2>
              <div className="space-y-3 max-w-xs mx-auto text-left">
                {[
                  "Transcribing speech...",
                  "Evaluating summary accuracy...",
                  "Assessing counterargument...",
                  "Scoring verbal delivery...",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    <span className="text-sm text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* RESULT */}
        {stage === "result" && result && (
          <div className="space-y-6">
            {result.transcription_source === "server" && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm">
                <span>Transcription was performed server-side because browser speech recognition was not available.</span>
              </div>
            )}
            <Card>
              <CardContent className="p-6 text-center">
                <Brain className="h-10 w-10 mx-auto text-primary mb-3" />
                <h2 className="text-xl font-bold mb-1">CRAA Assessment</h2>
                <p className="text-muted-foreground text-sm mb-4">{exercise.title}</p>
                <div className="text-6xl font-bold mb-1">
                  <span className={getScoreColor(result.overall_grade)}>{Math.round(result.overall_grade)}</span>
                  <span className="text-xl text-muted-foreground">/100</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Overall Grade</p>
                <div className="flex justify-center gap-6 text-center">
                  <div>
                    <p className={`text-2xl font-bold ${getScoreColor(result.summary_score)}`}>{result.summary_score}</p>
                    <p className="text-xs text-muted-foreground">Summary (40%)</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${getScoreColor(result.counterargument_score)}`}>{result.counterargument_score}</p>
                    <p className="text-xs text-muted-foreground">Counter (30%)</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${getScoreColor(result.delivery_score)}`}>{result.delivery_score}</p>
                    <p className="text-xs text-muted-foreground">Delivery (30%)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-2">Overall Assessment</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{result.overall_assessment}</p>
              </CardContent>
            </Card>

            <ScoreDimension
              label="Summary Accuracy"
              score={result.summary_score}
              weight="40%"
              feedback={result.summary_feedback}
              color={getScoreColor(result.summary_score)}
            />
            <ScoreDimension
              label="Counterargument Quality"
              score={result.counterargument_score}
              weight="30%"
              feedback={result.counterargument_feedback}
              color={getScoreColor(result.counterargument_score)}
            />
            <ScoreDimension
              label="Verbal Delivery"
              score={result.delivery_score}
              weight="30%"
              feedback={result.delivery_feedback}
              color={getScoreColor(result.delivery_score)}
            />

            {result.strengths.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-green-600 mb-3">Strengths</h3>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm"><CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />{s}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {result.areas_to_improve.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-3">Areas to Improve</h3>
                  <ul className="space-y-1">
                    {result.areas_to_improve.map((a, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {a}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {result.suggestions.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-3">Suggestions</h3>
                  <ul className="space-y-1">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {s}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {result.transcript && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-2">Your Response (Transcript)</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">"{result.transcript}"</p>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3 justify-center">
              <Button onClick={() => {
                setPrepCountdown(exercise.preparation_time ?? 120)
                setRecCountdown(exercise.response_time ?? 120)
                setResult(null)
                setError("")
                recorder.reset()
                setStage("intro")
              }}>Try Again</Button>
              <Button variant="outline" onClick={() => navigate("/practice")}>Back to Practice</Button>
              <Button variant="outline" onClick={() => navigate("/history")}>View History</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
