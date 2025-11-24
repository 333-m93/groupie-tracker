function renderLocalResults(data, out) {
  if (!data.results || data.results.length === 0) {
    out.innerHTML = '<p>Aucun résultat</p>'
    return
  }
  out.innerHTML = '<ul>' + data.results.map(r => '<li>' + r.name + '</li>').join('') + '</ul>'
}

document.getElementById('btn').addEventListener('click', async () => {
  const q = document.getElementById('q').value.trim()
  const out = document.getElementById('results')
  out.textContent = 'Recherche...'
  try {
    const res = await fetch('/search?q=' + encodeURIComponent(q))
    const data = await res.json()
    renderLocalResults(data, out)
  } catch (err) {
    out.textContent = 'Erreur: ' + err.message
  }
})

// Ticketmaster external search
document.getElementById('btn-external').addEventListener('click', async () => {
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
    // Our server normalizes Ticketmaster response into { artists: [...] }
    const artists = (data && data.artists) || []
    if (!artists || artists.length === 0) {
      out.innerHTML = '<p>Aucun artiste trouvé</p>'
      return
    }
    // Render first matching artist with details
    const html = artists.map(a => {
      const name = a.name || '—'
      const url = a.url || '#'
      const imgs = a.images || []
      const imgUrl = (imgs.length > 0 && imgs[0].url) ? imgs[0].url : null
      const events = a.events || []
      const evHtml = events.length > 0 ? ('<h4>Événements</h4><ul>' + events.map(ev => '<li>' + (ev.date || '') + ' — ' + (ev.venue || '') + ' — <a href="' + (ev.url || '#') + '">' + (ev.name || 'détail') + '</a></li>').join('') + '</ul>') : '<p>Aucun événement à afficher</p>'
      return '<div class="artist">' + (imgUrl ? ('<img src="' + imgUrl + '" alt="' + name + '" style="max-width:200px;display:block;margin-bottom:8px">') : '') + '<h3>' + name + '</h3>' + (url ? ('<p><a href="' + url + '" target="_blank">Ticketmaster link</a></p>') : '') + evHtml + '</div>'
    }).join('')
    out.innerHTML = html
  } catch (err) {
    out.textContent = 'Erreur: ' + err.message
  }
})
