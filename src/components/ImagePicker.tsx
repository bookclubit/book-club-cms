import { useState } from 'react'
import { fileToWebP, type WebPOptions } from '../lib/image'
import { Field } from './ui'

// Выбор картинки: сразу конвертирует в WebP по правилам репозитория
// и показывает превью с итоговым размером.
export function ImagePicker({
  label,
  hint,
  opts,
  onChange,
}: {
  label: string
  hint?: string
  opts: WebPOptions
  onChange: (bytes: Uint8Array | null) => void
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
    try {
      const bytes = await fileToWebP(file, opts)
      // Копия среза — Blob не должен зависеть от возможного переиспользования буфера
      const blob = new Blob([bytes.slice()], { type: 'image/webp' })
      setPreview(URL.createObjectURL(blob))
      setSize(bytes.length)
      onChange(bytes)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPreview(null)
      setSize(null)
      onChange(null)
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-4">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => void handleFile(e.target.files?.[0])}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:border-ink/30"
        />
        {preview && (
          <div className="flex shrink-0 items-center gap-2">
            <img
              src={preview}
              alt="превью"
              className="h-14 w-14 rounded-lg border border-line object-cover"
            />
            {size !== null && (
              <span className="text-xs text-muted">{Math.round(size / 1024)}KB · WebP</span>
            )}
          </div>
        )}
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </Field>
  )
}
