import { useEffect, useState } from 'react'
import { fetchGlobalNews, newsAge } from '../lib/news'

export function Feed({ onPick }) {
  const [state, setState] = useState({ status: 'loading', articles: [] })

  useEffect(() => {
    let alive = true
    let timer
    const schedule = (ms) => {
      timer = window.setTimeout(() => alive && load().finally(() => {}), ms)
    }
    const load = () =>
      fetchGlobalNews()
        .then(({ articles }) => {
          if (!alive) return
          setState({ status: 'ok', articles })
          schedule(10 * 60000)
        })
        .catch(() => {
          if (!alive) return
          setState((s) => (s.articles.length ? s : { status: 'error', articles: [] }))
          schedule(30000) // rate-limited - try again in 30s, not 10 minutes
        })
    load()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <section className="panel feed-panel">
      <div className="panel-label">Major now · worldwide</div>
      {state.status === 'loading' && <div className="cp-note">Scanning global coverage…</div>}
      {state.status === 'error' && (
        <div className="cp-note warn">Global feed rate-limited. Retrying automatically.</div>
      )}
      <ul className="lines feed-lines">
        {state.articles.map((a, i) => (
          <li key={i}>
            <a href={a.url} target="_blank" rel="noreferrer" className="cp-news-item">
              <span className="line-place">{a.title}</span>
              <span className="line-time">{a.source} · {newsAge(a.seen)}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="panel-foot">GDELT PROJECT · LIVE GLOBAL NEWS INDEX · CLICK A COUNTRY FOR ITS STORIES</div>
    </section>
  )
}
