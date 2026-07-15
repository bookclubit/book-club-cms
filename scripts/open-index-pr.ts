// Первичная публикация единого реестра index.json в book-club-data.
// Собирает реестр обходом репозитория и открывает PR тем же движком,
// которым пользуются формы CMS (заодно проверяет его end-to-end).
//
// Запуск: GITHUB_TOKEN=<token> npm run open-index-pr

import { openContentPR, toJSON } from '../src/lib/pr'
import { buildIndexFromRepo, dataClient } from '../src/lib/repo'

const token = process.env.GITHUB_TOKEN
if (!token) {
  console.error('Нужен GITHUB_TOKEN в окружении')
  process.exit(1)
}

const gh = dataClient(token)
const index = await buildIndexFromRepo(gh)

// Имена и алиасы известных спикеров: в .md-темах они указаны по имени.
for (const speaker of index.speakers) {
  if (speaker.id === 'pomazkov-anton') {
    speaker.name = 'Антон Помазков'
    speaker.aliases = ['Антон', 'Антон Помазков']
  }
  if (speaker.id === 'nikiforov-artem') {
    speaker.name = 'Артём Никифоров'
    speaker.aliases = ['Артём', 'Артём Никифоров']
  }
}

console.log('Собранный реестр:')
console.log(toJSON(index))

const result = await openContentPR(gh, {
  branch: 'cms/content-index',
  title: 'feat: единый реестр контента index.json',
  body: [
    'Единый реестр контента репозитория: книги (+папки, id, главы), события и спикеры.',
    '',
    '**Зачем:** `raw.githubusercontent.com` не листает директории, поэтому miniapp и бот держали списки контента захардкоженными (`BOOK_IDS`, `CHAPTER_SLUGS`, `EVENT_FILES`, `SPEAKERS` в `api.ts`). Теперь потребители читают `index.json`, а [Codex CMS](https://github.com/bookclubit/book-club-cms) обновляет его автоматически в каждом PR с контентом.',
    '',
    'Поле `active_book` — книга, которую клуб читает сейчас (для бота карточек).',
    '',
    '_Создано через Codex CMS._',
  ].join('\n'),
  files: [{ path: 'index.json', content: toJSON(index) }],
})

console.log(`PR открыт: ${result.url} (ветка ${result.branch})`)
