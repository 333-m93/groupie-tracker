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
    // Ticketmaster Discovery API returns _embedded.events
    const events = (data && data._embedded && data._embedded.events) || []
    if (!events || events.length === 0) {
      out.innerHTML = '<p>Aucun événement trouvé</p>'
      return
    }
    out.innerHTML = '<ul>' + events.map(e => '<li>' + (e.name || '—') + '</li>').join('') + '</ul>'
  } catch (err) {
    out.textContent = 'Erreur: ' + err.message
  }
})
