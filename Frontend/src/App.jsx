import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import RutaPage from './pages/RutaPage'
import ComentariosPage from './pages/ComentariosPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="ruta" element={<RutaPage />} />
        <Route path="comentarios" element={<ComentariosPage />} />
      </Route>
    </Routes>
  )
}
