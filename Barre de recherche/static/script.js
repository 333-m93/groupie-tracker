
// simple debounce helper
function debounce(fn, delay = 400) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

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
    if (imgUrl) infoHtml += '<img class="artist-photo" src="' + imgUrl + '" alt="' + name + '">'
  infoHtml += '<h3>' + name + '</h3>'
  if (url) infoHtml += '<p><a href="' + url + '" target="_blank" id="ticketmaster-link"></a></p>'
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

// Ticketmaster/Discogs external search with multiple criteria
async function externalSearch() {
  const artistName = document.getElementById('artist-name')?.value.trim() || ''
  const creationDate = document.getElementById('creation-date')?.value.trim() || ''
  const songName = document.getElementById('song-name')?.value.trim() || ''
  const firstAlbum = document.getElementById('first-album')?.value.trim() || ''
  const members = document.getElementById('members')?.value.trim() || ''

  const out = document.getElementById('results')
  if (!out) return

  if (!artistName && !creationDate && !songName && !firstAlbum && !members) {
    out.textContent = 'Veuillez remplir au moins un champ de recherche'
    return
  }

  out.textContent = 'Recherche en cours...'

  try {
    // Use artist name as primary query (server can be extended for full multi-criteria)
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
}

bindIfExists('btn-external', externalSearch)

// Trigger external search on Enter key and on input change (debounced) for all search inputs
const searchInputs = ['artist-name', 'creation-date', 'song-name', 'first-album', 'members']
const debouncedExternalSearch = debounce(externalSearch, 500)

searchInputs.forEach(inputId => {
  const input = document.getElementById(inputId)
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') externalSearch()
    })
    input.addEventListener('input', () => {
      debouncedExternalSearch()
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

// Cache interne pour les images d'albums (servies par l'API locale)
let albumImagesCache = null
let albumImagesPromise = null

async function loadAlbumImages() {
  if (albumImagesCache) return albumImagesCache
  if (albumImagesPromise) return albumImagesPromise

  albumImagesPromise = fetch('/album-images')
    .then(async (res) => {
      if (!res.ok) throw new Error('Réponse /album-images inattendue: ' + res.status)
      const payload = await res.json()
      const imgs = (payload && payload.images) || []
      albumImagesCache = imgs.map((img, idx) => ({
        title: img.title || 'Album ' + (idx + 1),
        cover: img.url || '',
        link: img.url || '',
        url: img.url || '',
      })).filter(x => x.cover)
      return albumImagesCache
    })
    .catch(err => {
      console.error('Impossible de charger /album-images', err)
      albumImagesCache = []
      return albumImagesCache
    })
  return albumImagesPromise
}

// Render album covers grid
function renderAlbumCovers(albums, out) {
  if (!out) return
  if (!albums || albums.length === 0) {
    out.innerHTML = '<p>Aucune pochette trouvée pour cet artiste</p>'
    return
  }

  const html = '<div class="album-grid">' + albums.map(a => {
    return '<figure class="album-card">' +
      '<a href="' + (a.link || '#') + '" target="_blank" rel="noreferrer noopener">' +
        '<img src="' + a.cover + '" alt="' + a.title + '">' +
      '</a>' +
      '<figcaption>' + a.title + '</figcaption>' +
    '</figure>'
  }).join('') + '</div>'

  out.innerHTML = html
}

// Render background animated columns with album images
function renderBackgroundImages(images) {
  const columns = document.querySelectorAll('.bg-scrolling')
  if (!columns || columns.length === 0) return

  const imgs = images && images.length ? images : []
  if (imgs.length === 0) return

  // Ensure enough items to fill animation smoothly
  const perCol = 10
  const needed = perCol * columns.length
  const expanded = []
  for (let i = 0; i < needed; i++) {
    expanded.push(imgs[i % imgs.length])
  }

  columns.forEach((col, idx) => {
    const slice = expanded.filter((_, i) => i % columns.length === idx)
    col.innerHTML = slice.map(img => {
      const alt = img.title || 'Image'
      return '<div><img src="' + img.url + '" alt="' + alt + '"></div>'
    }).join('')
  })
}

// On load: hydrate background and album grid
window.addEventListener('load', () => {
  loadAlbumImages()
    .then((imgs) => {
      try { renderBackgroundImages(imgs) } catch (e) { console.error('BG render error', e) }
      const out = document.getElementById('albums')
      if (out) {
        const toShow = imgs.slice(0, 12)
        try { renderAlbumCovers(toShow, out) } catch (e) { console.error('Albums render error', e) }
      }
    })
    .catch(err => console.error('Impossible de charger les images', err))
})