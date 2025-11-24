package main

import "github.com/Mebrouk-Mohammed/groupie-tracker/serveur"

func main() {
	// Very minimal main: delegate all server logic to package serveur
	serveur.Start(":8080")
}
