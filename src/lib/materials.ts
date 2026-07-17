// Доп. материалы встречи в формах: по одному на строку, «название | ссылка»
// (без разделителя — ссылка становится и названием).

import type { EventMaterial } from '../types'

export function parseMaterials(text: string): EventMaterial[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf('|')
      if (sep === -1) return { title: line, url: line }
      return {
        title: line.slice(0, sep).trim() || line.slice(sep + 1).trim(),
        url: line.slice(sep + 1).trim(),
      }
    })
    .filter((m) => m.url)
}

export function materialsToText(materials: EventMaterial[] | undefined): string {
  return (materials ?? [])
    .map((m) => (m.title && m.title !== m.url ? `${m.title} | ${m.url}` : m.url))
    .join('\n')
}
