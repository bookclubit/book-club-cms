# Codex CMS

Админка книжного клуба «Codex». Красивые формы вместо ручного JSON: добавляешь
книгу, главу, тему, встречу, карточки или спикера — CMS сама собирает файлы по
схемам [book-club-data](https://github.com/bookclubit/book-club-data),
конвертирует картинки в WebP и открывает pull request.

## Как это работает

- **Без бэкенда.** Статическое SPA (React + Vite + Tailwind v4). GitHub REST API
  отдаёт CORS-заголовки, поэтому браузер ходит в `api.github.com` напрямую.
- **Токен — только у админа.** На странице входа вводится fine-grained personal
  access token; он хранится в `localStorage` и никуда, кроме GitHub, не уходит.
- **Один PR — один коммит.** Файлы (включая бинарные WebP) собираются через Git
  Data API: blobs → tree → commit → branch → pull request.
- **Единый реестр `index.json`.** raw.githubusercontent.com не умеет листать
  директории, поэтому в корне book-club-data лежит реестр книг/глав/событий/
  спикеров. CMS обновляет его в каждом PR, а miniapp и бот читают вместо
  захардкоженных списков.

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

Деплой: Vercel, `npx vercel deploy --prod` (SPA-rewrite в `vercel.json`).

## Скрипты

- `npm run open-index-pr` — первичная сборка `index.json` обходом репозитория и
  PR в book-club-data (нужен `GITHUB_TOKEN` в окружении). Формы CMS дальше
  поддерживают реестр сами.
