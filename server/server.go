package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	neturl "net/url"
	"os"
	"os/signal"
	"strings"
	"sync"
	"time"
)

// GroupieArtist représente les données de l'API Groupie Tracker
type GroupieArtist struct {
	ID           int      `json:"id"`
	Image        string   `json:"image"`
	Name         string   `json:"name"`
	Members      []string `json:"members"`
	CreationDate int      `json:"creationDate"`
	FirstAlbum   string   `json:"firstAlbum"`
	Locations    string   `json:"locations"`
	ConcertDates string   `json:"concertDates"`
	Relations    string   `json:"relations"`
	Genre        string   `json:"genre"`
}

// Relations structure pour les relations dates-lieux
type Relations struct {
	ID             int                 `json:"id"`
	DatesLocations map[string][]string `json:"datesLocations"`
}

// Cache global pour les artistes
var (
	artistsCache       []GroupieArtist
	locationsCache     []map[string]interface{}
	relationsCache     []map[string]interface{}
	artistsCacheLock   sync.RWMutex
	locationsCacheLock sync.RWMutex
	relationsCacheLock sync.RWMutex
)

// Start launches the HTTP server and blocks until shutdown.
func Start(addr string) {
	mux := http.NewServeMux()

	// Charger les artistes de l'API au démarrage
	go loadGroupieArtists()

	// Serve the search UI from the folder `src`
	fs := http.FileServer(http.Dir("./src"))
	mux.Handle("/", fs)

	// Static assets (if referenced with /static/ in the HTML)
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./src/static"))))

	// Health endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Artists endpoint depuis Groupie Tracker API
	mux.HandleFunc("/artists", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}

		artistsCacheLock.RLock()
		artists := artistsCache
		artistsCacheLock.RUnlock()

		if len(artists) == 0 {
			// Essayer de recharger si le cache est vide
			loadGroupieArtists()
			artistsCacheLock.RLock()
			artists = artistsCache
			artistsCacheLock.RUnlock()
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(artists)
	})

	// Artist by ID endpoint
	mux.HandleFunc("/artist/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}

		// Extraire l'ID de l'URL
		idStr := strings.TrimPrefix(r.URL.Path, "/artist/")
		var id int
		fmt.Sscanf(idStr, "%d", &id)

		if id <= 0 {
			http.Error(w, "ID invalide", http.StatusBadRequest)
			return
		}

		artist, err := fetchArtistByID(id)
		if err != nil {
			http.Error(w, "Artiste non trouvé", http.StatusNotFound)
			return
		}

		// Récupérer les relations pour les dates de concert
		relations, _ := fetchRelations(id)

		// Créer une réponse enrichie
		type ArtistResponse struct {
			GroupieArtist
			ConcertInfo []struct {
				Location string   `json:"location"`
				Dates    []string `json:"dates"`
			} `json:"concertInfo,omitempty"`
		}

		response := ArtistResponse{
			GroupieArtist: artist,
		}

		if relations != nil && len(relations.DatesLocations) > 0 {
			for loc, dates := range relations.DatesLocations {
				response.ConcertInfo = append(response.ConcertInfo, struct {
					Location string   `json:"location"`
					Dates    []string `json:"dates"`
				}{
					Location: loc,
					Dates:    dates,
				})
			}
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(response)
	})

	// Search endpoint: GET /search?q=term
	mux.HandleFunc("/search", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}
		q := r.URL.Query().Get("q")

		artistsCacheLock.RLock()
		allArtists := artistsCache
		artistsCacheLock.RUnlock()

		results := []GroupieArtist{}
		if q != "" {
			for _, a := range allArtists {
				if containsIgnoreCase(a.Name, q) {
					results = append(results, a)
				}
			}
		} else {
			results = allArtists
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"results": results})
	})

	// External search endpoint expected by the frontend button
	// GET /external-search?q=term
	mux.HandleFunc("/external-search", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}
		type Image struct {
			URL string `json:"url"`
		}
		type Event struct {
			Date  string `json:"date,omitempty"`
			Venue string `json:"venue,omitempty"`
			Name  string `json:"name,omitempty"`
			URL   string `json:"url,omitempty"`
		}
		type ExtArtist struct {
			Name   string  `json:"name"`
			URL    string  `json:"url,omitempty"`
			Images []Image `json:"images,omitempty"`
			Events []Event `json:"events,omitempty"`
		}

		q := r.URL.Query().Get("q")

		artistsCacheLock.RLock()
		allArtists := artistsCache
		artistsCacheLock.RUnlock()

		var out []ExtArtist

		// Rechercher dans les artistes Groupie Tracker
		for _, a := range allArtists {
			if q == "" || containsIgnoreCase(a.Name, q) {
				extArtist := ExtArtist{
					Name: a.Name,
				}

				if a.Image != "" {
					extArtist.Images = []Image{{URL: a.Image}}
				}

				// Récupérer les relations pour les concerts
				relations, err := fetchRelations(a.ID)
				if err == nil && relations != nil {
					for loc, dates := range relations.DatesLocations {
						for _, date := range dates {
							extArtist.Events = append(extArtist.Events, Event{
								Date:  date,
								Venue: loc,
								Name:  a.Name + " Concert",
							})
						}
					}
				}

				out = append(out, extArtist)
			}
		}

		// Si aucun résultat dans Groupie Tracker, fallback sur Discogs
		if len(out) == 0 {
			artistsResp, err := discogsSearch(q)
			if err != nil {
				log.Printf("discogs search error: %v", err)
			}

			for _, a := range artistsResp {
				out = append(out, ExtArtist{
					Name: a.Name,
					URL:  a.ResourceURL,
					Images: func() []Image {
						if a.Thumb != "" {
							return []Image{{URL: a.Thumb}}
						}
						return nil
					}(),
				})
			}
		}

		// Fallback final aux images locales
		if len(out) == 0 && q != "" {
			// Si rien n'est trouvé, retourner un tableau vide
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"artists": out})
	})

	// Locations endpoint
	mux.HandleFunc("/locations", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}

		locationsCacheLock.RLock()
		locations := locationsCache
		locationsCacheLock.RUnlock()

		if len(locations) == 0 {
			loadLocations()
			locationsCacheLock.RLock()
			locations = locationsCache
			locationsCacheLock.RUnlock()
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(locations)
	})

	// Relations endpoint
	mux.HandleFunc("/relations", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}

		relationsCacheLock.RLock()
		relations := relationsCache
		relationsCacheLock.RUnlock()

		if len(relations) == 0 {
			loadRelations()
			relationsCacheLock.RLock()
			relations = relationsCache
			relationsCacheLock.RUnlock()
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(relations)
	})

	srv := &http.Server{Addr: addr, Handler: mux}

	// Start
	go func() {
		log.Printf("serveur: listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("serveur: ListenAndServe: %v", err)
		}
	}()

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	<-stop
	log.Println("serveur: shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("serveur: Shutdown: %v", err)
	}
	log.Println("serveur: exited")
}

// loadGroupieArtists charge les artistes depuis l'API Groupie Tracker
func loadGroupieArtists() {
	const apiURL = "https://groupietrackers.herokuapp.com/api/artists"

	resp, err := http.Get(apiURL)
	if err != nil {
		log.Printf("Erreur lors du chargement des artistes: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Code de statut inattendu: %d", resp.StatusCode)
		return
	}

	var artists []GroupieArtist
	if err := json.NewDecoder(resp.Body).Decode(&artists); err != nil {
		log.Printf("Erreur lors du décodage JSON: %v", err)
		return
	}

	// Assigner des genres aux artistes
	assignGenres(artists)

	artistsCacheLock.Lock()
	artistsCache = artists
	artistsCacheLock.Unlock()

	log.Printf("✓ %d artistes chargés depuis l'API Groupie Tracker", len(artists))
}

// loadLocations charge les lieux des concerts depuis l'API Groupie Tracker
func loadLocations() {
	const apiURL = "https://groupietrackers.herokuapp.com/api/locations"

	resp, err := http.Get(apiURL)
	if err != nil {
		log.Printf("Erreur lors du chargement des locations: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Code de statut inattendu: %d", resp.StatusCode)
		return
	}

	// L'API retourne: { "index": [ {...}, {...}, ... ] }
	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		log.Printf("Erreur lors du décodage JSON locations: %v", err)
		return
	}

	var locations []map[string]interface{}

	// Extraire le tableau "index" s'il existe
	if indexData, ok := response["index"]; ok {
		if arr, ok := indexData.([]interface{}); ok {
			for _, item := range arr {
				if m, ok := item.(map[string]interface{}); ok {
					locations = append(locations, m)
				}
			}
		}
	}

	locationsCacheLock.Lock()
	locationsCache = locations
	locationsCacheLock.Unlock()

	log.Printf("✓ %d locations chargées depuis l'API Groupie Tracker", len(locations))
}

// loadRelations charge les relations dates-lieux depuis l'API Groupie Tracker
func loadRelations() {
	const apiURL = "https://groupietrackers.herokuapp.com/api/relation"

	resp, err := http.Get(apiURL)
	if err != nil {
		log.Printf("Erreur lors du chargement des relations: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Code de statut inattendu: %d", resp.StatusCode)
		return
	}

	// L'API retourne: { "index": [ {...}, {...}, ... ] }
	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		log.Printf("Erreur lors du décodage JSON relations: %v", err)
		return
	}

	var relations []map[string]interface{}

	// Extraire le tableau "index" s'il existe
	if indexData, ok := response["index"]; ok {
		if arr, ok := indexData.([]interface{}); ok {
			for _, item := range arr {
				if m, ok := item.(map[string]interface{}); ok {
					relations = append(relations, m)
				}
			}
		}
	}

	relationsCacheLock.Lock()
	relationsCache = relations
	relationsCacheLock.Unlock()

	log.Printf("✓ %d relations chargées depuis l'API Groupie Tracker", len(relations))
}

// fetchArtistByID récupère un artiste spécifique par son ID
func fetchArtistByID(id int) (GroupieArtist, error) {
	url := fmt.Sprintf("https://groupietrackers.herokuapp.com/api/artists/%d", id)

	resp, err := http.Get(url)
	if err != nil {
		return GroupieArtist{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return GroupieArtist{}, fmt.Errorf("code de statut: %d", resp.StatusCode)
	}

	var artist GroupieArtist
	if err := json.NewDecoder(resp.Body).Decode(&artist); err != nil {
		return GroupieArtist{}, err
	}

	return artist, nil
}

// fetchRelations récupère les relations (dates-lieux) pour un artiste
func fetchRelations(artistID int) (*Relations, error) {
	url := fmt.Sprintf("https://groupietrackers.herokuapp.com/api/relation/%d", artistID)

	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("code de statut: %d", resp.StatusCode)
	}

	var relations Relations
	if err := json.NewDecoder(resp.Body).Decode(&relations); err != nil {
		return nil, err
	}

	return &relations, nil
}

// discogsSearch calls the Discogs database search API and returns normalized results.
// Uses the user-provided token. For simplicity, this searches type=artist by q.
type discogsResult struct {
	Name        string
	ResourceURL string
	Thumb       string
}

func discogsSearch(q string) ([]discogsResult, error) {
	token := "KRDsrkapunkrrKnOMADBDawunVlLPtqGpqRzXMfm" // Provided by user
	if token == "" {
		return nil, fmt.Errorf("discogs token missing")
	}
	reqURL := "https://api.discogs.com/database/search?type=artist&q=" + neturl.QueryEscape(q)
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Discogs token="+token)
	req.Header.Set("User-Agent", "GroupieTracker/1.0 +https://example.com")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("discogs status %d: %s", resp.StatusCode, string(b))
	}
	var payload struct {
		Results []struct {
			Title       string `json:"title"`
			ResourceURL string `json:"resource_url"`
			Thumb       string `json:"thumb"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	out := make([]discogsResult, 0, len(payload.Results))
	for _, r := range payload.Results {
		out = append(out, discogsResult{
			Name:        r.Title,
			ResourceURL: r.ResourceURL,
			Thumb:       r.Thumb,
		})
	}
	return out, nil
}

// containsIgnoreCase reports whether s contains sub case-insensitively.
func containsIgnoreCase(s, sub string) bool {
	if len(sub) == 0 {
		return true
	}
	S := []rune(s)
	subR := []rune(sub)
	for i := range S {
		if S[i] >= 'A' && S[i] <= 'Z' {
			S[i] = S[i] - 'A' + 'a'
		}
	}
	for i := range subR {
		if subR[i] >= 'A' && subR[i] <= 'Z' {
			subR[i] = subR[i] - 'A' + 'a'
		}
	}
	sLower := string(S)
	subLower := string(subR)
	return len(subLower) <= len(sLower) && indexOf(sLower, subLower) >= 0
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// assignGenres assigne des genres musicaux aux artistes en fonction de leur nom
func assignGenres(artists []GroupieArtist) {
	genreMap := map[string]string{
		"Queen":                       "Rock",
		"SOJA":                        "Reggae",
		"Pink Floyd":                  "Rock progressif",
		"Scorpions":                   "Heavy Metal",
		"XXXTentacion":                "Hip-Hop",
		"Mac Miller":                  "Hip-Hop/Rap",
		"Joyner Lucas":                "Hip-Hop/Rap",
		"Kendrick Lamar":              "Hip-Hop/Rap",
		"AC/DC":                       "Hard Rock",
		"Pearl Jam":                   "Grunge",
		"Katy Perry":                  "Pop",
		"Rihanna":                     "Pop/R&B",
		"Genesis":                     "Rock progressif",
		"Phil Collins":                "Rock/Pop",
		"Led Zeppelin":                "Hard Rock",
		"The Jimi Hendrix Experience": "Rock",
		"Bee Gees":                    "Disco",
		"Deep Purple":                 "Hard Rock",
		"Aerosmith":                   "Hard Rock",
		"Dire Straits":                "Rock",
		"Mamonas Assassinas":          "Rock/Samba",
		"Thirty Seconds to Mars":      "Rock alternatif",
		"Imagine Dragons":             "Pop Rock",
		"Juice Wrld":                  "Hip-Hop",
		"Logic":                       "Hip-Hop/Rap",
		"Alec Benjamin":               "Pop",
		"Bobby McFerrins":             "Jazz/Pop",
		"R3HAB":                       "EDM",
		"Post Malone":                 "Hip-Hop/Pop",
		"Travis Scott":                "Hip-Hop",
		"J. Cole":                     "Hip-Hop/Rap",
		"Nickelback":                  "Rock alternatif",
		"Mobb Deep":                   "Hip-Hop",
		"Guns N' Roses":               "Hard Rock",
		"NWA":                         "Hip-Hop",
		"U2":                          "Rock",
		"Arctic Monkeys":              "Rock indépendant",
		"Fall Out Boy":                "Pop Punk",
		"Gorillaz":                    "Alternative Hip-Hop",
		"Eagles":                      "Rock",
		"Linkin Park":                 "Rock alternatif",
		"Red Hot Chili Peppers":       "Funk Rock",
		"Eminem":                      "Hip-Hop",
		"Green Day":                   "Punk Rock",
		"Metallica":                   "Heavy Metal",
		"Coldplay":                    "Pop Rock",
		"Maroon 5":                    "Pop",
		"Twenty One Pilots":           "Alternative",
		"The Rolling Stones":          "Rock",
		"Muse":                        "Rock alternatif",
		"Foo Fighters":                "Rock alternatif",
		"The Chainsmokers":            "EDM/Pop",
	}

	for i := range artists {
		if genre, found := genreMap[artists[i].Name]; found {
			artists[i].Genre = genre
		} else {
			// Genre par défaut basé sur l'année de création
			if artists[i].CreationDate < 1980 {
				artists[i].Genre = "Classic Rock"
			} else if artists[i].CreationDate < 2000 {
				artists[i].Genre = "Rock"
			} else {
				artists[i].Genre = "Pop/Rock"
			}
		}
	}
}
