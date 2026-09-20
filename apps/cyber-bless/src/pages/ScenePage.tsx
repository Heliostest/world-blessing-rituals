import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import { loadScene, type SceneInstance } from '@wbr/scenes'
import { SceneComplete } from './SceneComplete'

const UNAVAILABLE = '场景暂不可用'

Shared.assertSafeCopy(UNAVAILABLE)

export function ScenePage() {
  const { sceneId } = useParams<{ sceneId: string }>()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
  const [runId, setRunId] = useState(0)

  const onRetry = useCallback(() => {
    setComplete(false)
    setError(null)
    setRunId((n) => n + 1)
  }, [])

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
      if (cancelled) return
      // Stop WebGL/RAF immediately on complete (stage may stay mounted until retry/exit)
      cancelAnimationFrame(raf)
      raf = 0
      overlay.removeEventListener('scene:complete', onComplete)
      instance?.dispose()
      instance = null
      setComplete(true)
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
  }, [sceneId, runId])

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
      </div>
      {error ? (
        <div className="scene-error" role="alert">
          <p>{error}</p>
          <Link to="/gallery">回廊</Link>
        </div>
      ) : null}
      <div ref={wrapRef} className="scene-stage" hidden={Boolean(error) || complete} />
      {complete ? <SceneComplete onRetry={onRetry} /> : null}
    </div>
  )
}
