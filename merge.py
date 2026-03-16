import json
import os

# ===========================
# MERGE SONGS.JSON FILES
# ===========================

# Check if files exist
if not os.path.exists('songs2.json'):
    print("❌ songs.json not found!")
    exit()

if not os.path.exists('songs.json'):
    print("❌ new_songs.json not found! Rename your new downloaded file to new_songs.json")
    exit()

# Load existing songs
with open('songs2.json', 'r', encoding='utf-8') as f:
    old_songs = json.load(f)
print(f"📂 Old songs loaded: {len(old_songs)}")

# Load new songs
with open('songs.json', 'r', encoding='utf-8') as f:
    new_songs = json.load(f)
print(f"📂 New songs loaded: {len(new_songs)}")

# Merge both lists
merged = old_songs + new_songs
print(f"🔀 Total before removing duplicates: {len(merged)}")

# Remove duplicates by URL
seen = set()
unique = []
for song in merged:
    if song['url'] not in seen:
        seen.add(song['url'])
        unique.append(song)

duplicates_removed = len(merged) - len(unique)
print(f"🗑️  Duplicates removed: {duplicates_removed}")

# Save final merged file
with open('songs.json', 'w', encoding='utf-8') as f:
    json.dump(unique, f, indent=2, ensure_ascii=False)

print(f"✅ Done! Final songs.json has {len(unique)} songs")
