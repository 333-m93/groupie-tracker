
// helper: render results for local /search endpoint
function renderLocalResults(data, out) {
  if (!data || !data.results || data.results.length === 0) {
    out.innerHTML = '<p>Aucun résultat</p>'
    return
  }
  out.innerHTML = '<ul>' + data.results.map(r => '<li>' + (r.name || '—') + '</li>').join('') + '</ul>'
}

// helper: render normalized artists returned by /external-search
function renderExternalArtists(data, out) {
  const artists = (data && data.artists) || []
  if (!artists || artists.length === 0) {
    out.innerHTML = '<p>Aucun artiste trouvé</p>'
    // clear artist and concerts sections
    const aInfo = document.getElementById('artist-info')
    const concerts = document.getElementById('concerts')
    if (aInfo) aInfo.innerHTML = ''
    if (concerts) concerts.innerHTML = ''
    return
  }
  // Render a simple list of matching artists in results (no artist details)
  const listHtml = '<ul>' + artists.map((a) => '<li>' + (a.name || '—') + '</li>').join('') + '</ul>'
  out.innerHTML = listHtml

  // Build concerts section grouped by artist
  const concerts = document.getElementById('concerts')
  if (!concerts) return
  const byArtist = artists.map(a => {
    const name = a.name || a.strArtist || '—'
    const events = a.events || []
    return { name, events }
  })

  const concertsHtml = byArtist.map(a => {
    if (!a.events || a.events.length === 0) return '<section class="artist-concerts"><h4>' + a.name + '</h4><p>Aucun concert trouvé</p></section>'
    const evList = '<ul>' + a.events.map(ev => '<li>' + (ev.date || '') + ' — ' + (ev.venue || '') + ' — ' + (ev.name ? ('<a href="' + (ev.url || '#') + '" target="_blank">' + ev.name + '</a>') : '') + '</li>').join('') + '</ul>'
    return '<section class="artist-concerts"><h4>' + a.name + '</h4>' + evList + '</section>'
  }).join('')

  concerts.innerHTML = concertsHtml
}

// Render selected artist info into #artist-info and its events into #concerts
function renderSelectedArtist(artist) {
  const aInfo = document.getElementById('artist-info')
  const concerts = document.getElementById('concerts')
  if (!aInfo || !concerts) return

  const name = artist.name || '—'
  const url = artist.url || '#'
  const imgs = artist.images || []
  let imgUrl = null
  if (imgs.length > 0) {
    const first = imgs[0]
    if (first && first.url) imgUrl = first.url
    else if (typeof first === 'string') imgUrl = first
  }

  let infoHtml = ''
  if (imgUrl) infoHtml += '<img src="' + imgUrl + '" alt="' + name + '" style="max-width:240px;display:block;margin-bottom:8px">'
  infoHtml += '<h3>' + name + '</h3>'
  if (url) infoHtml += '<p><a href="' + url + '" target="_blank" id="ticketmaster-link">Voir sur Ticketmaster</a></p>'
  aInfo.innerHTML = infoHtml

  // events
  const events = artist.events || []
  if (!events || events.length === 0) {
    concerts.innerHTML = '<p>Aucun concert trouvé pour cet artiste</p>'
    return
  }
  const evHtml = '<ul>' + events.map(ev => '<li><br>' + (ev.date || '') + ' — ' + (ev.venue || '') + ' — ' + (ev.name ? ('<a href="' + (ev.url || '#') + '" target="_blank">' + ev.name + '</a>') : '') + '</li>').join('') + '</ul>'
  concerts.innerHTML = evHtml
}

// Safe binder: attach listener if element exists
function bindIfExists(id, fn) {
  const el = document.getElementById(id)
  if (el) el.addEventListener('click', fn)
}

// Perform local search
bindIfExists('btn', async () => {
  const q = document.getElementById('q').value.trim()
  const out = document.getElementById('results')
  out.textContent = 'Recherche...'
  try {
    const res = await fetch('/search?q=' + encodeURIComponent(q))
    if (!res.ok) {
      out.textContent = 'Erreur locale: ' + await res.text()
      return
    }
    const data = await res.json()
    renderLocalResults(data, out)
  } catch (err) {
    out.textContent = 'Erreur: ' + err.message
  }
})

// (Individual external and wiki buttons removed; use the combined search button)

// Combined search: Wikipédia (artist info) + Ticketmaster (concerts)
bindIfExists('btn-all', async () => {
  const q = document.getElementById('q').value.trim()
  const resultsOut = document.getElementById('results')
  const info = document.getElementById('artist-info')
  const concerts = document.getElementById('concerts')
  if (!resultsOut || !info || !concerts) return

  resultsOut.textContent = 'Recherche en cours...'
  info.innerHTML = 'Recherche Wikipédia...'
  concerts.innerHTML = 'Recherche concerts...'

  try {
    const [wikiRes, tmRes] = await Promise.allSettled([
      fetch('/wiki-search?q=' + encodeURIComponent(q)),
      fetch('/external-search?q=' + encodeURIComponent(q)),
    ])

    // handle wiki result
    if (wikiRes.status === 'fulfilled') {
      const r = wikiRes.value
      if (r.ok) {
        const data = await r.json()
        renderWikiPage(data, info)
      } else {
        info.textContent = 'Erreur Wikipédia: ' + await r.text()
      }
    } else {
      info.textContent = 'Erreur Wikipédia: ' + (wikiRes.reason && wikiRes.reason.message ? wikiRes.reason.message : 'échec')
    }

    // handle ticketmaster / external result
    if (tmRes.status === 'fulfilled') {
      const r = tmRes.value
      if (r.ok) {
        const data = await r.json()
        // render list into results and default display first artist/events into artist-info/concerts
        renderExternalArtists(data, resultsOut)
      } else {
        resultsOut.textContent = 'Erreur concerts: ' + await r.text()
        concerts.innerHTML = ''
      }
    } else {
      resultsOut.textContent = 'Erreur concerts: ' + (tmRes.reason && tmRes.reason.message ? tmRes.reason.message : 'échec')
      concerts.innerHTML = ''
    }

  } catch (err) {
    resultsOut.textContent = 'Erreur: ' + err.message
    info.textContent = ''
    concerts.textContent = ''
  }
})

function renderWikiPage(data, out) {
  const page = data && data.page
    if (!page) {
    out.innerHTML = '<p>Aucune page Wikipédia trouvée</p>'
    return
  }
  const title = page.title || ''
  const extract = page.extract || ''
  const thumb = page.thumbnail || ''
  const url = page.url || ''
  const html = (thumb ? ('<img src="' + thumb + '" alt="' + title + '" style="max-width:220px;display:block;margin-bottom:8px">') : '') + '<h3>' + title + '</h3>' + (extract ? ('<p>' + (extract.length > 800 ? (extract.slice(0, 800) + '...') : extract) + '</p>') : '') + (url ? ('<p><a href="' + url + '" target="_blank">Voir sur Wikipédia</a></p>') : '')
  out.innerHTML = html
}

// Trigger combined search on Enter key
const input = document.getElementById('q')
if (input) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const btnAll = document.getElementById('btn-all')
      if (btnAll) btnAll.click()
    }
  })
}