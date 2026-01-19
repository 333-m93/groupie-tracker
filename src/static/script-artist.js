/**
 * Artist page - Dynamic content loading
 */
'use strict';

const ARTIST_DATA = {
  'pnl': {
    name: 'PNL',
    image: './static/pnl.jpg',
    genre: 'Hip-hop français',
    year: 2015,
    members: 2,
    origin: 'Corbeil-Essonnes, France',
    description: 'Le duo Ademo et N.O.S a popularisé un cloud rap planant mêlé d\'autotune et d\'images cinématographiques.'
  },
  'tyler-the-creator': {
    name: 'Tyler, The Creator',
    image: './static/tyler.jpg',
    genre: 'Hip-hop alternatif',
    year: 2007,
    members: 1,
    origin: 'Los Angeles, USA',
    description: 'Producteur, rappeur et designer, Tyler passe du chaos d\'Odd Future aux arrangements jazz-pop d\'Igor et Call Me If You Get Lost.'
  },
  'billie-eilish': {
    name: 'Billie Eilish',
    image: './static/billie.jpg',
    genre: 'Pop alternative',
    year: 2015,
    members: 1,
    origin: 'Los Angeles, USA',
    description: 'Billie réinvente la pop avec des murmures intimes, des basses trap et un univers visuel cinématographique en tandem avec Finneas.'
  },
  'beabadoobee': {
    name: 'Beabadoobee',
    image: './static/beabadoobee.jpg',
    genre: 'Indie rock',
    year: 2013,
    members: 1,
    origin: 'Londres, UK',
    description: 'Entre grunge années 90 et bedroom pop, Bea Kristi livre des hymnes lo-fi portés par des guitares saturées et des mélodies sucrées.'
  }
};

// Récupérer le paramètre de l'URL
const urlParams = new URLSearchParams(window.location.search);
const artistId = urlParams.get('name');
const artist = ARTIST_DATA[artistId];

function displayArtist(artistData) {
  if (!artistData) {
    document.getElementById('artist-title').textContent = 'Artiste non trouvé';
    document.getElementById('artist-info').innerHTML = '<p>Cet artiste n\'existe pas.</p>';
    return;
  }

  document.title = `${artistData.name} - SpotMyArtist`;
  document.getElementById('artist-title').textContent = artistData.name;
  
  const img = document.getElementById('artist-image');
  img.src = artistData.image;
  img.alt = artistData.name;
  
  const infoDiv = document.getElementById('artist-info');
  infoDiv.innerHTML = `
    <p><strong>Genre:</strong> ${escapeHtml(artistData.genre)}</p>
    <p><strong>Année de création:</strong> ${artistData.year}</p>
    <p><strong>Membres:</strong> ${artistData.members}</p>
    <p><strong>Origine:</strong> ${escapeHtml(artistData.origin)}</p>
    <p>${escapeHtml(artistData.description)}</p>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

displayArtist(artist);