import type { ReactNode } from 'react'

// Текст поста так, как его покажет Telegram: жирный, курсив и ссылки вместо
// тегов. Разбираем сами в узлы React, а не через innerHTML: текст правят
// руками, и незнакомый тег должен остаться текстом, а не стать разметкой.

const TAG = /<(\/?)(b|strong|i|em|a)(?:\s+href="([^"]*)")?\s*>/gi

function unescape(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

interface Frame {
  tag: string
  href?: string
  children: ReactNode[]
}

function wrap(frame: Frame, key: number): ReactNode {
  if (frame.tag === 'a') {
    // Только веб-ссылки: href приходит из текста, который можно править.
    const safe = /^https?:\/\//i.test(frame.href ?? '') ? frame.href : undefined
    return (
      <a key={key} href={safe} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
        {frame.children}
      </a>
    )
  }
  if (frame.tag === 'b' || frame.tag === 'strong') {
    return (
      <b key={key} className="font-semibold text-ink">
        {frame.children}
      </b>
    )
  }
  return <i key={key}>{frame.children}</i>
}

function parse(text: string): ReactNode[] {
  const stack: Frame[] = [{ tag: 'root', children: [] }]
  let key = 0
  let last = 0
  const top = () => stack[stack.length - 1]

  for (const match of text.matchAll(TAG)) {
    const [raw, closing, name, href] = match
    const tag = name.toLowerCase()
    const at = match.index ?? 0
    if (at > last) top().children.push(unescape(text.slice(last, at)))
    last = at + raw.length

    if (!closing) {
      stack.push({ tag, href, children: [] })
    } else if (stack.length > 1 && top().tag === tag) {
      const frame = stack.pop() as Frame
      top().children.push(wrap(frame, key++))
    } else {
      // Закрывающий тег без пары — оставляем как текст.
      top().children.push(raw)
    }
  }
  if (last < text.length) top().children.push(unescape(text.slice(last)))

  // Незакрытые теги: содержимое не теряем.
  while (stack.length > 1) {
    const frame = stack.pop() as Frame
    top().children.push(wrap(frame, key++))
  }
  return stack[0].children
}

export function TelegramText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-line rounded-control bg-surface-2 p-3 text-sm leading-relaxed text-ink-soft">
      {parse(text)}
    </p>
  )
}
