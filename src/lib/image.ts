// Конвертация картинок в WebP прямо в браузере (canvas), по соглашениям
// book-club-data: обложки — ширина 400px с сохранением пропорций,
// аватарки — квадрат 400×400 с кропом cover; итог ≤200KB.

const MAX_BYTES = 200 * 1024

export interface WebPOptions {
  width: number
  height?: number // задана → квадрат/кроп cover; нет → пропорции сохраняются
}

async function renderToCanvas(
  file: File,
  opts: WebPOptions,
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  try {
    const targetW = Math.min(opts.width, bitmap.width)
    const targetH = opts.height
      ? Math.round((targetW / opts.width) * opts.height)
      : Math.round((targetW / bitmap.width) * bitmap.height)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D недоступен')
    ctx.imageSmoothingQuality = 'high'

    if (opts.height) {
      // cover: масштабируем по большей стороне и центрируем кроп
      const scale = Math.max(targetW / bitmap.width, targetH / bitmap.height)
      const w = bitmap.width * scale
      const h = bitmap.height * scale
      ctx.drawImage(bitmap, (targetW - w) / 2, (targetH - h) / 2, w, h)
    } else {
      ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    }
    return canvas
  } finally {
    bitmap.close()
  }
}

function canvasToWebP(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Браузер не поддерживает экспорт в WebP'))
          return
        }
        if (blob.type !== 'image/webp') {
          reject(new Error('Браузер не поддерживает экспорт в WebP — откройте CMS в Chrome/Edge'))
          return
        }
        resolve(blob)
      },
      'image/webp',
      quality,
    )
  })
}

export async function fileToWebP(file: File, opts: WebPOptions): Promise<Uint8Array> {
  const canvas = await renderToCanvas(file, opts)
  // Понижаем качество, пока не уложимся в лимит репозитория.
  for (const quality of [0.82, 0.72, 0.6, 0.45, 0.3]) {
    const blob = await canvasToWebP(canvas, quality)
    if (blob.size <= MAX_BYTES) {
      return new Uint8Array(await blob.arrayBuffer())
    }
  }
  throw new Error('Не удалось сжать картинку до 200KB — возьмите файл поменьше')
}

export const COVER_OPTS: WebPOptions = { width: 400 }
export const AVATAR_OPTS: WebPOptions = { width: 400, height: 400 }
// Доска обсуждения — скриншот, ширина до 1200px с сохранением пропорций.
export const BOARD_OPTS: WebPOptions = { width: 1200 }
