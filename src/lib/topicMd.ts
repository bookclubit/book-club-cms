// Сборка .md-файла темы. Frontmatter — плоский YAML в точности под
// самописный парсер miniapp (src/lib/markdown.ts): строки без кавычек,
// пустые строки как "", пустые списки как [], элементы списков — "  - значение".

export interface TopicDraft {
  id: string
  title: string
  order: number
  videoYoutube: string
  videoVk: string
  presentation: string
  resources: string[]
  speakers: string[]
  description: string
  insights: string[]
  speakerOpinions: Array<{ speaker: string; text: string }>
}

function yamlValue(value: string): string {
  return value === '' ? '""' : value
}

function yamlList(key: string, items: string[]): string {
  const filled = items.map((s) => s.trim()).filter(Boolean)
  if (filled.length === 0) return `${key}: []`
  return `${key}:\n${filled.map((s) => `  - ${s}`).join('\n')}`
}

export function buildTopicMarkdown(draft: TopicDraft): string {
  const frontmatter = [
    `id: ${draft.id}`,
    `title: ${draft.title.trim()}`,
    `order: ${draft.order}`,
    `video_youtube: ${yamlValue(draft.videoYoutube.trim())}`,
    `video_vk: ${yamlValue(draft.videoVk.trim())}`,
    `presentation: ${yamlValue(draft.presentation.trim())}`,
    yamlList('resources', draft.resources),
    yamlList('speakers', draft.speakers),
  ].join('\n')

  const sections: string[] = []
  sections.push(`## Краткое описание\n\n${draft.description.trim()}`)

  const insights = draft.insights.map((s) => s.trim()).filter(Boolean)
  if (insights.length > 0) {
    sections.push(`## Инсайты\n\n${insights.map((s) => `- ${s}`).join('\n')}`)
  }

  const opinions = draft.speakerOpinions.filter((o) => o.text.trim())
  if (opinions.length > 0) {
    sections.push(
      `## Мнение спикера\n\n${opinions
        .map((o) => `**${o.speaker.trim()}:** ${o.text.trim()}`)
        .join('\n\n')}`,
    )
  }

  return `---\n${frontmatter}\n---\n\n${sections.join('\n\n')}\n`
}
