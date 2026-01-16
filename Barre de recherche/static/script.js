/**
 * SpotMyArtist - Groupie Tracker API Integration
 * Charge les artistes depuis l'API tout en gardant le style original
 */

(function () {
  // ===== CONSTANTS =====
  const DEBOUNCE_DELAY = 300;
  const API_BASE = '';
  
  // Cache des artistes
  let allArtists = [];

  // ===== UTILITY FUNCTIONS =====

  /**
   * Debounce function to limit function calls
   */
  function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Charger tous les artistes depuis l'API
   */
  async function loadArtists() {
    try {
      const response = await fetch('/artists');
      if (!response.ok) throw new Error('Erreur de chargement');
      
      allArtists = await response.json();
      renderArtists(allArtists);
      updateBackgroundCarousel(allArtists);
    } catch (error) {
      console.error('Erreur lors du chargement des artistes:', error);
    }
  }

  /**
   * Mettre à jour le carrousel de fond avec les images des artistes de l'API
   */
  function updateBackgroundCarousel(artists) {
    const columns = document.querySelectorAll('.bg-scrolling');
    if (!columns || columns.length === 0) return;

    // Filtrer les artistes qui ont une image
    const artistsWithImages = artists.filter(a => a.image);
    if (artistsWithImages.length === 0) return;

    // Créer un tableau d'images suffisant pour toutes les colonnes
    const imagesPerColumn = 10;
    const totalNeeded = imagesPerColumn * columns.length;
    const expandedImages = [];
    
    for (let i = 0; i < totalNeeded; i++) {
      expandedImages.push(artistsWithImages[i % artistsWithImages.length]);
    }

    // Remplir chaque colonne
    columns.forEach((column, colIndex) => {
      const columnImages = [];
      for (let i = colIndex; i < expandedImages.length; i += columns.length) {
        columnImages.push(expandedImages[i]);
      }

      column.innerHTML = columnImages.map(artist => `
        <div>
          <img src="${artist.image}" 
               alt="${artist.name}"
               onerror="this.parentElement.style.display='none'">
        </div>
      `).join('');
    });
  }

  /**
   * Afficher les artistes dans les cartes
   */
  function renderArtists(artists) {
    const container = document.getElementById('artists-container');
    if (!container) return;

    if (!artists || artists.length === 0) {
      container.innerHTML = '<p>Aucun artiste trouvé</p>';
      return;
    }

    container.innerHTML = artists.map(artist => `
      <div class="artist-info-card" data-artist-id="${artist.id}" style="cursor: pointer;">
        <img class="artist-photo" 
             src="${artist.image || '/static/default.jpg'}" 
             alt="${artist.name}"
             onerror="this.src='/static/default.jpg'">
        <h3>${artist.name}</h3>
        <p>${artist.members ? artist.members.length + ' membre(s)' : ''}</p>
        <p>${artist.creationDate ? 'Créé en ' + artist.creationDate : ''}</p>
      </div>
    `).join('');

    // Ajouter les événements de clic immédiatement après le rendu
    setTimeout(() => {
      const cards = document.querySelectorAll('.artist-info-card');
      cards.forEach(card => {
        card.addEventListener('click', async function(e) {
          e.stopPropagation();
          const artistId = this.getAttribute('data-artist-id');
          if (artistId) {
            await showArtistDetails(artistId);
          }
        });
      });
    }, 0);
  }

  /**
   * Afficher les détails d'un artiste dans une modal
   */
  async function showArtistDetails(artistId) {
    try {
      const response = await fetch('/artist/' + artistId);
      if (!response.ok) throw new Error('Erreur de chargement');
      
      const artist = await response.json();
      showArtistModal(artist);
    } catch (error) {
      console.error('Erreur:', error);
    }
  }

  /**
   * Charger les lieux des concerts depuis l'API
   */
  async function loadLocations(artistId) {
    try {
      // Récupérer toutes les locations
      const response = await fetch('/locations');
      if (!response.ok) throw new Error('Erreur de chargement des locations');
      
      const allLocations = await response.json();
      
      if (!allLocations || !Array.isArray(allLocations)) {
        console.log('Format locations non reconnu:', allLocations);
        return [];
      }
      
      // Chercher les locations pour cet artiste par ID
      for (let loc of allLocations) {
        if (loc && loc.id === parseInt(artistId)) {
          console.log('Locations trouvées pour artiste', artistId, ':', loc.locations);
          return loc.locations || [];
        }
      }
      
      console.log('Pas de locations trouvées pour artistId:', artistId);
      return [];
    } catch (error) {
      console.error('Erreur lors du chargement des locations:', error);
      return [];
    }
  }

  /**
   * Parser une coordonnée de location (ex: "Paris, France")
   * Utilise Nominatim pour géocoder
   */
  async function geocodeLocation(locationName) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json`
      );
      if (!response.ok) return null;
      
      const results = await response.json();
      if (results.length === 0) return null;
      
      const result = results[0];
      return {
        name: locationName,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
    } catch (error) {
      console.error('Erreur geocodage:', error);
      return null;
    }
  }

  /**
   * Afficher une carte avec les lieux des concerts
   */
  async function showLocationMap(artist) {
    // Récupérer les locations
    const locations = await loadLocations(artist.id);
    
    if (!locations || locations.length === 0) {
      alert('Aucun lieu de concert trouvé pour cet artiste');
      return;
    }

    // Créer la modal
    const modal = document.createElement('div');
    modal.className = 'location-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1001;
      padding: 20px;
      backdrop-filter: blur(5px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: rgba(240, 240, 240, 0.98);
      backdrop-filter: blur(10px);
      padding: 0;
      border-radius: 20px;
      max-width: 1000px;
      width: 90vw;
      height: 90vh;
      position: relative;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    `;

    // Bouton fermer
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      position: absolute;
      top: 15px;
      right: 15px;
      background: rgba(0,0,0,0.2);
      border: none;
      font-size: 28px;
      cursor: pointer;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      color: #333;
      font-weight: bold;
      z-index: 1002;
      transition: background 0.2s;
    `;
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => modal.remove());
    closeBtn.addEventListener('mouseover', () => closeBtn.style.background = 'rgba(0,0,0,0.3)');
    closeBtn.addEventListener('mouseout', () => closeBtn.style.background = 'rgba(0,0,0,0.2)');

    // Conteneur pour la carte
    const mapContainer = document.createElement('div');
    mapContainer.id = 'artist-concert-map-' + artist.id;
    mapContainer.style.cssText = `
      flex: 1;
      min-height: 400px;
      border-radius: 20px;
      overflow: hidden;
    `;

    // Header avec titre
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      background: rgba(255, 255, 255, 0.5);
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    `;
    header.innerHTML = `
      <h2 style="margin: 0; color: #222; font-family: 'Franklin Gothic Medium', Arial, sans-serif;">
        Lieux de concert - ${artist.name}
      </h2>
      <p style="margin: 5px 0 0 0; color: #666; font-size: 0.95rem;">
        ${locations.length} localisation${locations.length > 1 ? 's' : ''}
      </p>
    `;

    modalContent.appendChild(header);
    modalContent.appendChild(mapContainer);
    modalContent.appendChild(closeBtn);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Initialiser la carte Leaflet
    setTimeout(async () => {
      try {
        const map = L.map(mapContainer.id).setView([48.8566, 2.3522], 3);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // Géocoder et ajouter les marqueurs
        const bounds = L.latLngBounds();
        
        for (const location of locations) {
          const coords = await geocodeLocation(location);
          if (coords) {
            const marker = L.circleMarker([coords.lat, coords.lng], {
              radius: 8,
              fillColor: '#93C5FD',
              color: '#1E40AF',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            });
            
                       marker.bindPopup(`
              <div style="
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                padding: 12px 16px;
                min-width: 200px;
                max-width: 300px;
              ">
                <div style="
                  font-size: 16px;
                  font-weight: 600;
                  color: #1E40AF;
                  margin-bottom: 8px;
                  border-bottom: 2px solid #93C5FD;
                  padding-bottom: 6px;
                ">
                  📍 ${coords.name}
                </div>
                <div style="
                  font-size: 13px;
                  color: #4B5563;
                  margin-top: 8px;
                  line-height: 1.5;
                ">
                  Lieu de concert
                </div>
              </div>
            `, {
              maxWidth: 300,
              className: 'custom-popup'
            });
            
            marker.addTo(map);
            bounds.extend([coords.lat, coords.lng]);
          }
        }

        // Adapter la vue pour afficher tous les marqueurs
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error('Erreur lors de l\'affichage de la carte:', error);
        mapContainer.innerHTML = '<p style="padding: 20px; color: #666;">Erreur lors du chargement de la carte</p>';
      }
    }, 100);

    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Afficher une modal avec les détails de l'artiste
   */
  function showArtistModal(artist) {
    // Créer la modal
    const modal = document.createElement('div');
    modal.className = 'artist-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
      backdrop-filter: blur(5px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: rgba(240, 240, 240, 0.95);
      backdrop-filter: blur(10px);
      padding: 40px;
      border-radius: 20px;
      max-width: 900px;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    `;
    
    let concertsHtml = '';
    if (artist.concertInfo && artist.concertInfo.length > 0) {
      concertsHtml = '<h3 style="color: #222; margin-top: 20px;">Concerts à venir</h3><ul style="list-style: none; padding: 0;">';
      artist.concertInfo.forEach(concert => {
        concert.dates.forEach(date => {
          concertsHtml += `<li style="padding: 8px; background: rgba(255,255,255,0.3); margin: 5px 0; border-radius: 8px;">${date} - ${concert.location}</li>`;
        });
      });
      concertsHtml += '</ul>';
    }

    const mapButtonHtml = '<button id="show-map-btn" style="margin-top: 20px; padding: 10px 20px; background: #4a90e2; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;">🗺️ Voir les lieux de concert</button>';

    modalContent.innerHTML = `
      <button onclick="this.closest('.artist-modal').remove()" style="
        position: absolute;
        top: 15px;
        right: 15px;
        background: rgba(0,0,0,0.2);
        border: none;
        font-size: 28px;
        cursor: pointer;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        color: #333;
        font-weight: bold;
        transition: background 0.2s;
      " onmouseover="this.style.background='rgba(0,0,0,0.3)'" onmouseout="this.style.background='rgba(0,0,0,0.2)'">×</button>
      
      <div style="display: flex; gap: 30px; align-items: flex-start; flex-wrap: wrap;">
        ${artist.image ? `
          <img src="${artist.image}" alt="${artist.name}" style="
            width: 300px;
            height: 300px;
            object-fit: cover;
            border-radius: 15px;
            flex-shrink: 0;
          " onerror="this.style.display='none'">
        ` : ''}
        
        <div style="flex: 1; min-width: 300px;">
          <h2 style="margin-top: 0; font-size: 2.5rem; color: #222; font-family: 'Franklin Gothic Medium', Arial, sans-serif;">${artist.name}</h2>
          ${artist.creationDate ? `<p style="font-size: 1.1rem; color: #444;"><strong>Année de création:</strong> ${artist.creationDate}</p>` : ''}
          ${artist.firstAlbum ? `<p style="font-size: 1.1rem; color: #444;"><strong>Premier album:</strong> ${artist.firstAlbum}</p>` : ''}
          ${artist.members && artist.members.length > 0 ? `
            <p style="font-size: 1.1rem; color: #444;"><strong>Membres:</strong></p>
            <ul style="margin: 5px 0; color: #555;">
              ${artist.members.map(m => `<li>${m}</li>`).join('')}
            </ul>
          ` : ''}
          ${concertsHtml}
          ${mapButtonHtml}
        </div>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Attacher l'événement du bouton carte
    const mapBtn = modalContent.querySelector('#show-map-btn');
    if (mapBtn) {
      mapBtn.addEventListener('click', () => {
        showLocationMap(artist);
      });
    }
    
    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Filtrer les artistes
   */
  function filterArtists() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const year = document.getElementById('filter-creation-date')?.value;
    const members = document.getElementById('filter-members')?.value;
    const genre = (document.getElementById('filter-genre')?.value || '').toLowerCase();

    let filtered = allArtists;

    // Filtrer par nom
    if (query) {
      filtered = filtered.filter(artist => 
        artist.name.toLowerCase().includes(query)
      );
    }

    // Filtrer par année
    if (year) {
      filtered = filtered.filter(artist => 
        artist.creationDate === parseInt(year, 10)
      );
    }

    // Filtrer par nombre de membres
    if (members) {
      filtered = filtered.filter(artist => 
        artist.members && artist.members.length === parseInt(members, 10)
      );
    }

    renderArtists(filtered);
  }

  // ===== DOM ELEMENTS =====
  const searchInput = document.getElementById('search-input');
  const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
  const searchContainer = document.getElementById('search-container');
  const advancedFilters = document.getElementById('advanced-filters');

  // ===== EVENT LISTENERS =====

  // Search input: debounced filtering
  if (searchInput) {
    const debouncedFilter = debounce(filterArtists, DEBOUNCE_DELAY);
    searchInput.addEventListener('input', debouncedFilter);
  }

  // Toggle filters visibility
  if (toggleFiltersBtn && advancedFilters) {
    toggleFiltersBtn.addEventListener('click', () => {
      advancedFilters.classList.toggle('hidden');
      if (searchContainer) {
        searchContainer.classList.toggle('expanded');
      }
      toggleFiltersBtn.textContent = advancedFilters.classList.contains('hidden') 
        ? 'Filtres' 
        : 'Masquer filtres';
    });
  }

  // Filter inputs
  const filterInputIds = ['filter-creation-date', 'filter-members', 'filter-genre'];
  filterInputIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', filterArtists);
      element.addEventListener('input', debounce(filterArtists, DEBOUNCE_DELAY));
    }
  });

  // ===== INITIALIZATION =====
  // Charger les artistes au chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadArtists);
  } else {
    loadArtists();
  }
})();