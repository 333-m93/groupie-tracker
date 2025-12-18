package serveur

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"
)

// Start launches the HTTP server and blocks until shutdown.
func Start(addr string) {
	mux := http.NewServeMux()

	// Album Image structure with ID, Name, and Photo URL
	type AlbumImage struct {
		ID    int    `json:"id"`
		Name  string `json:"name"`
		Photo string `json:"photo"`
	}
	albumImages := []AlbumImage{
		{ID: 1, Name: "PNL", Photo: "/static-carrousel/pnl.jpg"},
		{ID: 2, Name: "Laufey", Photo: "/static-carrousel/laufey.png"},
		{ID: 3, Name: "Boa", Photo: "/static-carrousel/boa.jpg"},
		{ID: 4, Name: "Gims", Photo: "/static-carrousel/gims.jpg"},
		{ID: 5, Name: "Hamza", Photo: "/static-carrousel/hamza.jpg"},
		{ID: 6, Name: "Tyler", Photo: "/static-carrousel/tyler.jpg"},
		{ID: 7, Name: "Beabadoobee", Photo: "/static-carrousel/beabadoobee.jpg"},
		{ID: 8, Name: "Billie", Photo: "/static-carrousel/billie.jpg"},
		{ID: 9, Name: "Bob Marley", Photo: "/static-carrousel/bob-marley.jpg"},
		{ID: 10, Name: "Imogen Heap", Photo: "/static-carrousel/imogen_heap.jpg"},
		{ID: 11, Name: "Melo", Photo: "/static-carrousel/Melo.jpg"},
		{ID: 12, Name: "Vespertine", Photo: "/static-carrousel/Vespertine.jpg"},
		{ID: 13, Name: "Spider-Man", Photo: "/static-carrousel/spider-man.jpg"},
		{ID: 14, Name: "Beabadoobee 2", Photo: "/static-carrousel/beabadoobee2.jpg"},
		{ID: 15, Name: "Cigarettes After Sex", Photo: "/static-carrousel/cigaretteaftersex.jpg"},
	}

	// Serve the search UI from Front-End
	fs := http.FileServer(http.Dir("./Front-End"))
	mux.Handle("/", fs)

	// Static assets for carousel images
	mux.Handle("/static-carrousel/", http.StripPrefix("/static-carrousel/", http.FileServer(http.Dir("./Front-End/static-carrousel"))))

	// Static assets for home page
	mux.Handle("/static-home-page/", http.StripPrefix("/static-home-page/", http.FileServer(http.Dir("./Front-End/static-home-page"))))

	// Back-End assets (CSS, JS)
	mux.Handle("/Back-End/", http.StripPrefix("/Back-End/", http.FileServer(http.Dir("./Back-End"))))

	// Health endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// In-memory sample artists to search
	type Artist struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	artists := []Artist{
		{ID: 1, Name: "The Rolling Codes"},
		{ID: 2, Name: "Null Pointer Sisters"},
		{ID: 3, Name: "Golang Orchestra"},
		{ID: 4, Name: "Async & The Awaiters"},
	}

	// Artists endpoint (list)
	mux.HandleFunc("/artists", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(artists)
	})

	// Search endpoint: GET /search?q=term
	mux.HandleFunc("/search", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}
		q := r.URL.Query().Get("q")
		results := []Artist{}
		if q != "" {
			for _, a := range artists {
				if containsIgnoreCase(a.Name, q) {
					results = append(results, a)
				}
			}
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"results": results})
	})

	// Search endpoint using only local data
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

		var out []ExtArtist
		
		// Search in local album images
		for _, ai := range albumImages {
			if q == "" || containsIgnoreCase(ai.Name, q) {
				out = append(out, ExtArtist{Name: ai.Name, Images: []Image{{URL: ai.Photo}}})
			}
		}
		
		// If nothing found in album images, search in artists
		if len(out) == 0 {
			for _, a := range artists {
				if q == "" || containsIgnoreCase(a.Name, q) {
					out = append(out, ExtArtist{Name: a.Name})
				}
			}
		}

		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"artists": out})
	})

	// --- Discogs client ---

	// Internal album images API (no external calls)
	mux.HandleFunc("/album-images", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"images": albumImages})
	})

	// Events endpoint (kept minimal)
	mux.HandleFunc("/events", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
			return
		}
		var payload map[string]interface{}
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&payload); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		resp := map[string]interface{}{
			"status":    "ok",
			"received":  payload,
			"timestamp": time.Now().Unix(),
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(resp)
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
