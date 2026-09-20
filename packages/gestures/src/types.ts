export type GestureHandle = {
  mount(el: HTMLElement, opts: Record<string, unknown>): void
  update(dt: number): void
  dispose(): void
  setEnabled(on: boolean): void
}
