export const GLOBAL_DISCLAIMER =
  '本应用中的互动均为致敬小品与手势练习，不是宗教真仪、不是通关养成，也不产生任何功德或法效。'

export const FORBIDDEN_SUCCESS_PHRASES = [
  '参拜成功',
  '作福完成',
  '通关',
  '功德',
] as const

export function assertSafeCopy(text: string): void {
  for (const p of FORBIDDEN_SUCCESS_PHRASES) {
    if (text.includes(p)) {
      throw new Error(`forbidden copy: contains "${p}"`)
    }
  }
}
