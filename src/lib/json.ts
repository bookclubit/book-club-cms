// JSON в стиле book-club-data — так же, как его печатает prettier.
//
// `JSON.stringify(value, null, 2)` этого не даёт: он всегда разворачивает
// массивы, а prettier короткие массивы собирает в одну строку. Из-за
// расхождения `prettier --check` в проверке pull request-а падал на каждом
// файле с коротким массивом (`topic_ids` встречи №113, июль 2026).
//
// Повторяем правила prettier для JSON:
//   • отступ 2 пробела, перевод строки в конце файла;
//   • объекты всегда многострочные (prettier сохраняет наш перевод строки
//     после `{`), пустой — `{}`;
//   • массив собирается в строку, если влезает в 80 колонок вместе с запятой;
//   • массив из двух и более «толстых» объектов/массивов разворачивается
//     всегда, даже если влезает, — так решает сам prettier.

const WIDTH = 80
const STEP = 2

export function toJSON(value: unknown): string {
  return print(value, 0, 0, '') + '\n'
}

type Block = Record<string, unknown> | unknown[]

function isBlock(value: unknown): value is Block {
  return typeof value === 'object' && value !== null
}

// Пары объекта без ключей со значением undefined — их не печатает и JSON.stringify.
function entriesOf(value: Record<string, unknown>): [string, unknown][] {
  return Object.entries(value).filter(([, v]) => v !== undefined)
}

function fat(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 1
  if (isBlock(value)) return entriesOf(value as Record<string, unknown>).length > 1
  return false
}

/**
 * @param indent отступ строки, на которой начинается значение
 * @param column колонка, с которой значение начинается (отступ + `"ключ": `)
 * @param suffix что встанет за значением на той же строке (запятая) — prettier
 *   учитывает это, решая, влезает ли значение в строку
 */
function print(value: unknown, indent: number, column: number, suffix: string): string {
  if (!isBlock(value)) return JSON.stringify(value) ?? 'null'

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const breakAll =
      value.length > 1 &&
      (value.every((v) => !Array.isArray(v) && isBlock(v) && fat(v)) ||
        value.every((v) => Array.isArray(v) && fat(v)))
    if (!breakAll) {
      const line = `[${value.map(inline).join(', ')}]`
      if (column + line.length + suffix.length <= WIDTH) return line
    }
    const inner = indent + STEP
    const items = value.map((item, i) =>
      ' '.repeat(inner) + print(item, inner, inner, i < value.length - 1 ? ',' : ''),
    )
    return `[\n${items.join(',\n')}\n${' '.repeat(indent)}]`
  }

  const entries = entriesOf(value as Record<string, unknown>)
  if (entries.length === 0) return '{}'
  const inner = indent + STEP
  const lines = entries.map(([key, v], i) => {
    const head = `${' '.repeat(inner)}${JSON.stringify(key)}: `
    const last = i === entries.length - 1
    return head + print(v, inner, head.length, last ? '' : ',')
  })
  return `{\n${lines.join(',\n')}\n${' '.repeat(indent)}}`
}

// Значение одной строкой — для проверки, влезает ли массив в строку.
function inline(value: unknown): string {
  if (!isBlock(value)) return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`
  const entries = entriesOf(value as Record<string, unknown>)
  if (entries.length === 0) return '{}'
  return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')} }`
}
