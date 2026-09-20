import { Link } from 'react-router-dom'

const GESTURES = ['drag', 'tilt', 'spin', 'gyro', 'wishWrite'] as const

const PLACEHOLDER_SCENES = [
  { id: 'celtic-folk-spring', title: '泉边一念' },
  { id: 'theravada-water', title: '花水位一倾' },
] as const

export function Gallery() {
  return (
    <main className="page">
      <h1>祈福廊</h1>
      <p className="muted">场景尚未接入，可先试手势试验场。</p>

      <h2>手势试验</h2>
      <ul className="list">
        {GESTURES.map((g) => (
          <li key={g}>
            <Link to={`/playground/${g}`}>{g}</Link>
          </li>
        ))}
      </ul>

      <h2>场景（占位）</h2>
      <ul className="list">
        {PLACEHOLDER_SCENES.map((s) => (
          <li key={s.id}>
            <span>{s.title}</span>{' '}
            <code className="muted">{s.id}</code>{' '}
            <span className="muted">稍后</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
