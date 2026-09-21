import { useEffect, useState } from 'react'
import { countryByNumericId, fmtPop, fmtArea } from '../lib/countries'
import { fetchCountryNews, newsAge } from '../lib/news'

export function CountryPanel({ countryId, fallbackName, onClose }) {
  const info = countryId ? countryByNumericId(countryId) : null
  const name = info?.n || fallbackName || 'Unknown region'
  const [state, setState] = useState({ status: 'loading', articles: [] })

  useEffect(() => {
    if (!countryId) return
    let alive = true
    setState({ status: 'loading', articles: [] })
    fetchCountryNews(name)
      .then(({ articles }) => alive && setState({ status: 'ok', articles }))
      .catch(() => alive && setState({ status: 'error', articles: [] }))
    return () => {
      alive = false
    }
  }, [countryId, name])

  return (
    <aside className="country-panel glass">
      <div className="cp-head">
        <div className="cp-title">
          {info?.flag && <span className="cp-flag">{info.flag}</span>}
          <div>
            <div className="cp-name">{name}</div>
            <div className="cp-sub">{[info?.sub || info?.reg].filter(Boolean).join('')}</div>
          </div>
        </div>
        <button className="cp-close" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {info && (
        <div className="cp-facts">
          {info.cap && (
            <div><div className="cp-fact-v">{info.cap}</div><div className="cp-fact-k">Capital</div></div>
          )}
          {info.pop && (
            <div><div className="cp-fact-v">{fmtPop(info.pop)}</div><div className="cp-fact-k">Population</div></div>
          )}
          {info.area > 0 && (
            <div><div className="cp-fact-v">{fmtArea(info.area)}</div><div className="cp-fact-k">Area</div></div>
          )}
          {info.lang?.length > 0 && (
            <div><div className="cp-fact-v">{info.lang.join(', ')}</div><div className="cp-fact-k">Languages</div></div>
          )}
        </div>
      )}

      <div className="cp-news-label">Top stories · 48h</div>
      {state.status === 'loading' && <div className="cp-note">Loading live coverage…</div>}
      {state.status === 'error' && (
        <div className="cp-note warn">
          Live feed unavailable right now (rate limit or network). Nothing cached for this country yet - try again in a moment.
        </div>
      )}
      {state.status === 'ok' && state.articles.length === 0 && (
        <div className="cp-note">No major English-language coverage of {name} in the last 7 days.</div>
      )}
      {state.status === 'ok' && state.articles.length > 0 && (
        <ul className="cp-news lines">
          {state.articles.map((a, i) => (
            <li key={i}>
              <a href={a.url} target="_blank" rel="noreferrer" className="cp-news-item">
                <span className="line-place">{a.title}</span>
                <span className="line-time">{a.source} · {newsAge(a.seen)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="cp-src">News: GDELT Project live index · Facts: national datasets</div>
    </aside>
  )
}
