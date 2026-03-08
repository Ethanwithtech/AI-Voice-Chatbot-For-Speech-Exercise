import { useState, useRef, useCallback, useEffect } from "react"
import { AudioRecorderUtil } from "@/lib/audio"

export type RecordingState = "idle" | "countdown" | "recording" | "stopped"

export function useAudioRecorder() {
  const [state, setState] = useState<RecordingState>("idle")
  const [countdown, setCountdown] = useState(3)
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  const recorderRef = useRef(new AudioRecorderUtil())
  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)

  const startCountdown = useCallback(() => {
    setAudioBlob(null)
    setDuration(0)
    setState("countdown")
    setCountdown(3)

    let count = 3
    const interval = setInterval(() => {
      count -= 1
      if (count <= 0) {
        clearInterval(interval)
        startRecording()
      } else {
        setCountdown(count)
      }
    }, 1000)
  }, [])

  const startRecording = useCallback(async () => {
    const analyser = await recorderRef.current.start()
    setAnalyserNode(analyser)
    setState("recording")
    startTimeRef.current = Date.now()

    timerRef.current = window.setInterval(() => {
      setDuration((Date.now() - startTimeRef.current) / 1000)
    }, 100)
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const blob = recorderRef.current.stop()
    setAudioBlob(blob)
    setAnalyserNode(null)
    setState("stopped")
  }, [])

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setState("idle")
    setDuration(0)
    setAudioBlob(null)
    setAnalyserNode(null)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return {
    state,
    countdown,
    duration,
    audioBlob,
    analyserNode,
    startCountdown,
    stopRecording,
    reset,
  }
}
