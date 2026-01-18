package main

import (
	"fmt"
	"os"

	"github.com/Mebrouk-Mohammed/groupie-tracker/serveur"
)

func main() {
	// Render injecte PORT ; fallback local 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	serveur.Start(fmt.Sprintf(":%s", port))
}
