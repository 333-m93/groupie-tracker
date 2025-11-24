package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "time"
)

// Minimal data types
type Artist struct {
    ID        int    `json:"id"`
    Name      string `json:"name"`
    YearStart int    `json:"year_start,omitempty"`
}

type EventRequest struct {
    Action string                 `json:"action"`
    Data   map[string]interface{} `json:"data,omitempty"`
}

type EventResponse struct {
    Status    string                 `json:"status"`
    Action    string                 `json:"action,omitempty"`
    Received  map[string]interface{} `json:"received,omitempty"`
    Timestamp int64                  `json:"timestamp"`
}

func main() {
    mux := http.NewServeMux()

    // Routes
    mux.HandleFunc("/", rootHandler)
    mux.HandleFunc("/health", healthHandler)
    mux.HandleFunc("/artists", artistsHandler)
    mux.HandleFunc("/events", eventsHandler)

    srv := &http.Server{
        Addr:    ":8080",
        Handler: mux,
    }

    // Start server in background
    go func() {
        log.Printf("Server starting on %s", srv.Addr)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("ListenAndServe(): %v", err)
        }
    }()

    // Wait for interrupt signal to gracefully shutdown the server
    stop := make(chan os.Signal, 1)
    signal.Notify(stop, os.Interrupt)

    <-stop
    log.Println("Shutting down server...")

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        log.Fatalf("Server Shutdown Failed:%+v", err)
    }

    log.Println("Server exited properly")
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    fmt.Fprintln(w, "Groupie Tracker — Serveur Go (minimal)")
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json; charset=utf-8")
    _ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func artistsHandler(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodGet:
        w.Header().Set("Content-Type", "application/json; charset=utf-8")
        artists := []Artist{}
        if err := json.NewEncoder(w).Encode(artists); err != nil {
            http.Error(w, "failed to encode response", http.StatusInternalServerError)
            return
        }
    default:
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
    }
}

func eventsHandler(w http.ResponseWriter, r *http.Request) {
    switch r.Method {
    case http.MethodPost:
        var ev EventRequest
        dec := json.NewDecoder(r.Body)
        dec.DisallowUnknownFields()
        if err := dec.Decode(&ev); err != nil {
            http.Error(w, "bad request: invalid JSON", http.StatusBadRequest)
            return
        }

        resp := EventResponse{
            Status:    "ok",
            Action:    ev.Action,
            Received:  ev.Data,
            Timestamp: time.Now().Unix(),
        }
        w.Header().Set("Content-Type", "application/json; charset=utf-8")
        if err := json.NewEncoder(w).Encode(resp); err != nil {
            http.Error(w, "failed to encode response", http.StatusInternalServerError)
            return
        }
    default:
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
    }
}
