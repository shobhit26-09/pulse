import { useEffect, useState } from 'react'
import { fetchGlobalNews, newsAge } from '../lib/news'

export function Feed({ onPick }) {
  const [state, setState] = useState({ status: 'loading', articles: [] })

  useEffect(() => {
    let alive = true
    const load = () => {
      fetchGlobalNews()
        .then(({ articles }) => alive && setState({ status: 'ok', articles }))
        .catch(() =>
          alive &&
          setState((s) => (s.articles.length ? s : { status: 'error', articles: [] })),
        )
    }
    load()
    const id = window.setInterval(load, 10 * 60000)
    return () => {
      alive = false
      window.clearInterval(id)
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
