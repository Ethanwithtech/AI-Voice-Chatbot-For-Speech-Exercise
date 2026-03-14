import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, Upload, CheckCircle, ArrowLeft, Brain, BookOpen, MessageSquare, HelpCircle } from "lucide-react"
import { api } from "@/lib/api"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { AudioRecorder } from "@/components/AudioRecorder"
import { TranscriptDisplay } from "@/components/TranscriptDisplay"
import { FeedbackPanel } from "@/components/FeedbackPanel"
import { ProsodyChart } from "@/components/ProsodyChart"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Exercise } from "@/types/exercise"
import type { AnalysisResult } from "@/types/practice"

type Stage = "select" | "record" | "analyzing" | "result"

const analyzeSteps = [
  { label: "Uploading audio...", icon: Upload },
  { label: "Transcribing speech...", icon: Loader2 },
  { label: "Analyzing voice features...", icon: Loader2 },
  { label: "Generating feedback...", icon: Loader2 },
]

const difficultyColors: Record<string, string> = {
  easy: "bg-green-500/15 text-green-700 dark:text-green-400",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  hard: "bg-red-500/15 text-red-700 dark:text-red-400",
}

const typeIcons: Record<string, React.ElementType> = {
  read_aloud: BookOpen,
  free_speech: MessageSquare,
  qa: HelpCircle,
  craa: Brain,
}

const typeLabels: Record<string, string> = {
  read_aloud: "Read Aloud",
  free_speech: "Free Speech",
  qa: "Q&A",
  craa: "CRAA",
}

function ExerciseGridCard({ exercise, onClick }: { exercise: Exercise; onClick: () => void }) {
  const Icon = typeIcons[exercise.exercise_type] ?? MessageSquare
  const isCRAA = exercise.exercise_type === "craa"

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-xl border border-border bg-card hover:border-primary/60 hover:shadow-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="p-5 flex flex-col h-full min-h-[200px]">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`p-2 rounded-lg ${isCRAA ? "bg-primary/10" : "bg-muted"}`}>
            <Icon className={`h-5 w-5 ${isCRAA ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${difficultyColors[exercise.difficulty] ?? "bg-muted text-muted-foreground"}`}>
              {exercise.difficulty}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${isCRAA ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              {typeLabels[exercise.exercise_type] ?? exercise.exercise_type}
            </span>
          </div>
        </div>

        <h3 className="font-semibold text-base leading-snug mb-2 group-hover:text-primary transition-colors">
          {exercise.title}
        </h3>

        <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
          {exercise.description}
        </p>

        {exercise.teacher_name && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            By {exercise.teacher_name}
          </p>
        )}
      </div>
    </button>
  )
}

export default function PracticePage() {
  const navigate = useNavigate()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [stage, setStage] = useState<Stage>("select")
  const [analyzeStep, setAnalyzeStep] = useState(0)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState("")

  const recorder = useAudioRecorder()

  useEffect(() => {
    api.get<Exercise[]>("/exercises/").then(setExercises).catch(console.error)
  }, [])

  const handleStartExercise = (exercise: Exercise) => {
    if (exercise.exercise_type === "craa") {
      navigate(`/craa-practice?exerciseId=${exercise.id}`)
      return
    }
    setSelectedExercise(exercise)
    setStage("record")
    setResult(null)
    setError("")
    recorder.reset()
  }

  const handleStartPractice = () => {
    if (selectedExercise?.exercise_type === "craa") {
      navigate(`/craa-practice?exerciseId=${selectedExercise.id}`)
      return
    }
    setStage("record")
    setResult(null)
    setError("")
    recorder.reset()
  }

  const handleStopAndAnalyze = async () => {
    recorder.stopRecording()
  }

  useEffect(() => {
    if (recorder.state === "stopped" && recorder.audioBlob) {
      submitAudio(recorder.audioBlob)
    }
  }, [recorder.state])

  const submitAudio = async (blob: Blob) => {
    setStage("analyzing")
    setAnalyzeStep(0)

    const formData = new FormData()
    formData.append("audio", blob, "recording.webm")
    if (selectedExercise) {
      formData.append("exercise_id", String(selectedExercise.id))
    }

    const stepInterval = setInterval(() => {
      setAnalyzeStep(prev => Math.min(prev + 1, analyzeSteps.length - 1))
    }, 2000)

    api.upload<AnalysisResult>("/practice/analyze", formData)
      .then(data => {
        clearInterval(stepInterval)
        setResult(data)
        setStage("result")
      })
      .catch(err => {
        clearInterval(stepInterval)
        setError(err.message)
        setStage("record")
      })
  }

  if (stage === "result" && result) {
    return (
      <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => { setStage("select"); recorder.reset() }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <h1 className="text-2xl font-bold">Practice Results</h1>
          </div>
          <div className="space-y-6">
            <TranscriptDisplay
              transcript={result.transcript}
              errors={result.errors}
              pronunciationIssues={result.pronunciation_issues}
            />
            <ProsodyChart metrics={result.prosody} />
            <FeedbackPanel
              scores={result.scores}
              llmFeedback={result.llm_feedback}
              prosodyFeedback={result.prosody_feedback}
              pronunciationFeedback={result.pronunciation_feedback}
              strengths={result.strengths}
              areasToImprove={result.areas_to_improve}
              suggestions={result.suggestions}
            />
            <div className="flex gap-3 justify-center">
              <Button onClick={handleStartPractice}>Practice Again</Button>
              <Button variant="outline" onClick={() => navigate("/")}>Back to Dashboard</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (stage === "record" || stage === "analyzing") {
    return (
      <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => { setStage("select"); recorder.reset() }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            {selectedExercise && <h1 className="text-xl font-bold">{selectedExercise.title}</h1>}
          </div>
          <Card>
            <CardContent className="p-6">
              {stage === "record" && (
                <AudioRecorder
                  state={recorder.state}
                  countdown={recorder.countdown}
                  duration={recorder.duration}
                  analyserNode={recorder.analyserNode}
                  onStart={recorder.startCountdown}
                  onStop={handleStopAndAnalyze}
                />
              )}
              {stage === "analyzing" && (
                <div className="py-12 space-y-6">
                  <div className="flex justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                  <div className="max-w-xs mx-auto space-y-3">
                    {analyzeSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        {idx < analyzeStep ? (
                          <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                        ) : idx === analyzeStep ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />
                        )}
                        <span className={`text-sm ${idx <= analyzeStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  {error && <p className="text-center text-sm text-destructive">{error}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg pt-20 pb-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Speech Practice</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Select an exercise to begin</p>
          </div>
        </div>

        {exercises.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {exercises.map(ex => (
              <ExerciseGridCard
                key={ex.id}
                exercise={ex}
                onClick={() => handleStartExercise(ex)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
