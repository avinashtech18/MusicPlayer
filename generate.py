import os
import json

# ✅ PUT YOUR CLOUDINARY CLOUD NAME HERE
CLOUD_NAME = "dntiwkfmp"

# ✅ PUT THE FOLDER WHERE YOUR MP3 FILES ARE ON YOUR PC
MP3_FOLDER = r"D://TamilSongs"

songs = []

for filename in sorted(os.listdir(MP3_FOLDER)):
    if filename.lower().endswith('.mp3'):
        
        # Clean the title from filename
        title = filename.replace('.mp3', '').replace('_', ' ').replace('-', ' ').strip()
        
        # Capitalize each word
        title = title.title()
        
        songs.append({
            "title": title,
            "artist": "Unknown",
            "url": f"https://res.cloudinary.com/{CLOUD_NAME}/video/upload/{filename}"
        })

# Save to songs.json
with open('songs.json', 'w', encoding='utf-8') as f:
    json.dump(songs, f, indent=2, ensure_ascii=False)

print(f"✅ Done! Generated songs.json with {len(songs)} songs")