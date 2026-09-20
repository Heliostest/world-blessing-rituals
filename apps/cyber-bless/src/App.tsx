import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Home } from './pages/Home'
import { Gallery } from './pages/Gallery'
import { About } from './pages/About'
import { Playground } from './pages/Playground'

export function App() {
  return (
    <BrowserRouter>
      <nav className="app-nav">
        <Link to="/">首页</Link>
        <Link to="/gallery">祈福廊</Link>
        <Link to="/about">关于</Link>
        <Link to="/playground/drag">手势试验</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/about" element={<About />} />
        <Route path="/playground/:gesture" element={<Playground />} />
      </Routes>
    </BrowserRouter>
  )
}
