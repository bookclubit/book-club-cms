// Транслитерация и slug-и по соглашениям book-club-data:
// всё kebab-case, русский транслитерируется («введение» → vvedenie,
// «жизненный цикл контейнера» → zhiznennyy-cikl-konteynera).

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
}

export function translit(text: string): string {
  return [...text.toLowerCase()]
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('')
}

export function slugify(text: string): string {
  return translit(text)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Префикс порядкового номера: 1 → "01", 12 → "12".
export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Номер карточки: 1 → "001".
export function pad3(n: number): string {
  return String(n).padStart(3, '0')
}
