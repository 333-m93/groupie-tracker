package main

import (
	"fmt"
	"log"
	"os"

	"github.com/Mebrouk-Mohammed/groupie-tracker/server"
)

func main() {
	// Déterminer le port à utiliser
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := fmt.Sprintf(":%s", port)
	
	log.Printf("🚀 Serveur démarré sur http://localhost%s\n", addr)
	log.Println("Appuyez sur Ctrl+C pour arrêter le serveur")
	
	// Démarrer le serveur (bloque jusqu'à l'arrêt)
	server.Start(addr)
}
