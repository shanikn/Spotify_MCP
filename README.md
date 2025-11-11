
<p align="center">
  <img src="https://github.com/shanikn/Spotify_MCP/blob/main/assets/milo_readme.gif" alt="Hi, I'm Shani 👋">
</p>

# 🎧 Spotify MCP - Complete Spotify Control for AI

A comprehensive Model Context Protocol (MCP) server that enables AI assistants like Claude to fully control Spotify playback with natural language. Search songs, adjust volume, manage queues, control playback, and more - all through conversation!

---

## ✨ Features

- 🔐 **OAuth2 Authentication** - Secure authentication with your Spotify Developer App
- 🎵 **Full Playback Control** - Play, pause, skip, seek, and monitor your Spotify
- 🔊 **Volume Management** - Adjust volume with voice commands
- 🔍 **Smart Search** - Search and play any song, album, artist, or playlist
- 📝 **Queue Management** - View and add to your playback queue
- 🔀 **Playback Modes** - Control shuffle and repeat settings
- 🖥️ **Multi-Device Support** - List and switch between your Spotify devices
- 🌐 **Dual Mode Architecture**:
  - **STDIO mode** for Claude Desktop integration
  - **HTTP mode** for web/API access
- 🤖 **AI-Ready** - Works with any MCP-compatible AI client

---

## 🛠️ Complete Tool List

### 🎮 Basic Playback Control
| Tool | Description | Parameters |
|------|-------------|------------|
| `spotify_ping` | Wake up/activate Spotify device | None |
| `spotify_getPlayback` | Get current playback state & track info | None |
| `spotify_play` | Resume or start playback | None |
| `spotify_pause` | Pause playback | None |

### 🔊 Volume Control
| Tool | Description | Parameters |
|------|-------------|------------|
| `spotify_setVolume` | Set volume (0-100%) | `volume` (number) |

### ⏭️ Track Navigation
| Tool | Description | Parameters |
|------|-------------|------------|
| `spotify_skipToNext` | Skip to next track | None |
| `spotify_skipToPrevious` | Skip to previous track | None |
| `spotify_seek` | Seek to position in track | `positionMs` (number) |

### 🔀 Playback Modes
| Tool | Description | Parameters |
|------|-------------|------------|
| `spotify_setShuffle` | Toggle shuffle on/off | `state` (boolean) |
| `spotify_setRepeat` | Set repeat mode | `state` ("track"/"context"/"off") |

### 📝 Queue Management
| Tool | Description | Parameters |
|------|-------------|------------|
| `spotify_getQueue` | View current playback queue | None |
| `spotify_addToQueue` | Add track to queue | `uri` (string) |

### 🔍 Search & Discovery
| Tool | Description | Parameters |
|------|-------------|------------|
| `spotify_search` | Search for tracks/artists/albums/playlists | `query` (string), `types` (array), `limit` (number) |
| `spotify_getUserPlaylists` | Get your Spotify playlists | `limit` (number, optional) |
| `spotify_playUri` | Play specific track/album/playlist | `uri` (string), `contextUri` (string, optional) |

### 🖥️ Device Management
| Tool | Description | Parameters |
|------|-------------|------------|
| `spotify_listDevices` | List all available devices | None |
| `spotify_switchDevice` | Switch default playback device | `deviceName` (string) |

---

## 🚀 Setup

### 1. Prerequisites
- Node.js (v18 or higher)
- A Spotify account (Free or Premium)
- Spotify Developer App credentials

### 2. Create Spotify Developer App
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create app"
3. Fill in the details:
   - **App name**: Choose any name (e.g., "My Spotify MCP")
   - **App description**: "MCP server for Spotify control"
   - **Redirect URI**: `http://127.0.0.1:8888/callback`
   - **APIs used**: Web API
4. Save your `Client ID` and `Client Secret`

### 3. Clone and Install
```bash
git clone https://github.com/shanikn/Spotify_MCP.git
cd Spotify_MCP
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the project root:
```env
CLIENT_ID=your_spotify_client_id
CLIENT_SECRET=your_spotify_client_secret
REDIRECT_URI=http://127.0.0.1:8888/callback
PORT=8888
```

### 5. Authenticate with Spotify
```bash
npm run dev
```
This will:
- Start the HTTP server on `http://127.0.0.1:8888`
- Open your browser to authenticate with Spotify
- Save your tokens to `tokens.json`

---

## 🖥️ Claude Desktop Setup

### 1. Locate Claude Desktop Config
Open the config file at:
```
%APPDATA%\Claude\claude_desktop_config.json
```

### 2. Add Spotify MCP Configuration
```json
{
  "mcpServers": {
    "spotify": {
      "command": "node",
      "args": ["C:\\path\\to\\Spotify_MCP\\src\\spotify-stdio.js"],
      "cwd": "C:\\path\\to\\Spotify_MCP",
      "env": {
        "CLIENT_ID": "your_spotify_client_id",
        "CLIENT_SECRET": "your_spotify_client_secret",
        "REDIRECT_URI": "http://127.0.0.1:8888/callback",
        "PORT": "8888"
      }
    }
  }
}
```

**Important Notes:**
- Replace `C:\\path\\to\\Spotify_MCP` with your actual project path
- Use double backslashes (`\\`) in Windows paths
- Replace credential placeholders with your actual Spotify app credentials
- You must authenticate with Spotify first (step 5 above) before using with Claude Desktop

### 3. Restart Claude Desktop
Close Claude Desktop completely and reopen it. The Spotify MCP tools will now be available!

---

## 💡 Usage Examples

### 🎵 Basic Playback
```
You: "Claude, what's playing on Spotify?"
Claude: [calls spotify_getPlayback]

You: "Claude, pause my music"
Claude: [calls spotify_pause]

You: "Claude, skip to the next song"
Claude: [calls spotify_skipToNext]
```

### 🔊 Volume Control
```
You: "Claude, set the volume to 50%"
Claude: [calls spotify_setVolume with volume=50]

You: "Claude, turn the volume up to 80"
Claude: [calls spotify_setVolume with volume=80]
```

### 🔍 Search & Play
```
You: "Claude, search for Bohemian Rhapsody"
Claude: [calls spotify_search with query="Bohemian Rhapsody"]

You: "Claude, play the first result"
Claude: [calls spotify_playUri with the track URI]

You: "Claude, search for chill playlists"
Claude: [calls spotify_search with query="chill" and types=["playlist"]]
```

### 📝 Queue Management
```
You: "Claude, what's in my queue?"
Claude: [calls spotify_getQueue]

You: "Claude, add this song to my queue: [Spotify URI]"
Claude: [calls spotify_addToQueue]
```

### 🔀 Playback Modes
```
You: "Claude, turn on shuffle"
Claude: [calls spotify_setShuffle with state=true]

You: "Claude, set repeat to track"
Claude: [calls spotify_setRepeat with state="track"]
```

### 🖥️ Device Management
```
You: "Claude, list my Spotify devices"
Claude: [calls spotify_listDevices]

You: "Claude, switch to my laptop"
Claude: [calls spotify_switchDevice with deviceName="LAPTOP"]
```

### 🎯 Advanced Automation
```
You: "Claude, wake up Spotify and play my Discover Weekly"
Claude: [calls spotify_ping, then spotify_search for "Discover Weekly", 
         then spotify_playUri with the playlist URI]
```

---

## 🏗️ Project Structure

```
Spotify_MCP/
├── src/
│   ├── mcp-server.js        # HTTP MCP server (for web/API access)
│   ├── spotify-stdio.js     # STDIO MCP server (for Claude Desktop)
│   ├── spotify.js           # Spotify Web API wrapper functions
│   └── auth.js              # OAuth2 authentication logic
├── .env                     # Environment variables (create this)
├── tokens.json              # Spotify auth tokens (auto-generated)
├── config.json              # MCP configuration (auto-generated)
├── package.json             # Node.js dependencies
└── README.md                # This file
```

---

## 🔧 Troubleshooting

### "No active device found" Error
**Solution**: Use `spotify_ping` before playing, or use Windows automation (if on Windows with Windows-MCP) to click the play button in quick settings to activate the device.

### Tokens Expired
**Solution**: Run `npm run dev` again to re-authenticate.

### Claude Desktop Not Finding Tools
**Solutions**:
1. Verify the config file path is correct
2. Make sure you authenticated with Spotify first (`npm run dev`)
3. Check that `tokens.json` exists in the project root
4. Restart Claude Desktop completely
5. Check Claude Desktop logs for errors

### Search Not Working / Returns Empty
**Solution**: Make sure you have an active internet connection and your tokens are valid. Try re-authenticating.

### Volume Changes Not Working
**Solution**: Volume control requires Spotify Premium. Free accounts cannot use this feature through the API.

---

## 🎯 Automation Ideas

### Voice-Activated Control
- **Morning Routine**: "Claude, wake up Spotify and play my morning playlist at 50% volume"
- **Workout Mode**: "Claude, play my workout playlist and turn on shuffle"
- **Focus Time**: "Claude, play lo-fi hip hop and set volume to 30%"

### Context-Aware Music
- Have Claude automatically adjust music based on your calendar
- Play different playlists for different times of day
- Smart queue building based on your mood or activity

### Multi-Device Sync
- Seamlessly switch playback between devices with voice
- "Claude, move my music to my laptop"
- "Claude, start playing on my phone"

### Smart Playlists
- "Claude, search for songs similar to what's playing"
- "Claude, add the next 5 songs from [artist] to my queue"
- "Claude, play my most recent playlist"

---

## 📝 Technical Details

### Authentication Flow
1. User opens `/login` endpoint
2. Redirected to Spotify's authorization page
3. User grants permissions
4. Spotify redirects to `/callback` with auth code
5. Server exchanges code for access & refresh tokens
6. Tokens saved to `tokens.json`
7. Access token auto-refreshes when expired

### API Scopes Used
- `user-read-playback-state` - Read current playback
- `user-modify-playback-state` - Control playback (play/pause/skip/volume/etc.)
- `user-read-currently-playing` - Get currently playing track
- `playlist-read-private` - Read user's playlists
- `playlist-read-collaborative` - Read collaborative playlists
- `user-library-read` - Read saved tracks

### Rate Limiting
- Spotify API has rate limits (~180 requests per minute)
- The MCP handles rate limiting gracefully
- For heavy automation, consider adding delays between requests

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Share automation ideas

---

## 📄 License

MIT License - feel free to use this project however you like!

---

## 🙏 Acknowledgments

- Built with the [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- Created by [Shani](https://github.com/shanikn)

---

## 📊 Stats

- **Total Tools**: 20
- **Lines of Code**: ~800+
- **API Endpoints Used**: 15+
- **Supported Features**: Volume, Search, Queue, Shuffle, Repeat, Multi-device, and more!

---

<p align="center">
  Made with ❤️ and 🎵 by Shani
</p>

<p align="center">
  ⭐ Star this repo if you find it useful!
</p>
