# CMS Книжного клуба

Админка «Книжного клуба». Красивые формы вместо ручного JSON: добавляешь
книгу, главу, тему, встречу, карточки или спикера — CMS сама собирает файлы по
схемам [book-club-data](https://github.com/bookclubit/book-club-data),
конвертирует картинки в WebP и открывает pull request.

Всё добавленное отображается списками (вкладки «Книги», «Главы», «Темы»,
«Встречи», «Карточки», «Спикеры») и редактируется: форма предзаполняется
текущими данными, правки уходят таким же pull request-ом. Пути и id при
редактировании не меняются (на них завязаны потребители); исключение —
встречи: при смене даты/названия файл переносится автоматически.

## Как это работает

- **Без бэкенда.** Статическое SPA (React + Vite + Tailwind v4). GitHub REST API
  отдаёт CORS-заголовки, поэтому браузер ходит в `api.github.com` напрямую.
- **Токен — только у админа.** На странице входа вводится fine-grained personal
  access token; он хранится в `localStorage` и никуда, кроме GitHub, не уходит.
- **Один PR — один коммит.** Файлы (включая бинарные WebP) собираются через Git
  Data API: blobs → tree → commit → branch → pull request.
- **Единый реестр `index.json` — генерируемый.** raw.githubusercontent.com не
  умеет листать директории, поэтому в корне book-club-data лежит реестр книг/
  глав/событий/спикеров. GitHub Action в book-club-data пересобирает его после
  каждого мержа, поэтому PR-ы CMS содержат только собственные файлы (спикеры —
  `speakers.json`, активная книга — `settings.json`), а miniapp и бот читают
  реестр вместо захардкоженных списков.

## Токен для входа

GitHub → Settings → Developer settings → Fine-grained tokens:

- Resource owner: `bookclubit`, repository: `book-club-data`
- Permissions: **Contents — Read and write**, **Pull requests — Read and write**

## Разработка

```bash
npm install
npm run dev      # локально
npm run build    # tsc + vite build
```

Переменные окружения — см. `.env.example` (`VITE_BOT_API` — URL API бота;
не задано — используется прод).

Деплой: Vercel, `npx vercel deploy --prod` (SPA-rewrite в `vercel.json`).
