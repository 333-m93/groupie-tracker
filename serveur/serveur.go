package serveur

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"time"
)

// Start launches the HTTP server and blocks until shutdown.
func Start(addr string) {
	mux := http.NewServeMux()

	// Load Ticketmaster API key once at startup (avoid prompting on every request)
	apiKey := loadAPIKey()

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

		// Parse Ticketmaster JSON and normalize artist information
		var tm map[string]interface{}
		dec := json.NewDecoder(resp.Body)
		if err := dec.Decode(&tm); err != nil {
			http.Error(w, "failed to decode Ticketmaster response", http.StatusBadGateway)
			return
		}

		// Collect artist info from events -> _embedded -> events -> _embedded -> attractions
		artistsMap := map[string]map[string]interface{}{}

		embed, _ := tm["_embedded"].(map[string]interface{})
		if embed != nil {
			events, _ := embed["events"].([]interface{})
			for _, evI := range events {
				ev, _ := evI.(map[string]interface{})
				// event basic info
				evName, _ := ev["name"].(string)
				evURL, _ := ev["url"].(string)

				// event date
				var evDate string
				if dates, ok := ev["dates"].(map[string]interface{}); ok {
					if start, ok := dates["start"].(map[string]interface{}); ok {
						if localDate, ok := start["localDate"].(string); ok {
							evDate = localDate
						}
					}
				}

				// venue and attractions
				venueName := ""
				var evEmbed map[string]interface{}
				if tmp, ok := ev["_embedded"].(map[string]interface{}); ok {
					evEmbed = tmp
					if venues, ok := evEmbed["venues"].([]interface{}); ok && len(venues) > 0 {
						if v, ok := venues[0].(map[string]interface{}); ok {
							if name, ok := v["name"].(string); ok {
								venueName = name
							}
						}
					}
					if atts, ok := evEmbed["attractions"].([]interface{}); ok {
						for _, aI := range atts {
							if a, ok := aI.(map[string]interface{}); ok {
								name, _ := a["name"].(string)
								if name == "" {
									continue
								}
								art := artistsMap[name]
								if art == nil {
									art = map[string]interface{}{"name": name, "url": a["url"], "images": []interface{}{}, "events": []interface{}{}}
									// images
									if imgs, ok := a["images"].([]interface{}); ok {
										art["images"] = imgs
									}
									artistsMap[name] = art
								}
								// append event
								evSummary := map[string]interface{}{"name": evName, "url": evURL, "date": evDate, "venue": venueName}
								artEvents, _ := art["events"].([]interface{})
								art["events"] = append(artEvents, evSummary)
							}
						}
					}
				}
			}
		}

		// Build response list
		artistsList := []interface{}{}
		for _, v := range artistsMap {
			artistsList = append(artistsList, v)
		}

		out := map[string]interface{}{"artists": artistsList}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if err := json.NewEncoder(w).Encode(out); err != nil {
			log.Printf("failed to encode normalized response: %v", err)
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

// loadAPIKey attempts to obtain the Ticketmaster API key from env, a local file, or
// interactively from stdin. If found it sets the process env so handlers can reuse it.
func loadAPIKey() string {
	if v := os.Getenv("TICKETMASTER_API_KEY"); strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}

	// try local file `ticketmaster.key`
	if b, err := os.ReadFile("ticketmaster.key"); err == nil {
		s := strings.TrimSpace(string(b))
		if s != "" {
			os.Setenv("TICKETMASTER_API_KEY", s)
			return s
		}
	}

	// interactive prompt (useful for `go run .` from a terminal)
	fmt.Print("Ticketmaster API key not set. Enter it now (or leave empty to skip): ")
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	line = strings.TrimSpace(line)
	if line != "" {
		os.Setenv("TICKETMASTER_API_KEY", line)
	}
	return line
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
