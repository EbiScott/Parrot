import { JournalIcon, MicIcon, SettingsIcon } from './Icons'

const TABS = [
  { id: 'feed', label: 'Journal', Icon: JournalIcon },
  { id: 'record', label: 'Record', Icon: MicIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
]

export default function BottomNav({ current, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <div className="bottom-nav__inner">
        {TABS.map(({ id, label, Icon }) => {
          const active = current === id
          return (
            <button
              key={id}
              type="button"
              className={`bottom-nav__tab${active ? ' is-active' : ''}${
                id === 'record' ? ' bottom-nav__tab--record' : ''
              }`}
              onClick={() => onNavigate(id)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
