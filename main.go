package main

import (
	"fmt"
	"log"
	"os"

	"github.com/Mebrouk-Mohammed/groupie-tracker/server"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("🚀 Serveur démarré sur http://localhost:%s", port)
	server.Start(fmt.Sprintf(":%s", port))
}
