// MCP command definitions
import express from "express";
import { config as loadEnv } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { getLoginUrl, handleCallback, getAccessToken, checkScopes } from "./auth.js";
import {
    getPlaybackState,
    pausePlayback,
    resumePlayback,
    getSavedAlbums,
    getRecommendations,
    getAvailableGenres,
    getRecentlyPlayed,
    getRecentlyAddedAlbums,
    getRecentlyAddedTracks
} from "./spotify.js";

import open from "open";
import fs from "fs";

loadEnv();

async function validateAuthentication() {
    const scopeInfo = await checkScopes();
    
    if (!scopeInfo.hasTokens) {
        console.log("❌ No authentication tokens found");
        return false;
    }
    
    try {
        // Try to get access token (this will refresh if needed)
        await getAccessToken();
        
        // Test basic API access to verify token works
        const testResponse = await fetch("https://api.spotify.com/v1/me", {
            headers: {
                Authorization: `Bearer ${await getAccessToken()}`
            }
        });
        
        if (testResponse.ok) {
            console.log("✅ Authenticated with Spotify and tokens are valid");
            console.log(`🔑 Current scopes: ${scopeInfo.currentScopes}`);
            
            // Check if we have all required scopes
            const requiredScopes = scopeInfo.requiredScopes.split(' ');
            const currentScopes = (scopeInfo.currentScopes || '').split(' ');
            const missingScopes = requiredScopes.filter(scope => !currentScopes.includes(scope));
            
            if (missingScopes.length > 0) {
                console.log(`⚠️  Missing required scopes: ${missingScopes.join(', ')}`);
                console.log("🔄 Re-authentication will be triggered when needed");
            }
            
            return true;
        } else {
            console.log("❌ Tokens exist but are invalid");
            return false;
        }
    } catch (error) {
        console.log(`❌ Token validation failed: ${error.message}`);
        return false;
    }
}

const app = express();
app.use(express.json());

// Simple info page
app.get("/", (_req, res) => {
    res.send(
        "Spotify MCP server is running. Go to /login to connect your Spotify account."
    );
});

// Start OAuth login
app.get("/login", (_req, res) => {
    const url = getLoginUrl();
    res.redirect(url);
});


// OAuth callback
app.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send("Missing code");
    }

    try {
        await handleCallback(String(code));
        res.send("Spotify auth complete. You can close this tab now.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error during Spotify auth, check server logs.");
    }
});


// MCP server instance using McpServer (high-level API)
const server = new McpServer({
    name: "spotify_mcp",
    version: "1.0.0"
});

// Register tools using the high-level API

// Help command to list all available tools
server.registerTool(
    "spotify_help",
    {
        description: "Get a comprehensive list of all available Spotify MCP tools and their descriptions",
        inputSchema: {} // No parameters needed
    },
    async () => {
        const helpText = `
🎵 SPOTIFY MCP - AVAILABLE TOOLS 🎵

═══════════════════════════════════════════════════════════════

📊 PLAYBACK CONTROL
-------------------
• spotify_getPlayback
  Get current playback state (track, device, play status)

• spotify_play
  Resume playback on active device

• spotify_pause
  Pause playback on active device

• spotify_ping
  Ping Spotify to check connection (Note: doesn't activate sleeping devices)

• spotify_playUri
  Play a specific track/album/playlist by URI
  Parameters: uri (required), contextUri (optional)

• spotify_skipToNext
  Skip to next track in queue

• spotify_skipToPrevious
  Skip to previous track (even if >3s into current)

• spotify_restartTrack
  Restart current track from beginning

• spotify_seek
  Seek to specific position in track
  Parameters: positionMs (required)


🔊 PLAYBACK SETTINGS
--------------------
• spotify_setVolume
  Set volume level (0-100%)
  Parameters: volume (required, 0-100)

• spotify_setShuffle
  Toggle shuffle mode
  Parameters: state (required, true/false)

• spotify_setRepeat
  Set repeat mode
  Parameters: state (required, "track"/"context"/"off")


📱 DEVICE MANAGEMENT
-------------------
• spotify_listDevices
  List all available Spotify devices

• spotify_switchDevice
  Switch playback to a different device
  Parameters: deviceName (required)


🎵 QUEUE MANAGEMENT
------------------
• spotify_getQueue
  Get current playback queue

• spotify_addToQueue
  Add track to queue
  Parameters: uri (required)


🔍 SEARCH & DISCOVERY
---------------------
• spotify_search
  Search for tracks/artists/albums/playlists
  Parameters: query (required), types (optional array), limit (optional)

• spotify_getRecommendations
  Get personalized recommendations
  Parameters: seedArtists, seedTracks, seedGenres, targetEnergy,
             targetValence, targetDanceability, targetInstrumentalness,
             targetTempo, limit

• spotify_getAvailableGenres
  Get list of available genres for recommendations


📚 LIBRARY
---------
• spotify_getSavedAlbums
  Get user's saved albums
  Parameters: limit (optional, max 50), offset (optional)

• spotify_getUserPlaylists
  Get user's playlists
  Parameters: limit (optional, max 50)


⏱️ HISTORY
----------
• spotify_getRecentlyPlayed
  Get recently played tracks
  Parameters: limit (optional), after (optional), before (optional)

• spotify_getRecentlyAddedAlbums
  Get recently saved albums
  Parameters: limit (optional), offset (optional)

• spotify_getRecentlyAddedTracks
  Get recently liked songs
  Parameters: limit (optional), offset (optional)


💡 TIPS
-------
• URIs format: spotify:track:... or spotify:album:... or spotify:playlist:...
• Most commands require an active Spotify device
• Use spotify_search to find URIs for tracks/albums/playlists
• Maximum 5 seeds total for recommendations (artists + tracks + genres)

═══════════════════════════════════════════════════════════════
`;
        
        return {
            content: [
                {
                    type: "text",
                    text: helpText
                }
            ]
        };
    }
);

server.registerTool(
    "spotify_getPlayback",
    {
        description: "Get current Spotify playback state including track info, playback status, and device name",
        inputSchema: {} // No parameters needed
    },
    async () => {
        const playback = await getPlaybackState();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(playback, null, 2)
                }
            ]
        };
    }
);


// pause
server.registerTool(
    "spotify_pause",
    {
        description: "Pause Spotify playback on the active device",
        inputSchema: {} // No parameters needed
    },
    async () => {
        await pausePlayback();
        return {
            content: [
                {
                    type: "text",
                    text: "Paused Spotify playback."
                }
            ]
        };
    }
);

// play
server.registerTool(
    "spotify_play",
    {
        description: "Resume Spotify playback on the active device",
        inputSchema: {} // No parameters needed
    },
    async () => {
        await resumePlayback();
        return {
            content: [
                {
                    type: "text",
                    text: "Resumed Spotify playback."
                }
            ]
        };
    }
);

// get saved albums
server.registerTool(
    "spotify_getSavedAlbums",
    {
        description: "Get user's saved albums from their Spotify library",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "number",
                    description: "Number of albums to return (max 50)",
                    minimum: 1,
                    maximum: 50,
                    default: 20
                },
                offset: {
                    type: "number",
                    description: "The index of the first album to return",
                    minimum: 0,
                    default: 0
                }
            }
        }
    },
    async (args) => {
        const albums = await getSavedAlbums(args.limit || 20, args.offset || 0);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(albums, null, 2)
                }
            ]
        };
    }
);

// get recommendations (accodring to a seed such as: an artist, a song...)
server.registerTool(
    "spotify_getRecommendations",
    {
        description: "Get track recommendations based on seed artists, tracks, and genres with optional audio feature targeting",
        inputSchema: {
            type: "object",
            properties: {
                seedArtists: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of Spotify artist IDs (max 5 total seeds)"
                },
                seedTracks: {
                    type: "array", 
                    items: { type: "string" },
                    description: "List of Spotify track IDs (max 5 total seeds)"
                },
                seedGenres: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of genre strings like 'ambient', 'lo-fi', 'electronic' (max 5 total seeds)"
                },
                targetEnergy: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Target energy level (0.0-1.0) - 0 is low energy, 1 is high energy"
                },
                targetValence: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Target valence (0.0-1.0) - 0 is sad/angry, 1 is happy/euphoric"
                },
                targetDanceability: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Target danceability (0.0-1.0)"
                },
                targetInstrumentalness: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    description: "Target instrumentalness (0.0-1.0) - closer to 1 is more instrumental"
                },
                targetTempo: {
                    type: "number",
                    description: "Target tempo in BPM"
                },
                limit: {
                    type: "number",
                    minimum: 1,
                    maximum: 100,
                    default: 20,
                    description: "Number of recommendations to return"
                }
            }
        }
    },
    async (args) => {
        const recommendations = await getRecommendations(args);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(recommendations, null, 2)
                }
            ]
        };
    }
);

// get available genres (to use as seed for recommendations)
server.registerTool(
    "spotify_getAvailableGenres",
    {
        description: "Get list of available genres for use as seeds in recommendations",
        inputSchema: {}
    },
    async () => {
        const genres = await getAvailableGenres();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(genres, null, 2)
                }
            ]
        };
    }
);


// get recently playes songs
server.registerTool(
    "spotify_getRecentlyPlayed",
    {
        description: "Get recently played tracks from user's listening history",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "number",
                    description: "Number of recently played tracks to return (max 50)",
                    minimum: 1,
                    maximum: 50,
                    default: 20
                },
                after: {
                    type: "string",
                    description: "Unix timestamp in milliseconds - returns tracks played after this time"
                },
                before: {
                    type: "string",
                    description: "Unix timestamp in milliseconds - returns tracks played before this time"
                }
            }
        }
    },
    async (args) => {
        const recentTracks = await getRecentlyPlayed(
            args.limit || 20,
            args.after || null,
            args.before || null
        );
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(recentTracks, null, 2)
                }
            ]
        };
    }
);

//  get recently added albums
server.registerTool(
    "spotify_getRecentlyAddedAlbums",
    {
        description: "Get albums recently added to user's library (saved albums), sorted by when they were added",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "number",
                    description: "Number of recently added albums to return (max 50)",
                    minimum: 1,
                    maximum: 50,
                    default: 20
                },
                offset: {
                    type: "number",
                    description: "The index of the first album to return",
                    minimum: 0,
                    default: 0
                }
            }
        }
    },
    async (args) => {
        const recentAlbums = await getRecentlyAddedAlbums(
            args.limit || 20,
            args.offset || 0
        );
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(recentAlbums, null, 2)
                }
            ]
        };
    }
);

// get recently added songs
server.registerTool(
    "spotify_getRecentlyAddedTracks",
    {
        description: "Get tracks recently added to user's library (liked songs), sorted by when they were liked",
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "number",
                    description: "Number of recently added tracks to return (max 50)",
                    minimum: 1,
                    maximum: 50,
                    default: 20
                },
                offset: {
                    type: "number",
                    description: "The index of the first track to return",
                    minimum: 0,
                    default: 0
                }
            }
        }
    },
    async (args) => {
        const recentTracks = await getRecentlyAddedTracks(
            args.limit || 20,
            args.offset || 0
        );
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(recentTracks, null, 2)
                }
            ]
        };
    }
);


// MCP HTTP endpoint
app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true
    });

    res.on("close", () => {
        transport.close();
    });

    // McpServer wraps the low-level Server, access it via .server
    await server.server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});



const PORT = parseInt(process.env.PORT || "8888", 10);
app
    .listen(PORT, async () => {
        console.log(`Spotify MCP listening on http://127.0.0.1:${PORT}`);
        
        const isAuthenticated = await validateAuthentication();
        if (!isAuthenticated) {
            console.log("🚀 Opening authentication URL...");
            open(`http://127.0.0.1:${PORT}/login`);
        }
    })
    .on("error", (err) => {
        console.error("Server error:", err);
        process.exit(1);
    });
