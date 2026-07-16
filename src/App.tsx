import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { getToken } from './lib/auth'
import { AddBook } from './pages/AddBook'
import { AddChapter } from './pages/AddChapter'
import { AddEvent } from './pages/AddEvent'
import { AddFlashcards } from './pages/AddFlashcards'
import { AddSpeaker } from './pages/AddSpeaker'
import { AddTopic } from './pages/AddTopic'
import { Books } from './pages/Books'
import { Chapters } from './pages/Chapters'
import { Dashboard } from './pages/Dashboard'
import { EditBook } from './pages/EditBook'
import { EditChapter } from './pages/EditChapter'
import { EditEvent } from './pages/EditEvent'
import { EditSpeaker } from './pages/EditSpeaker'
import { EditTopic } from './pages/EditTopic'
import { Events } from './pages/Events'
import { Flashcards } from './pages/Flashcards'
import { Login } from './pages/Login'
import { Speakers } from './pages/Speakers'
import { Topics } from './pages/Topics'

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

        <Route path="/books" element={<Books />} />
        <Route path="/books/new" element={<AddBook />} />
        <Route path="/books/:folder/edit" element={<EditBook />} />

        <Route path="/chapters" element={<Chapters />} />
        <Route path="/chapters/new" element={<AddChapter />} />
        <Route path="/chapters/:folder/:slug/edit" element={<EditChapter />} />

        <Route path="/topics" element={<Topics />} />
        <Route path="/topics/new" element={<AddTopic />} />
        <Route path="/topics/:folder/:slug/:file/edit" element={<EditTopic />} />

        <Route path="/events" element={<Events />} />
        <Route path="/events/new" element={<AddEvent />} />
        <Route path="/events/:dir/:file/edit" element={<EditEvent />} />

        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/flashcards/new" element={<AddFlashcards />} />

        <Route path="/speakers" element={<Speakers />} />
        <Route path="/speakers/new" element={<AddSpeaker />} />
        <Route path="/speakers/:id/edit" element={<EditSpeaker />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
