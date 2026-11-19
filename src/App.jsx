import { useEffect, useState } from 'react'
import BottomNav from './components/BottomNav'
import EntryDetail from './pages/EntryDetail'
import JournalFeed from './pages/JournalFeed'
import RecordScreen from './pages/RecordScreen'
import Settings from './pages/Settings'

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/feed'
  const parts = raw.split('/').filter(Boolean)
  if (parts[0] === 'record') return { name: 'record' }
  if (parts[0] === 'settings') return { name: 'settings' }
  if (parts[0] === 'entry' && parts[1]) return { name: 'entry', id: Number(parts[1]) }
  return { name: 'feed' }
}

export default function App() {
  const [route, setRoute] = useState(parseHash)

  useEffect(() => {
    const sync = () => setRoute(parseHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#/feed')
  }, [])

  const go = (path) => {
    window.location.hash = path
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const current = route.name === 'record' || route.name === 'settings' ? route.name : 'feed'
  let page = null

  if (route.name === 'record') {
    page = <RecordScreen onDone={(id) => go(`/entry/${id}`)} />
  } else if (route.name === 'settings') {
    page = <Settings onBack={() => go('/feed')} />
  } else if (route.name === 'entry') {
    page = <EntryDetail id={route.id} onBack={() => go('/feed')} onOpen={(id) => go(`/entry/${id}`)} />
  } else {
    page = <JournalFeed onRecord={() => go('/record')} onOpen={(id) => go(`/entry/${id}`)} />
  }

  return (
    <div className="app-shell">
      <main className="app-main">{page}</main>
      <BottomNav current={current} onNavigate={(tab) => go(`/${tab}`)} />
    </div>
  )
}
