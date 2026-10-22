/**
 * Read-only transcript (paragraphs) or the raw textarea while editing.
 * The text is shown exactly as transcribed — no corrections are applied.
 */
export default function TranscriptView({ text, editing = false, draft = '', onChange }) {
  if (editing) {
    return (
      <textarea
        className="transcript-editor"
        aria-label="Edit transcript"
        value={draft}
        onChange={(event) => onChange?.(event.target.value)}
        rows={10}
        spellCheck={false}
      />
    )
  }

  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (!paragraphs.length) {
    return <p className="transcript-empty">No transcript yet.</p>
  }

  return (
    <div className="transcript">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  )
}
