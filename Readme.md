# 🎵 MusicPlayer

A personal web-based music player built with **HTML, CSS and JavaScript**, powered by JSON song libraries and a set of Python / HTML helper tools that generate and manage the song data.

> ⚠️ **Personal project.** This repository was built for personal use. Please do not copy or reuse the code. See [License & Usage](#-license--usage).

---

## ✨ Features

- 🎧 Browse and play songs loaded from JSON data files
- 🖥️ Clean, responsive player interface (`index.html` + `style.css`)
- 📂 Song library split across multiple JSON files and merged into one
- 🎤 Helper page to fetch artist details
- 📝 Helper page to generate song names
- ⬆️ Upload page for adding new songs
- 🐍 Python scripts to generate and merge song data
- 🔐 Environment variables kept out of the code via `.env`

> Adjust this list to match exactly what your player supports (search, playlists, shuffle, repeat, volume, etc.).

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, JavaScript |
| Data | JSON (`songs.json`, `songs1.json`, `songs2.json`, `result.json`) |
| Scripts | Python 3 (`generate.py`, `merge.py`) |
| Config | `.env` (see `.env.example`) |

---

## 📁 Project Structure

```
MusicPlayer/
├── index.html               # Main music player page
├── app.js                   # Player logic (play, pause, next, previous, etc.)
├── style.css                # Player styling
├── upload.html              # Page to upload / add songs
├── fetch-artists.html       # Helper page to fetch artist info
├── generate-songsname.html  # Helper page to generate song names
├── generate.py              # Script to generate song data
├── merge.py                 # Script to merge song JSON files
├── songs.json               # Song library
├── songs1.json              # Song library (part 1)
├── songs2.json              # Song library (part 2)
├── result.json              # Merged / generated output
├── .env.example             # Template for environment variables
└── .gitignore
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/avinashtech18/MusicPlayer.git
cd MusicPlayer
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the values required by the project.

### 3. (Optional) Set up Python for the helper scripts

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt   # if you add one
```

### 4. Run the player

Because the player loads JSON files, run it through a local server instead of opening the file directly:

```bash
python -m http.server 5500
```

Then open **http://localhost:5500** in your browser.

Or use the **Live Server** extension in VS Code and open `index.html`.

---

## 🔧 Working with Song Data

1. **Generate** song data using `generate.py` or the helper HTML pages.
2. **Merge** multiple song files into one:
   ```bash
   python merge.py
   ```
3. The final list is read by the player from the JSON file.

Each song entry is expected to look similar to:

```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "src": "path-or-url-to-audio",
  "cover": "path-or-url-to-cover-image"
}
```

> Update this example to match the actual fields in your `songs.json`.

---

## 🖼️ Screenshots

_Add screenshots of the player here._

```md
![Player](screenshots/player.png)
```

---

## 🔮 Future Improvements

- Playlists and favourites
- Search and filter by artist or album
- Shuffle and repeat modes
- Mobile-friendly mini player
- Dark / light theme toggle

---

## 📜 License & Usage

This project was created **for personal use only**.
Please **do not copy, redistribute, or reuse the code** from this repository without permission.

---

## 👤 Author

**Avinash**
GitHub: [@avinashtech18](https://github.com/avinashtech18)
