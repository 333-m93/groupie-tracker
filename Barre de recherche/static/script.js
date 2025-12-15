
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





// On load: hydrate background with local album images
window.addEventListener('load', () => {
  loadAlbumImages()
    .then(imgs => renderBackgroundImages(imgs))
    .catch(err => console.error('Impossible de charger les images de fond', err))
})