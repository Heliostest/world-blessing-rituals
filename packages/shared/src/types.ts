export type GestureKind = 'drag' | 'tilt' | 'spin' | 'gyro' | 'wishWrite'
export type Grade = 'A' | 'B' | 'C'
export type Sensitivity = '低' | '中' | '高'

export type SceneMeta = {
  id: string
  title: string
  traditionSlug: string
  grade: Grade
  sensitivity: Sensitivity
  gestures: GestureKind[]
}
