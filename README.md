<!--
How to make this gif ?

I made my with https://codesandbox.io/s/github-profile-2ijk7
Then i recorded my screen to gif on Mac with Quicktime  and save result to [assets/github.mov](assets/github.mov)
This [gist](https://gist.github.com/tskaggs/6394639) help me to create a dedicated command that convert MOV to GIF.
Type this command `make generate-gif` to generate [assets/github.gif](assets/github.gif)
-->



<p align="center">
  <img src="https://github.com/shanikn/Spotify_MCP/blob/main/assets/milo_readme.gif" alt="Hi, I'm Shani 👋">
</p>

# 🎧 Spotify MCP - works with Windows

A local MCP server that lets Claude (or any MCP client) control Spotify playback on your account.
You can use actions like: play, pause, or get the current track status — by using Spotify’s Web API.

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
