import { useState, useRef, useCallback, useEffect } from "react"

interface SpeechRecognitionHook {
  isSupported: boolean
  isListening: boolean
  transcript: string
  interimTranscript: string
  start: () => void
  stop: () => void
  reset: () => void
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: { readonly transcript: string; readonly confidence: number }
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEventData {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEventData {
  error: string
  message?: string
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventData) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventData) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

function getSpeechRecognitionAPI(): SpeechRecognitionConstructor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const SpeechRecognitionAPI = getSpeechRecognitionAPI()
  const isSupported = SpeechRecognitionAPI !== null

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const finalTranscriptRef = useRef("")
  const interimTranscriptRef = useRef("")
  const stoppedManuallyRef = useRef(false)

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) return

    stoppedManuallyRef.current = false
    finalTranscriptRef.current = ""
    interimTranscriptRef.current = ""
    setTranscript("")
    setInterimTranscript("")

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: SpeechRecognitionEventData) => {
      let interim = ""
      let final = finalTranscriptRef.current

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript + " "
        } else {
          interim += result[0].transcript
        }
      }

      finalTranscriptRef.current = final
      interimTranscriptRef.current = interim
      setTranscript(final.trim())
      setInterimTranscript(interim)
    }

    const nonRecoverableErrors = new Set([
      "not-allowed", "service-not-allowed", "audio-capture", "language-not-supported",
    ])

    recognition.onerror = (event: SpeechRecognitionErrorEventData) => {
      if (event.error === "aborted" || event.error === "no-speech") return
      console.warn("[SpeechRecognition] error:", event.error)
      if (nonRecoverableErrors.has(event.error)) {
        stoppedManuallyRef.current = true
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript("")
      if (!stoppedManuallyRef.current) {
        try {
          recognition.start()
          setIsListening(true)
        } catch {
          // ignore
        }
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (e) {
      console.warn("[SpeechRecognition] start failed:", e)
    }
  }, [SpeechRecognitionAPI])

  const stop = useCallback(() => {
    stoppedManuallyRef.current = true

    if (interimTranscriptRef.current) {
      const merged = (finalTranscriptRef.current + interimTranscriptRef.current).trim()
      finalTranscriptRef.current = merged + " "
      setTranscript(merged)
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimTranscript("")
    interimTranscriptRef.current = ""
  }, [])

  const reset = useCallback(() => {
    stop()
    finalTranscriptRef.current = ""
    interimTranscriptRef.current = ""
    setTranscript("")
    setInterimTranscript("")
  }, [stop])

  useEffect(() => {
    return () => {
      stoppedManuallyRef.current = true
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [])

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    start,
    stop,
    reset,
  }
}
