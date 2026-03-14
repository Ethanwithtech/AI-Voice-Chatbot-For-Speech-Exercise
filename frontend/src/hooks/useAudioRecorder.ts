import { useState, useRef, useCallback, useEffect } from "react"
import { AudioRecorderUtil } from "@/lib/audio"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"

export type RecordingState = "idle" | "countdown" | "recording" | "stopped"

export function useAudioRecorder() {
  const [state, setState] = useState<RecordingState>("idle")
  const [countdown, setCountdown] = useState(3)
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  const recorderRef = useRef(new AudioRecorderUtil())
  const timerRef = useRef<number | null>(null)
  const countdownRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)

  const speechRecognition = useSpeechRecognition()

  const clearCountdownInterval = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const analyser = await recorderRef.current.start()
      setAnalyserNode(analyser)
      setState("recording")
      startTimeRef.current = Date.now()

      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000)
      }, 100)

      speechRecognition.start()
    } catch (err) {
      console.error("[AudioRecorder] Failed to start recording:", err)
      setState("idle")
      setAnalyserNode(null)
    }
  }, [speechRecognition.start])

  const startCountdown = useCallback(() => {
    setAudioBlob(null)
    setDuration(0)
    setState("countdown")
    setCountdown(3)
    clearCountdownInterval()

    let count = 3
    countdownRef.current = window.setInterval(() => {
      count -= 1
      if (count <= 0) {
        clearCountdownInterval()
        startRecording()
      } else {
        setCountdown(count)
      }
    }, 1000)
  }, [startRecording, clearCountdownInterval])

  const stopRecording = useCallback(() => {
    clearCountdownInterval()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const blob = recorderRef.current.stop()
    setAudioBlob(blob)
    setAnalyserNode(null)
    setState("stopped")

    speechRecognition.stop()
  }, [speechRecognition.stop, clearCountdownInterval])

  const reset = useCallback(() => {
    clearCountdownInterval()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setState("idle")
    setDuration(0)
    setAudioBlob(null)
    setAnalyserNode(null)
    speechRecognition.reset()
  }, [speechRecognition.reset, clearCountdownInterval])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
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
    transcript: speechRecognition.transcript,
    interimTranscript: speechRecognition.interimTranscript,
    isSpeechRecognitionSupported: speechRecognition.isSupported,
  }
}
