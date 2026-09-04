import { Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import HomePage from './pages/HomePage'
import RutaPage from './pages/RutaPage'
import ComentariosPage from './pages/ComentariosPage'

export default function App() {
  return (
    <div className="site">
      <Nav />
      <div className="site-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/ruta" element={<RutaPage />} />
          <Route path="/comentarios" element={<ComentariosPage />} />
        </Routes>
      </div>
    </div>
  )
}
