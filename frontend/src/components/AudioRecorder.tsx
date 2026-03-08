import { useEffect, useRef } from "react"
import { Mic, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDuration } from "@/lib/audio"
import { type RecordingState } from "@/hooks/useAudioRecorder"

interface AudioRecorderProps {
  state: RecordingState
  countdown: number
  duration: number
  analyserNode: AnalyserNode | null
  onStart: () => void
  onStop: () => void
}

export function AudioRecorder({
  state, countdown, duration, analyserNode, onStart, onStop,
}: AudioRecorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    if (state !== "recording" || !analyserNode || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw)
      analyserNode.getByteFrequencyData(dataArray)

      ctx.fillStyle = "rgba(15, 23, 42, 0.1)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight)
        gradient.addColorStop(0, "#3B82F6")
        gradient.addColorStop(1, "#8B5CF6")
        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight)
        x += barWidth + 1
      }
    }

    draw()
    return () => cancelAnimationFrame(animationRef.current)
  }, [state, analyserNode])

  if (state === "countdown") {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-6xl font-bold text-primary animate-countdown" key={countdown}>
              {countdown}
            </span>
          </div>
          <div className="absolute inset-0 w-32 h-32 rounded-full border-4 border-primary/30 animate-pulse-ring" />
        </div>
        <p className="mt-6 text-muted-foreground font-medium">Get ready to speak...</p>
      </div>
    )
  }

  if (state === "recording") {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-6">
        <div className="relative">
          <button
            onClick={onStop}
            className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-all cursor-pointer active:scale-95"
          >
            <Square className="h-8 w-8 text-white fill-white" />
          </button>
          <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-red-400/50 animate-pulse-ring" />
        </div>

        <div className="text-center">
          <p className="text-3xl font-mono font-bold text-foreground">{formatDuration(duration)}</p>
          <p className="text-sm text-red-500 font-medium mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording
          </p>
        </div>

        <canvas
          ref={canvasRef}
          width={400}
          height={100}
          className="w-full max-w-md rounded-lg bg-slate-950/5 dark:bg-slate-950/50"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <button
        onClick={onStart}
        className="w-28 h-28 rounded-full gradient-primary flex items-center justify-center shadow-xl hover:shadow-2xl transition-all cursor-pointer hover:scale-105 active:scale-95"
      >
        <Mic className="h-10 w-10 text-white" />
      </button>
      <p className="text-muted-foreground font-medium">Click to start recording</p>
    </div>
  )
}
