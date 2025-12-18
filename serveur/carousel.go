package serveur

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

// AlbumImage represents one carousel image item
type AlbumImage struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Photo string `json:"photo"`
}

type albumsFile struct {
	Albums []AlbumImage `json:"albums"`
}

// GetAlbumImages loads images from JSON file and returns them.
// Falls back to empty list if file is missing or invalid (and logs the error).
func GetAlbumImages() []AlbumImage {
	const jsonPath = "./Back-End/albums_api.json"
	f, err := os.Open(jsonPath)
	if err != nil {
		log.Printf("carousel: cannot open %s: %v", jsonPath, err)
		return []AlbumImage{}
	}
	defer f.Close()
	var af albumsFile
	if err := json.NewDecoder(f).Decode(&af); err != nil {
		log.Printf("carousel: invalid JSON in %s: %v", jsonPath, err)
		return []AlbumImage{}
	}
	return af.Albums
}

// HandleAlbumImages serves the /album-images endpoint
func HandleAlbumImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "méthode non autorisée", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"images": GetAlbumImages()})
}
