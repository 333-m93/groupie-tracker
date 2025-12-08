
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

  // Render clickable list of matching artists in results
  const listHtml = '<ul>' + artists.map((a, i) => '<li><button class="artist-select" data-index="' + i + '">' + (a.name || '—') + '</button></li>').join('') + '</ul>'
  out.innerHTML = listHtml

  // Render first artist by default
  renderSelectedArtist(artists[0])

  // attach click handlers to allow selecting another artist
  const buttons = out.querySelectorAll('.artist-select')
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(btn.getAttribute('data-index'), 10)
      const art = artists[idx]
      if (art) renderSelectedArtist(art)
    })
  })
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

// Ticketmaster external search with multiple criteria
bindIfExists('btn-external', async () => {
  // Collect all search criteria
  const artistName = document.getElementById('artist-name')?.value.trim() || ''
  const creationDate = document.getElementById('creation-date')?.value.trim() || ''
  const songName = document.getElementById('song-name')?.value.trim() || ''
  const firstAlbum = document.getElementById('first-album')?.value.trim() || ''
  const members = document.getElementById('members')?.value.trim() || ''

  const out = document.getElementById('results')
  
  // Check if at least one field is filled
  if (!artistName && !creationDate && !songName && !firstAlbum && !members) {
    out.textContent = 'Veuillez remplir au moins un champ de recherche'
    return
  }

  out.textContent = 'Recherche en cours...'
  
  try {
    // Build query string with all filled fields
    const params = new URLSearchParams()
    if (artistName) params.set('artist', artistName)
    if (creationDate) params.set('year', creationDate)
    if (songName) params.set('song', songName)
    if (firstAlbum) params.set('album', firstAlbum)
    if (members) params.set('member', members)

    // For now, use artist name as primary search (you can adapt server to handle multi-criteria)
    const searchQuery = artistName || songName || firstAlbum || members
    const res = await fetch('/external-search?q=' + encodeURIComponent(searchQuery))
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

// Trigger external search on Enter key for all search inputs
const searchInputs = ['artist-name', 'creation-date', 'song-name', 'first-album', 'members']
searchInputs.forEach(inputId => {
  const input = document.getElementById(inputId)
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const btnExternal = document.getElementById('btn-external')
        if (btnExternal) btnExternal.click()
      }
    })
  }
})

// Toggle additional filters visibility
const toggleBtn = document.getElementById('toggle-filters')
const additionalFilters = document.getElementById('additional-filters')

if (toggleBtn && additionalFilters) {
  toggleBtn.addEventListener('click', () => {
    const isHidden = additionalFilters.classList.contains('hidden')
    
    if (isHidden) {
      additionalFilters.classList.remove('hidden')
      toggleBtn.textContent = 'Voir - de filtres'
    } else {
      additionalFilters.classList.add('hidden')
      toggleBtn.textContent = 'Voir + de filtres'
    }
  })
}
