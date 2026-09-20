import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createDrag,
  createGyro,
  createSpin,
  createTilt,
  createWishWrite,
  type GestureHandle,
} from '@wbr/gestures'
import { assertSafeCopy } from '@wbr/shared'

const GESTURES = ['drag', 'tilt', 'spin', 'gyro', 'wishWrite'] as const
type GestureName = (typeof GESTURES)[number]

function isGestureName(value: string | undefined): value is GestureName {
  return GESTURES.includes(value as GestureName)
}

function setSafeStatus(
  setStatus: (text: string) => void,
  text: string,
): void {
  assertSafeCopy(text)
  setStatus(text)
}

function createGesture(
  name: GestureName,
  setStatus: (text: string) => void,
): GestureHandle {
  const status = (text: string) => setSafeStatus(setStatus, text)

  switch (name) {
    case 'drag':
      return createDrag({
        hitTest: () => true,
        onProgress: () => status('拖拽中'),
        onDrop: (hit) => status(hit ? '已放下（命中练习区）' : '已放下'),
      })
    case 'tilt':
      return createTilt({
        onAngle: (deg) => status(`倾角 ${deg.toFixed(0)}°`),
        onPour: () => status('倾倒触发（练习）'),
      })
    case 'spin':
      return createSpin({
        onAngle: (rad) => status(`转角 ${(rad * (180 / Math.PI)).toFixed(0)}°`),
        onRevolution: (n) => status(`完成第 ${n} 圈（练习）`),
      })
    case 'gyro':
      return createGyro({
        onBow: () => status('鞠躬触发（练习）'),
        onHold: () => status('停驻触发（练习）'),
      })
    case 'wishWrite':
      return createWishWrite({
        onSubmit: () => status('已提交练习短句'),
      })
  }
}

function hintFor(name: GestureName): string {
  switch (name) {
    case 'drag':
      return '在画面上按住拖动，松手结束。'
    case 'tilt':
      return '上下拖动模拟倾角；超过阈值触发倾倒。'
    case 'spin':
      return '左右拖动模拟旋转；满一圈有反馈。'
    case 'gyro':
      return '点按画面以授权运动传感器（若需要）；或使用点按回退。'
    case 'wishWrite':
      return '在输入框写下短句后提交（练习，非法效）。'
  }
}

export function Playground() {
  const { gesture } = useParams<{ gesture: string }>()
  const stageRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('就绪')

  useEffect(() => {
    assertSafeCopy('就绪')
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el || !isGestureName(gesture)) return

    setSafeStatus(setStatus, '就绪')
    const handle = createGesture(gesture, setStatus)
    handle.mount(el, {})

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      handle.update(dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      handle.dispose()
    }
  }, [gesture])

  if (!isGestureName(gesture)) {
    return (
      <main className="page">
        <h1>未知手势</h1>
        <p>可用：{GESTURES.join(', ')}</p>
        <Link to="/playground/drag">回到 drag</Link>
      </main>
    )
  }

  return (
    <div className="playground-wrap">
      <div className="playground-hud">
        <div className="gesture-links">
          {GESTURES.map((g) => (
            <Link key={g} to={`/playground/${g}`} aria-current={g === gesture}>
              {g}
            </Link>
          ))}
        </div>
        <div className="hint">{hintFor(gesture)}</div>
        <div className="status" aria-live="polite">
          {status}
        </div>
      </div>
      <div
        ref={stageRef}
        className="playground-stage"
        data-gesture={gesture}
      />
    </div>
  )
}
