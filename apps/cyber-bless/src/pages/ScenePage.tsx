import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import { loadScene, type SceneInstance } from '@wbr/scenes'

const UNAVAILABLE = '场景暂不可用'
const PRACTICE_DONE = '练习结束'

Shared.assertSafeCopy(UNAVAILABLE)
Shared.assertSafeCopy(PRACTICE_DONE)

export function ScenePage() {
  const { sceneId } = useParams<{ sceneId: string }>()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    setError(null)
    setComplete(false)
    const wrap = wrapRef.current
    if (!wrap || !sceneId) return

    let cancelled = false
    let raf = 0
    let instance: SceneInstance | null = null

    const canvas = document.createElement('canvas')
    canvas.className = 'scene-canvas'
    const overlay = document.createElement('div')
    overlay.className = 'scene-overlay-host'
    wrap.replaceChildren(canvas, overlay)

    const onComplete = () => {
      if (!cancelled) setComplete(true)
    }
    overlay.addEventListener('scene:complete', onComplete)

    ;(async () => {
      try {
        const mod = await loadScene(sceneId)
        if (cancelled) return
        instance = mod.create({
          canvas,
          overlay,
          gestures: Gestures,
          shared: Shared,
        })
        instance.start()

        let last = performance.now()
        const tick = (now: number) => {
          if (cancelled) return
          const dt = (now - last) / 1000
          last = now
          instance?.update(dt)
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch {
        if (cancelled) return
        setError(UNAVAILABLE)
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      overlay.removeEventListener('scene:complete', onComplete)
      instance?.dispose()
      instance = null
      wrap.replaceChildren()
    }
  }, [sceneId])

  if (!sceneId) {
    return (
      <main className="page">
        <h1>未知场景</h1>
        <Link to="/gallery">回廊</Link>
      </main>
    )
  }

  return (
    <div className="scene-page">
      <div className="scene-topbar">
        <Link to="/gallery">退出</Link>
        {complete ? (
          <span className="scene-complete-flag" aria-live="polite">
            {PRACTICE_DONE}
          </span>
        ) : null}
      </div>
      {error ? (
        <div className="scene-error" role="alert">
          <p>{error}</p>
          <Link to="/gallery">回廊</Link>
        </div>
      ) : null}
      <div ref={wrapRef} className="scene-stage" hidden={Boolean(error)} />
    </div>
  )
}
