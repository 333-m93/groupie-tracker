// Minimal JS (no API calls): client-side filter of artist cards
(function () {
  function debounce(fn, delay) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay) }
  }

  // Mock data with artist info for filtering
  const artistData = {
    'pnl': { year: 2015, members: 2, genre: 'Hip-hop français' },
    'tyler, the creator': { year: 2007, members: 1, genre: 'Hip-hop alternatif' },
    'billie eilish': { year: 2015, members: 1, genre: 'Pop alternative' },
    'beabadoobee': { year: 2013, members: 1, genre: 'Indie rock' }
  }

  function getArtistKey(cardText) {
    const title = cardText.toLowerCase()
    for (const key in artistData) {
      if (title.includes(key)) return key
    }
    return null
  }

  function filterArtistCards() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase()
    const year = document.getElementById('filter-creation-date')?.value
    const members = document.getElementById('filter-members')?.value
    const genre = (document.getElementById('filter-genre')?.value || '').toLowerCase()

    const cards = document.querySelectorAll('#artist-playlist-container .artist-info-card')
    cards.forEach(card => {
      const text = card.textContent.toLowerCase()
      const key = getArtistKey(text)
      const data = key ? artistData[key] : null

      let matches = !query || text.includes(query)
      if (year && data && data.year !== parseInt(year, 10)) matches = false
      if (members && data && data.members !== parseInt(members, 10)) matches = false
      if (genre && data && !data.genre.toLowerCase().includes(genre)) matches = false

      card.style.display = matches ? '' : 'none'
    })
  }

  // Search input debounced
  const input = document.getElementById('search-input')
  const btn = document.getElementById('search-button')
  const debounced = debounce(filterArtistCards, 300)

  if (input) input.addEventListener('input', debounced)
  if (btn) btn.addEventListener('click', filterArtistCards)

  // Toggle advanced filters
  const toggleBtn = document.getElementById('toggle-filters-btn')
  const filterContainer = document.getElementById('search-container')
  const advancedFilters = document.getElementById('advanced-filters')

  if (toggleBtn && advancedFilters) {
    toggleBtn.addEventListener('click', () => {
      advancedFilters.classList.toggle('hidden')
      filterContainer.classList.toggle('expanded')
    })
  }

  // Trigger filter on filter input changes
  const filterInputs = ['filter-creation-date', 'filter-members', 'filter-genre']
  filterInputs.forEach(id => {
    const el = document.getElementById(id)
    if (el) el.addEventListener('change', filterArtistCards)
    if (el) el.addEventListener('input', debounced)
  })
})()
