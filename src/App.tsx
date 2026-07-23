import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { ToastProvider } from './components/ToastProvider'
import { SportProvider } from './components/SportProvider'
import BottomNav from './components/BottomNav'
import AppErrorBoundary from './components/AppErrorBoundary'
import ListPage from './pages/ListPage'

const RecordPage = lazy(() => import('./pages/RecordPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const DetailPage = lazy(() => import('./pages/DetailPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const TechniquePage = lazy(() => import('./pages/TechniquePage'))

function RouteFallback() {
  return (
    <div className="px-4 pt-14" aria-label="页面加载中" aria-live="polite">
      <div className="h-10 w-32 rounded-xl bg-[#ECEEE5] animate-pulse motion-reduce:animate-none" />
      <div className="mt-6 h-36 rounded-2xl bg-white card-shadow animate-pulse motion-reduce:animate-none" />
      <div className="mt-3 h-24 rounded-2xl bg-white card-shadow animate-pulse motion-reduce:animate-none" />
    </div>
  )
}

function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <main className="min-h-[70svh] px-6 flex flex-col items-center justify-center text-center">
      <div className="text-4xl">🧭</div>
      <h1 className="mt-3 text-xl font-bold text-[#1A1A1A]">没有找到这个页面</h1>
      <p className="mt-2 text-sm text-[#6B7280]">链接可能已经失效，训练记录不会受到影响。</p>
      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="mt-5 rounded-xl bg-[#1A2E1A] px-5 py-2.5 text-sm font-semibold text-white"
      >
        返回记录首页
      </button>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <SportProvider>
          <AppErrorBoundary>
            <div className="max-w-lg mx-auto min-h-svh pb-24">
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<ListPage />} />
                  <Route path="/record" element={<RecordPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/techniques" element={<TechniquePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/detail/:id" element={<DetailPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </div>
            <BottomNav />
          </AppErrorBoundary>
        </SportProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
