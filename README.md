# 🎧 Spotify MCP (Model Context Protocol Server)

A local MCP server that lets Claude (or any MCP client) control Spotify playback on your account — play, pause, or get the current track status — using Spotify’s Web API.

---

## ⚙️ Features
- OAuth2 authentication with your Spotify Developer App  
- Exposes MCP tools:
  - `spotify.getPlayback` → get current playback info  
  - `spotify.play` → resume playback  
  - `spotify.pause` → pause playback  
- Designed for use with Claude Code or MCP Inspector

---

## 🧩 Setup

### 1. Clone the repo
```bash
git clone https://github.com/shanikn/Spotify_MCP.git
cd Spotify_MCP
