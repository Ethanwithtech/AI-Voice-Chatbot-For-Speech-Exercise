export interface ProsodyMetrics {
  speech_rate: number
  articulation_rate: number
  pause_count: number
  mean_pause_duration: number
  long_pause_count: number
  f0_mean: number
  f0_std: number
  intonation_index: number
  total_speech_time: number
  total_duration: number
}

export interface PronunciationIssue {
  word: string
  expected?: string | null
  timestamp: number
  confidence: number
}

export interface GrammarError {
  sentence: string
  correction: string
  explanation: string
}

export interface AnalysisScores {
  overall: number
  grammar: number
  fluency: number
  pronunciation: number
  prosody: number
}

export interface AnalysisResult {
  transcript: string
  word_timestamps: Array<{ word: string; start: number; end: number }>
  prosody: ProsodyMetrics
  pronunciation_issues: PronunciationIssue[]
  is_read_aloud: boolean | null
  scores: AnalysisScores
  errors: GrammarError[]
  suggestions: string[]
  strengths: string[]
  areas_to_improve: string[]
  llm_feedback: string
  prosody_feedback: string
  pronunciation_feedback: string
}

export interface PracticeSession {
  id: number
  student_id: number
  exercise_id?: number | null
  transcript?: string | null
  duration_seconds?: number | null
  created_at?: string | null
  result?: Record<string, unknown> | null
  exercise_title?: string | null
}
