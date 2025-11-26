
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
    return
  }
  const html = artists.map(a => {
    const name = a.name || '—'
    const url = a.url || '#'
    const imgs = a.images || []
    let imgUrl = null
    if (imgs.length > 0) {
      // images may be objects with url
      const first = imgs[0]
      if (first && first.url) imgUrl = first.url
      else if (typeof first === 'string') imgUrl = first
    }
    const events = a.events || []
    const evHtml = events.length > 0 ? ('<h4>Événements</h4><ul>' + events.map(ev => '<li>' + (ev.date || '') + ' — ' + (ev.venue || '') + ' — ' + (ev.name ? ('<a href="' + (ev.url || '#') + '" target="_blank">' + ev.name + '</a>') : '') + '</li>').join('') + '</ul>') : '<p>Aucun événement à afficher</p>'
    return '<div class="artist">' + (imgUrl ? ('<img src="' + imgUrl + '" alt="' + name + '" style="max-width:200px;display:block;margin-bottom:8px">') : '') + '<h3>' + name + '</h3>' + (url ? ('<p><a href="' + url + '" target="_blank">Ticketmaster link</a></p>') : '') + evHtml + '</div>'
  }).join('')
  out.innerHTML = html
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

// Ticketmaster external search
bindIfExists('btn-external', async () => {
  const q = document.getElementById('q').value.trim()
  const out = document.getElementById('results')
  out.textContent = 'Recherche Ticketmaster...'
  try {
    const res = await fetch('/external-search?q=' + encodeURIComponent(q))
    if (!res.ok) {
      const txt = await res.text()
      out.textContent = 'Erreur externe: ' + txt
      return
    }
    const data = await res.json()
    renderExternalArtists(data, out)
  } catch (err) {
    out.textContent = 'Erreur: ' + err.message
  }
})

// Trigger external search on Enter key
const input = document.getElementById('q')
if (input) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const btnExternal = document.getElementById('btn-external')
      if (btnExternal) btnExternal.click()
    }
  })
}
