import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import './App.css'

const FALLBACK_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
  '#14B8A6', '#F43F5E', '#84CC16', '#A855F7',
]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function contrastText(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? '#1a1a2e' : '#ffffff'
}

function formatTime(str) {
  return new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function eventStartDate(evt) {
  return evt.start?.date || evt.start?.dateTime?.slice(0, 10)
}

function eventEndDate(evt) {
  if (evt.end?.date) {
    const d = new Date(evt.end.date)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }
  return evt.end?.dateTime?.slice(0, 10)
}

// ── Week agenda view (defined outside App to avoid remount on every render) ──
function WeekAgendaView({ events, hiddenCals, clock, nextUpId }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d
  })

  return (
    <div className="agenda-view">
      {days.map((day, i) => {
        const dStr = day.toISOString().slice(0, 10)
        const isToday = i === 0
        const dayEvts = events
          .filter(evt => {
            if (hiddenCals.has(evt.calName)) return false
            const start = eventStartDate(evt)
            const end = eventEndDate(evt)
            return start && dStr >= start && dStr <= (end || start)
          })
          .sort((a, b) => {
            const ta = a.start?.dateTime || a.start?.date || ''
            const tb = b.start?.dateTime || b.start?.date || ''
            return ta.localeCompare(tb)
          })

        return (
          <div key={dStr} className={`agenda-day${isToday ? ' agenda-today' : ''}`}>
            <div className="agenda-day-header">
              <span className="agenda-day-name">
                {isToday ? 'Today' : DAYS_FULL[day.getDay()]}
              </span>
              <span className="agenda-day-date">
                {MONTHS_SHORT[day.getMonth()]} {day.getDate()}
              </span>
            </div>

            {dayEvts.length === 0 ? (
              <div className="agenda-free">Free</div>
            ) : (
              <div className="agenda-events">
                {dayEvts.map((evt, j) => {
                  const isPast = isToday && evt.start?.dateTime && new Date(evt.start.dateTime) < clock
                  const isNext = evt.id === nextUpId
                  return (
                    <div
                      key={j}
                      className={`agenda-evt${isPast ? ' evt-past' : ''}${isNext ? ' evt-next-up' : ''}`}
                      style={{ borderLeftColor: evt.calColor }}
                    >
                      <div className="agenda-evt-time-col">
                        <span className="agenda-evt-start">
                          {evt.start?.dateTime ? formatTime(evt.start.dateTime) : 'All day'}
                        </span>
                        {evt.end?.dateTime && (
                          <span className="agenda-evt-end">{formatTime(evt.end.dateTime)}</span>
                        )}
                      </div>
                      <div className="agenda-evt-body">
                        <div className="agenda-evt-title">{evt.summary}</div>
                        {evt.location && <div className="agenda-evt-loc">📍 {evt.location}</div>}
                        <div className="agenda-evt-cal" style={{ color: evt.calColor }}>{evt.calName}</div>
                      </div>
                      {isNext && <span className="next-up-badge">Next up</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main app ──
export default function App() {
  const [accessToken, setAccessToken]   = useState(null)
  const [user, setUser]                 = useState(null)
  const [events, setEvents]             = useState([])
  const [calendars, setCalendars]       = useState([])
  const [hiddenCals, setHiddenCals]     = useState(new Set())
  const [currentDate, setCurrentDate]   = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState(() => new Date().getDate())
  const [loading, setLoading]           = useState(false)
  const [dark, setDark]                 = useState(() => localStorage.getItem('lumina-dark') === 'true')
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [clock, setClock]               = useState(new Date())
  const [view, setView]                 = useState('month')
  const [dimOverride, setDimOverride]   = useState(false)
  const [fullscreen, setFullscreen]     = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [holidays, setHolidays]               = useState([])

  const fetchIdRef      = useRef(0)
  const dimWakeTimerRef = useRef(null)

  const HOLIDAY_COLOR = '#F59E0B'

  // 1s clock tick
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Public holidays via Nager.Date (US)
  useEffect(() => {
    async function loadHolidays() {
      try {
        const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`)
        if (!res.ok) return
        const data = await res.json()
        setHolidays(data.map(h => ({
          id: `holiday_${h.date}`,
          summary: h.localName,
          start: { date: h.date },
          end: { date: h.date },
          calColor: HOLIDAY_COLOR,
          calName: 'Holidays',
        })))
      } catch { /* ignore */ }
    }
    loadHolidays()
  }, [year])

  // Fullscreen state sync
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }

  // Dim mode: 10pm–6am
  const dimmed = useMemo(() => {
    const h = clock.getHours()
    return !dimOverride && (h >= 22 || h < 6)
  }, [clock, dimOverride])

  useEffect(() => {
    return () => { if (dimWakeTimerRef.current) clearTimeout(dimWakeTimerRef.current) }
  }, [])

  function handleDimWake() {
    setDimOverride(true)
    if (dimWakeTimerRef.current) clearTimeout(dimWakeTimerRef.current)
    dimWakeTimerRef.current = setTimeout(() => setDimOverride(false), 60_000)
  }

  function toggleDark() {
    setDark(d => { localStorage.setItem('lumina-dark', String(!d)); return !d })
  }

  const login = useGoogleLogin({
    scope: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/userinfo.profile'].join(' '),
    onSuccess: (res) => setAccessToken(res.access_token),
    onError: () => alert('Login failed — check your Client ID in .env'),
  })

  useEffect(() => {
    if (!accessToken) return
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json()).then(setUser)
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(data => setCalendars((data.items || []).map((cal, i) => ({
        ...cal, color: cal.backgroundColor || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      }))))
  }, [accessToken])

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const fetchEvents = useCallback(async () => {
    if (!accessToken || !calendars.length) return
    const fetchId = ++fetchIdRef.current
    setLoading(true)
    const now = new Date()
    // Always cover today's month AND the currently viewed month
    const timeMin = new Date(Math.min(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      new Date(year, month - 1, 1)
    )).toISOString()
    const timeMax = new Date(Math.max(
      new Date(now.getFullYear(), now.getMonth() + 2, 1),
      new Date(year, month + 2, 1)
    )).toISOString()
    const all = []
    for (const cal of calendars) {
      try {
        const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '500' })
        const res  = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
        if (res.status === 401) { setAccessToken(null); return }
        const data = await res.json()
        ;(data.items || []).forEach(evt => all.push({ ...evt, calColor: cal.color, calName: cal.summary }))
      } catch { /* skip */ }
    }
    if (fetchId !== fetchIdRef.current) return
    setEvents(all)
    setLoading(false)
  }, [accessToken, calendars, year, month])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Auto-refresh every 15 min
  useEffect(() => {
    const id = setInterval(fetchEvents, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchEvents])

  const allEvents = useMemo(() => [...events, ...holidays], [events, holidays])

  // Next upcoming event today
  const nextUpId = useMemo(() => {
    const now = clock
    const todayStr = now.toISOString().slice(0, 10)
    return allEvents
      .filter(evt =>
        evt.start?.dateTime &&
        new Date(evt.start.dateTime) > now &&
        evt.start.dateTime.slice(0, 10) === todayStr &&
        !hiddenCals.has(evt.calName)
      )
      .sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime))[0]?.id || null
  }, [events, clock, hiddenCals])

  // Month grid
  const today    = new Date()
  const firstDay = new Date(year, month, 1).getDay()
  const cells    = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsByDay = useMemo(() => {
    const map = new Map()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      map.set(dStr, [])
    }
    allEvents.forEach(evt => {
      if (hiddenCals.has(evt.calName)) return
      const start = eventStartDate(evt)
      const end   = eventEndDate(evt)
      if (!start) return
      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        if (dStr >= start && dStr <= (end || start)) map.get(dStr).push(evt)
      }
    })
    return map
  }, [events, hiddenCals, year, month])

  function getEventsForDay(day) {
    if (!day) return []
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return eventsByDay.get(dStr) || []
  }

  function toggleCal(name) {
    setHiddenCals(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : []
  const isToday = d => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const clockStr = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr  = clock.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  // Sidebar JSX (shared between desktop rail and mobile drawer)
  const sidebarJSX = (
    <>
      <section className="cal-list-section">
        <h3 className="sidebar-heading">My Calendars</h3>
        {calendars.map(cal => (
          <label key={cal.id} className="cal-row" onClick={() => toggleCal(cal.summary)}>
            <span className="cal-checkbox" style={{ background: hiddenCals.has(cal.summary) ? 'transparent' : cal.color, borderColor: cal.color }}>
              {!hiddenCals.has(cal.summary) && '✓'}
            </span>
            <span className="cal-label">{cal.summary}</span>
          </label>
        ))}
        {holidays.length > 0 && (
          <label className="cal-row" onClick={() => toggleCal('Holidays')}>
            <span className="cal-checkbox" style={{ background: hiddenCals.has('Holidays') ? 'transparent' : HOLIDAY_COLOR, borderColor: HOLIDAY_COLOR }}>
              {!hiddenCals.has('Holidays') && '✓'}
            </span>
            <span className="cal-label">Holidays</span>
          </label>
        )}
      </section>

      {view === 'month' && selectedDay && (
        <section className="day-panel">
          <h3 className="sidebar-heading">{MONTHS[month]} {selectedDay}</h3>
          {selectedEvents.length === 0
            ? <p className="no-events">No events</p>
            : selectedEvents.map((evt, i) => (
              <div key={i} className={`evt-card${evt.id === nextUpId ? ' next-up-card' : ''}`}>
                <div className="evt-card-bar" style={{ background: evt.calColor }} />
                <div className="evt-card-body">
                  <div className="evt-time">
                    {evt.start?.dateTime
                      ? `${formatTime(evt.start.dateTime)}${evt.end?.dateTime ? ` – ${formatTime(evt.end.dateTime)}` : ''}`
                      : 'All day'}
                  </div>
                  <div className="evt-title">{evt.summary}</div>
                  {evt.location && <div className="evt-loc">📍 {evt.location}</div>}
                  <div className="evt-cal-tag" style={{ color: evt.calColor }}>{evt.calName}</div>
                </div>
              </div>
            ))
          }
        </section>
      )}
    </>
  )

  if (!accessToken) {
    return (
      <div className={`login-screen${dark ? ' dark' : ''}`}>
        <div className="blob blob1" /><div className="blob blob2" /><div className="blob blob3" />
        <div className="login-card">
          <div className="login-icon">📅</div>
          <h1>Lumina Calendar</h1>
          <p>Your colourful, connected calendar</p>
          <button className="google-btn" onClick={() => login()}>
            <GoogleIcon />Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`app${dark ? ' dark' : ''}${dimmed ? ' app-dimmed' : ''}`}>
        <header className="app-header">
          <div className="header-left">
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
            <span className="app-logo">📅</span>
            <span className="app-name">Lumina</span>
            {view === 'month' && (
              <>
                <button className="today-btn" onClick={() => { setCurrentDate(new Date()); setSelectedDay(today.getDate()) }}>Today</button>
                <button className="nav-btn" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>‹</button>
                <button className="nav-btn" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>›</button>
                <h2 className="month-label">{MONTHS[month]} {year}</h2>
              </>
            )}
          </div>

          <div className="header-center">
            <div className="clock-time">{clockStr}</div>
            <div className="clock-date">{dateStr}</div>
          </div>

          <div className="header-right">
            {loading && <span className="spinner" />}
            <div className="view-toggle">
              <button className={`view-btn${view === 'month' ? ' active' : ''}`} onClick={() => setView('month')}>Month</button>
              <button className={`view-btn${view === 'week'  ? ' active' : ''}`} onClick={() => setView('week')}>Week</button>
            </div>
            <button className="icon-btn" onClick={() => setSidebarCollapsed(s => !s)} title={sidebarCollapsed ? 'Show calendars' : 'Hide calendars'}>
              <SidebarIcon collapsed={sidebarCollapsed} />
            </button>
            <button className="icon-btn" onClick={toggleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              <FullscreenIcon active={fullscreen} />
            </button>
            <button className="dark-toggle" onClick={toggleDark}>{dark ? '☀️' : '🌙'}</button>
            {user && (
              <div className="user-chip">
                {user.picture
                  ? <img src={user.picture} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                  : <span className="user-initials">{user.given_name?.[0]}</span>}
                <span className="user-name">{user.given_name}</span>
              </div>
            )}
          </div>
        </header>

        <div className="app-body">
          <aside className={`sidebar${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>{sidebarJSX}</aside>

          {sidebarOpen && (
            <div className="drawer-overlay" onClick={() => setSidebarOpen(false)}>
              <aside className="drawer" onClick={e => e.stopPropagation()}>
                <button className="drawer-close" onClick={() => setSidebarOpen(false)}>✕</button>
                {sidebarJSX}
              </aside>
            </div>
          )}

          <main className="cal-main">
            {view === 'week' ? (
              <WeekAgendaView
                events={allEvents}
                hiddenCals={hiddenCals}
                clock={clock}
                nextUpId={nextUpId}
              />
            ) : (
              <>
                <div className="day-headers">
                  {DAYS.map(d => <div key={d} className="day-hdr" data-short={d[0]}>{d}</div>)}
                </div>
                <div className="cal-grid">
                  {cells.map((day, idx) => {
                    const dayEvts = getEventsForDay(day)
                    return (
                      <div
                        key={idx}
                        className={`cell${!day ? ' cell-empty' : ''}${isToday(day) ? ' cell-today' : ''}${day === selectedDay ? ' cell-selected' : ''}`}
                        onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                      >
                        {day && (
                          <>
                            <span className="cell-num">{day}</span>
                            <div className="chip-list">
                              {dayEvts.slice(0, 3).map((evt, i) => (
                                <div
                                  key={i}
                                  className={`chip${evt.id === nextUpId ? ' chip-next-up' : ''}`}
                                  style={{ background: evt.calColor, color: contrastText(evt.calColor) }}
                                  title={evt.summary}
                                >
                                  {evt.start?.dateTime && <span className="chip-time">{formatTime(evt.start.dateTime)}</span>}
                                  <span className="chip-name">{evt.summary}</span>
                                </div>
                              ))}
                              {dayEvts.length > 3 && <div className="chip-more">+{dayEvts.length - 3} more</div>}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {selectedDay && (
                  <div className="bottom-sheet">
                    <div className="bottom-sheet-handle" />
                    <div className="bottom-sheet-header">
                      <span className="bottom-sheet-title">{MONTHS[month]} {selectedDay}</span>
                      <button className="bottom-sheet-close" onClick={() => setSelectedDay(null)}>✕</button>
                    </div>
                    <div className="bottom-sheet-body">
                      {selectedEvents.length === 0
                        ? <p className="no-events">No events</p>
                        : selectedEvents.map((evt, i) => (
                          <div key={i} className={`evt-card${evt.id === nextUpId ? ' next-up-card' : ''}`}>
                            <div className="evt-card-bar" style={{ background: evt.calColor }} />
                            <div className="evt-card-body">
                              <div className="evt-time">
                                {evt.start?.dateTime
                                  ? `${formatTime(evt.start.dateTime)}${evt.end?.dateTime ? ` – ${formatTime(evt.end.dateTime)}` : ''}`
                                  : 'All day'}
                              </div>
                              <div className="evt-title">{evt.summary}</div>
                              {evt.location && <div className="evt-loc">📍 {evt.location}</div>}
                              <div className="evt-cal-tag" style={{ color: evt.calColor }}>{evt.calName}</div>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {dimmed && (
        <div className="dim-wake-hint" onClick={handleDimWake}>Tap to wake</div>
      )}
    </>
  )
}

function FullscreenIcon({ active }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
    </svg>
  )
}

function SidebarIcon({ collapsed }) {
  return collapsed ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M3 18h13v-2H3v2zm0-5h10v-2H3v2zm0-7v2h13V6H3zm18 9.59L17.42 12 21 8.41 19.59 7l-5 5 5 5L21 15.59z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M3 18h13v-2H3v2zm0-5h10v-2H3v2zm0-7v2h13V6H3zm15 4l-1.41-1.41L19.17 12l-2.58 2.59L18 16l4-4-4-4z"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66 2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
