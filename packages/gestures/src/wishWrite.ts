import type { GestureHandle } from './types'

export type WishWriteOpts = {
  maxLen?: number
  onSubmit?(text: string): void
}

export function createWishWrite(opts: WishWriteOpts): GestureHandle {
  const maxLen = opts.maxLen ?? 40

  let el: HTMLElement | null = null
  let form: HTMLFormElement | null = null
  let input: HTMLInputElement | null = null
  let enabled = true

  const onSubmit = (e: Event) => {
    e.preventDefault()
    if (!enabled || !input) return
    const text = input.value.trim()
    if (text.length < 1 || text.length > maxLen) return
    opts.onSubmit?.(text)
  }

  return {
    mount(target) {
      el = target
      form = document.createElement('form')
      input = document.createElement('input')
      input.type = 'text'
      input.maxLength = maxLen
      input.setAttribute('aria-label', 'wish')
      const submit = document.createElement('button')
      submit.type = 'submit'
      submit.textContent = 'OK'
      form.appendChild(input)
      form.appendChild(submit)
      form.addEventListener('submit', onSubmit)
      el.appendChild(form)
    },
    update() {},
    dispose() {
      if (form) {
        form.removeEventListener('submit', onSubmit)
        form.remove()
      }
      form = null
      input = null
      el = null
    },
    setEnabled(on) {
      enabled = on
      if (input) input.disabled = !on
    },
  }
}
