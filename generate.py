import os
import json
import urllib.request

CLOUD_NAME = "dntiwkfmp"
API_KEY = "your_api_key_here"
API_SECRET = "your_api_secret_here"

# ✅ Your MP3 folder on PC
MP3_FOLDER = r"D://TamilSongs"

# Load the OLD songs.json that has correct URLs with version numbers
with open('songs.json', 'r', encoding='utf-8') as f:
    old_songs = json.load(f)

# Build a map of filename -> full URL from old songs.json
url_map = {}
for song in old_songs:
    # Extract filename from URL
    filename = song['url'].split('/')[-1]
    url_map[filename] = song['url']

# Now build new songs.json with correct titles + correct URLs
songs = []
for filename in sorted(os.listdir(MP3_FOLDER)):
    if filename.lower().endswith('.mp3'):
        # Clean title from filename
        title = filename.replace('.mp3', '').replace('_', ' ').replace('-', ' ').strip().title()
        
        # Get the correct URL from old songs.json
        url = url_map.get(filename, '')
        
        if url:
            songs.append({
                "title": title,
                "artist": "Unknown",
                "url": url
            })
        else:
            print(f"⚠️ No URL found for: {filename}")

# Save
with open('songs.json', 'w', encoding='utf-8') as f:
    json.dump(songs, f, indent=2, ensure_ascii=False)

print(f"✅ Done! Generated songs.json with {len(songs)} songs")
