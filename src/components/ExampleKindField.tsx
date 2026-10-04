import type { FlashcardExampleKind } from '../types'
import { Field, Select } from './ui'

// Что написано в поле примера. От ответа зависит, как карточка покажет его
// в приложении: код виден сразу, пояснение ждёт под кнопкой «Объяснение» —
// чтобы человек сначала вспомнил сам.
export function ExampleKindField({
  value,
  onChange,
}: {
  value: FlashcardExampleKind
  onChange: (kind: FlashcardExampleKind) => void
}) {
  return (
    <Field label="Что в этом поле">
      <Select value={value} onChange={(e) => onChange(e.target.value as FlashcardExampleKind)}>
        <option value="code">Пример кода — виден сразу под ответом</option>
        <option value="note">Пояснение — под кнопкой «Объяснение»</option>
      </Select>
    </Field>
  )
}
