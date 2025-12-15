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

    // Static album images served from local assets
    type AlbumImage struct {
        Title string `json:"title"`
        URL   string `json:"url"`
    }
    albumImages := []AlbumImage{
        {Title: "PNL", URL: "/static/pnl.jpg"},
        {Title: "Laufey", URL: "/static/laufey.png"},
        {Title: "Boa", URL: "/static/boa.jpg"},
        {Title: "Gims", URL: "/static/gims.jpg"},
        {Title: "Hamza", URL: "/static/hamza.jpg"},
        {Title: "Tyler", URL: "/static/tyler.jpg"},
        {Title: "Beabadoobee", URL: "/static/beabadoobee.jpg"},
        {Title: "Billie", URL: "/static/billie.jpg"},
        {Title: "Bob Marley", URL: "/static/bob-marley.jpg"},
        {Title: "Imogen Heap", URL: "/static/imogen_heap.jpg"},
        {Title: "Melo", URL: "/static/Melo.jpg"},
        {Title: "Vespertine", URL: "/static/Vespertine.jpg"},
        {Title: "Spider-Man", URL: "/static/spider-man.jpg"},
        {Title: "Beabadoobee 2", URL: "/static/beabadoobee2.jpg"},
        {Title: "Cigarettes After Sex", URL: "/static/cigaretteaftersex.jpg"},
    }

    // Serve the search UI from the folder `Barre de recherche`
    fs := http.FileServer(http.Dir("./Barre de recherche"))
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

