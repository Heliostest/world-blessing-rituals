import { Link } from 'react-router-dom'

const GESTURES = ['drag', 'tilt', 'spin', 'gyro', 'wishWrite'] as const

const PILOT_SCENES = [
  { id: 'celtic-folk-spring', title: '泉边一念' },
  { id: 'theravada-water', title: '花水位一倾' },
] as const

export function Gallery() {
  return (
    <main className="page">
      <h1>祈福廊</h1>
      <p className="muted">试点场景可进入；其余稍后。</p>

      <h2>手势试验</h2>
      <ul className="list">
        {GESTURES.map((g) => (
          <li key={g}>
            <Link to={`/playground/${g}`}>{g}</Link>
          </li>
        ))}
      </ul>

      <h2>场景</h2>
      <ul className="list">
        {PILOT_SCENES.map((s) => (
          <li key={s.id}>
            <Link to={`/scene/${s.id}`}>{s.title}</Link>{' '}
            <code className="muted">{s.id}</code>
          </li>
        ))}
      </ul>
    </main>
  )
}
