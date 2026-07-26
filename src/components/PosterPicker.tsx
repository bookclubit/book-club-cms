import { useState } from 'react'
import { Field } from './ui'

/** Telegram принимает фото до 10 МБ. */
const MAX_BYTES = 10 * 1024 * 1024

export interface Poster {
  bytes: Uint8Array
  name: string
}

/**
 * Афиша для поста в Telegram. В отличие от ImagePicker не конвертирует в WebP:
 * афиша не попадает в репозиторий, а уходит в Telegram, который надёжно
 * работает с JPEG/PNG. Держим файл как есть.
 */
export function PosterPicker({
  label,
  hint,
  onChange,
}: {
  label: string
  hint?: string
  onChange: (poster: Poster | null) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [size, setSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    setError(null)
    if (!file) {
      setPreview(null)
      setSize(null)
      onChange(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`Файл ${(file.size / 1024 / 1024).toFixed(1)} МБ — Telegram примет до 10 МБ`)
      setPreview(null)
      setSize(null)
      onChange(null)
      return
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    setPreview(URL.createObjectURL(file))
    setSize(bytes.length)
    onChange({ bytes, name: file.name })
  }

  return (
    <Field
      label={label}
      hint={size !== null ? `${Math.round(size / 1024)} КБ` : hint}
      error={error ?? undefined}
    >
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void handleFile(e.target.files?.[0])}
          className="block w-full text-[13px] text-ink-soft file:mr-3 file:rounded-control file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[13px] file:font-medium file:text-ink hover:file:border-line-strong"
        />
        {preview ? (
          <img
            src={preview}
            alt=""
            className="h-12 w-20 shrink-0 rounded-control border border-line object-cover"
          />
        ) : null}
      </div>
    </Field>
  )
}
