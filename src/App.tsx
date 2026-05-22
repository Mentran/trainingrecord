import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/ToastProvider'
import { SportProvider } from './components/SportProvider'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import RecordPage from './pages/RecordPage'
import ListPage from './pages/ListPage'
import CalendarPage from './pages/CalendarPage'
import SettingsPage from './pages/SettingsPage'
import DetailPage from './pages/DetailPage'
import ChatPage from './pages/ChatPage'
import TechniquePage from './pages/TechniquePage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SportProvider>
        <div className="max-w-lg mx-auto min-h-svh pb-24">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/record" element={<RecordPage />} />
            <Route path="/list" element={<ListPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/techniques" element={<TechniquePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/detail/:id" element={<DetailPage />} />
          </Routes>
        </div>
        <BottomNav />
        </SportProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
