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

// Обратный парсинг .md темы в черновик формы (для редактирования).
// Терпим к рукописным файлам: незнакомые ключи игнорируются, отсутствующие
// секции дают пустые значения.
export function parseTopicMarkdown(md: string): TopicDraft | null {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return null
  const [, frontmatter, body] = match

  const scalars: Record<string, string> = {}
  const lists: Record<string, string[]> = {}
  let openList: string[] | null = null
  for (const rawLine of frontmatter.split(/\r?\n/)) {
    const item = rawLine.match(/^\s+-\s+(.*)$/)
    if (item && openList) {
      openList.push(item[1].trim())
      continue
    }
    const kv = rawLine.match(/^([a-z_]+):\s*(.*)$/)
    if (!kv) continue
    const [, key, raw] = kv
    if (raw === '') {
      openList = []
      lists[key] = openList
      continue
    }
    openList = null
    if (raw === '[]') lists[key] = []
    else scalars[key] = raw === '""' ? '' : raw.trim()
  }

  const sections = new Map<string, string>()
  for (const chunk of `\n${body.trim()}`.split(/\r?\n## /).slice(1)) {
    const nl = chunk.indexOf('\n')
    if (nl === -1) sections.set(chunk.trim(), '')
    else sections.set(chunk.slice(0, nl).trim(), chunk.slice(nl + 1).trim())
  }

  const insights = (sections.get('Инсайты') ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^-\s+/, '').trim())
    .filter(Boolean)

  const speakerOpinions = (sections.get('Мнение спикера') ?? '')
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim().match(/^\*\*(.+?):\*\*\s*([\s\S]*)$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ speaker: m[1].trim(), text: m[2].trim() }))

  return {
    id: scalars.id ?? '',
    title: scalars.title ?? '',
    order: Number(scalars.order) > 0 ? Number(scalars.order) : 1,
    videoYoutube: scalars.video_youtube ?? '',
    videoVk: scalars.video_vk ?? '',
    presentation: scalars.presentation ?? '',
    resources: lists.resources ?? [],
    speakers: lists.speakers ?? [],
    description: sections.get('Краткое описание') ?? '',
    insights,
    speakerOpinions,
  }
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
