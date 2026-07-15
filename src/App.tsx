import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { getToken } from './lib/auth'
import { AddBook } from './pages/AddBook'
import { AddChapter } from './pages/AddChapter'
import { AddEvent } from './pages/AddEvent'
import { AddFlashcards } from './pages/AddFlashcards'
import { AddSpeaker } from './pages/AddSpeaker'
import { AddTopic } from './pages/AddTopic'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/books/new" element={<AddBook />} />
        <Route path="/chapters/new" element={<AddChapter />} />
        <Route path="/topics/new" element={<AddTopic />} />
        <Route path="/events/new" element={<AddEvent />} />
        <Route path="/flashcards/new" element={<AddFlashcards />} />
        <Route path="/speakers/new" element={<AddSpeaker />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
