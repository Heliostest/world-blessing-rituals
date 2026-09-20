import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Gallery } from "./pages/Gallery";
import { About } from "./pages/About";
import { Playground } from "./pages/Playground";
import { ScenePage } from "./pages/ScenePage";
import "./styles.css";
export default function DevApp() {
  return (
    <BrowserRouter basename="/dev">
      <nav className="app-nav">
        <a href="/">回到 App</a>
        <Link to="/gallery">旧场景</Link>
        <Link to="/playground/drag">手势试验</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/about" element={<About />} />
        <Route path="/playground/:gesture" element={<Playground />} />
        <Route path="/scene/:sceneId" element={<ScenePage />} />
      </Routes>
    </BrowserRouter>
  );
}
