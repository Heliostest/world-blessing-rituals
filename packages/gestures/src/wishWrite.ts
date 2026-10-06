import type { GestureHandle } from './types'

export type WishWriteOpts = {
  maxLen?: number
  /**
   * Whether the host keeps the line (the App saves it as a new 心愿); the note
   * under the box says so. Hosts that keep nothing pass false.
   */
  saves?: boolean
  onSubmit?(text: string): void
}

/** Copy of the wish box. The line goes to `onSubmit`; the host may keep it. */
export const WISH_WRITE_COPY = {
  label: '写一句想说的话',
  placeholder: '写一句想说的话…',
  submit: '写好了',
  /** Under the box, when the host keeps the line. */
  note: '写好后会存进心愿',
  /** Under the box, when it keeps nothing. */
  unsaved: '只在此刻，不会保存',
  /** The host's confirmation once the line is kept. */
  saved: '已存进心愿',
  empty: '先写一句，再点「写好了」。',
} as const

let boxes = 0

export function createWishWrite(opts: WishWriteOpts): GestureHandle {
  const maxLen = opts.maxLen ?? 40
  const restingNote = opts.saves === false ? WISH_WRITE_COPY.unsaved : WISH_WRITE_COPY.note

  let el: HTMLElement | null = null
  let form: HTMLFormElement | null = null
  let input: HTMLInputElement | null = null
  let submit: HTMLButtonElement | null = null
  let note: HTMLSpanElement | null = null
  let count: HTMLSpanElement | null = null
  let enabled = true

  /** The note under the box, or a gentle nudge after an empty submit. */
  const setNudge = (on: boolean) => {
    if (!note) return
    note.textContent = on ? WISH_WRITE_COPY.empty : restingNote
    note.toggleAttribute('data-nudge', on)
  }

  const onInput = () => {
    if (!input || !count) return
    count.textContent = `${input.value.length}/${maxLen}`
    if (note?.hasAttribute('data-nudge')) setNudge(false)
  }

  const onSubmit = (e: Event) => {
    e.preventDefault()
    if (!enabled || !input) return
    const text = input.value.trim()
    if (text.length < 1) {
      setNudge(true)
      input.focus()
      return
    }
    if (text.length > maxLen) return
    opts.onSubmit?.(text)
  }

  return {
    mount(target) {
      el = target
      const metaId = `wish-write-meta-${++boxes}`
      form = document.createElement('form')
      input = document.createElement('input')
      input.type = 'text'
      input.maxLength = maxLen
      input.placeholder = WISH_WRITE_COPY.placeholder
      input.enterKeyHint = 'done'
      input.setAttribute('aria-label', WISH_WRITE_COPY.label)
      input.setAttribute('aria-describedby', metaId)
      submit = document.createElement('button')
      submit.type = 'submit'
      submit.textContent = WISH_WRITE_COPY.submit
      // Note (and nudges) on the left, n/maxLen on the right.
      const meta = document.createElement('p')
      meta.className = 'wish-write-meta'
      meta.id = metaId
      note = document.createElement('span')
      note.setAttribute('aria-live', 'polite')
      count = document.createElement('span')
      meta.append(note, count)
      setNudge(false)
      onInput()
      form.append(input, submit, meta)
      form.addEventListener('submit', onSubmit)
      input.addEventListener('input', onInput)
      el.appendChild(form)
    },
    update() {},
    dispose() {
      if (form) {
        form.removeEventListener('submit', onSubmit)
        form.remove()
      }
      input?.removeEventListener('input', onInput)
      form = null
      input = null
      submit = null
      note = null
      count = null
      el = null
    },
    setEnabled(on) {
      enabled = on
      if (input) input.disabled = !on
      if (submit) submit.disabled = !on
    },
  }
}
