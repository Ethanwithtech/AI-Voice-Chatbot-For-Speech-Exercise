import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { FileText } from "lucide-react"
import type { GrammarError, PronunciationIssue } from "@/types/practice"

interface TranscriptDisplayProps {
  transcript: string
  errors: GrammarError[]
  pronunciationIssues: PronunciationIssue[]
}

export function TranscriptDisplay({ transcript, errors, pronunciationIssues }: TranscriptDisplayProps) {
  const [hoveredWord, setHoveredWord] = useState<string | null>(null)

  const pronounceWords = new Set(pronunciationIssues.map(i => i.word.toLowerCase()))

  const words = transcript.split(/(\s+)/)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Transcription
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-4 rounded-lg bg-muted/50 leading-relaxed">
          {words.map((word, idx) => {
            if (/^\s+$/.test(word)) return <span key={idx}>{word}</span>

            const cleanWord = word.toLowerCase().replace(/[.,!?;:'"]/g, "")
            const isPronIssue = pronounceWords.has(cleanWord)
            const issue = pronunciationIssues.find(i => i.word.toLowerCase() === cleanWord)

            if (isPronIssue) {
              return (
                <span
                  key={idx}
                  className="relative inline-block cursor-pointer"
                  onMouseEnter={() => setHoveredWord(cleanWord)}
                  onMouseLeave={() => setHoveredWord(null)}
                >
                  <span className="border-b-2 border-red-500 text-red-600 dark:text-red-400 font-medium">
                    {word}
                  </span>
                  {hoveredWord === cleanWord && issue && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border rounded-lg shadow-lg text-xs whitespace-nowrap z-10">
                      <span className="font-semibold">Expected:</span> {issue.expected || "N/A"}
                    </span>
                  )}
                </span>
              )
            }

            return <span key={idx}>{word}</span>
          })}
        </div>

        {errors.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold">Grammar Issues</h4>
            {errors.map((err, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-sm">
                <p className="text-red-600 dark:text-red-400 line-through">{err.sentence}</p>
                <p className="text-green-600 dark:text-green-400 font-medium">{err.correction}</p>
                <p className="text-muted-foreground text-xs mt-1">{err.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
