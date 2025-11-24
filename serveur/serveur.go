package serveur

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"time"
)

// Start launches the HTTP server and blocks until shutdown.
func Start(addr string) {
	mux := http.NewServeMux()

	// Serve the search UI from the folder `Barre de recherche`
	fs := http.FileServer(http.Dir("./Barre de recherche"))
	// root serves index.html
	mux.Handle("/", fs)

	// Static assets (if referenced with /static/ in the HTML)
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./Barre de recherche/static"))))

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
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(artists)
	})

	// Search endpoint: GET /search?q=term
	mux.HandleFunc("/search", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
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

	// External search proxy to Ticketmaster Discovery API
	// Requires environment variable TICKETMASTER_API_KEY to be set.
	mux.HandleFunc("/external-search", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		q := r.URL.Query().Get("q")
		if q == "" {
			http.Error(w, "missing query parameter 'q'", http.StatusBadRequest)
			return
		}

		apiKey := os.Getenv("TICKETMASTER_API_KEY")
		if apiKey == "" {
			http.Error(w, "server misconfigured: missing TICKETMASTER_API_KEY", http.StatusInternalServerError)
			return
		}

		// Build Ticketmaster Discovery API URL
		tmURL := "https://app.ticketmaster.com/discovery/v2/events.json"
		vals := url.Values{}
		vals.Set("keyword", q)
		vals.Set("locale", "fr-FR")
		vals.Set("apikey", apiKey)
		vals.Set("size", "10")

		fullURL := tmURL + "?" + vals.Encode()

		// Create request with short timeout
		client := &http.Client{Timeout: 10 * time.Second}
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, fullURL, nil)
		if err != nil {
			http.Error(w, "failed to create request", http.StatusInternalServerError)
			return
		}

		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, "failed to contact Ticketmaster", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		// Forward status code
		if resp.StatusCode != http.StatusOK {
			// copy response body for debugging
			w.WriteHeader(http.StatusBadGateway)
			io.Copy(w, resp.Body)
			return
		}

		// Stream the JSON response back to the client
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if _, err := io.Copy(w, resp.Body); err != nil {
			log.Printf("failed to stream Ticketmaster response: %v", err)
		}
	})

	// Events endpoint (kept minimal)
	mux.HandleFunc("/events", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
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
	// simple ASCII case-insensitive contains
	if len(sub) == 0 {
		return true
	}
	S := []rune(s)
	subR := []rune(sub)
	// lower both
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
	return len(subLower) <= len(sLower) && (indexOf(sLower, subLower) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
