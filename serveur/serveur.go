package serveur

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"
)

// Start launches the HTTP server and blocks until shutdown.
func Start(addr string) {
	mux := http.NewServeMux()

	// Serve the Front-End at root
	mux.Handle("/", http.FileServer(http.Dir("./Front-End")))

	// Serve Back-End static assets (CSS/JS/JSON)
	mux.Handle("/Back-End/", http.StripPrefix("/Back-End/", http.FileServer(http.Dir("./Back-End"))))

	// Carousel images API backed by JSON (see carousel.go)
	mux.HandleFunc("/album-images", HandleAlbumImages)

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
