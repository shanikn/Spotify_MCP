// MCP STDIO version for Claude Desktop
// Note: Environment variables (CLIENT_ID, CLIENT_SECRET, etc.) should be set in claude_desktop_config.json
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
    getPlaybackState,
    pausePlayback,
    resumePlayback,
    listDevices,
    pingDevice,
    getQueue,
    setVolume,
    skipToNext,
    skipToPrevious,
    seekToPosition,
    setShuffle,
    setRepeat,
    addToQueue,
    search,
    playUri,
    getUserPlaylists
} from "./spotify.js";

// No need to load .env here - environment variables come from Claude Desktop config

// Create MCP server using high-level API
const server = new McpServer({
    name: "spotify_mcp",
    version: "1.0.0"
});

// Config file is in the project root, one level up from src/
const CONFIG_PATH = path.join(__dirname, "..", "config.json");

let config = {};
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
} catch {
    config = { enabledTools: ["spotify_getPlayback", "spotify_play", "spotify_pause"], defaultDevice: null };
}

// Register tools using the high-level API
server.registerTool(
    "spotify_getQueue",
    {
        description: "Get the current playback queue, showing upcoming tracks",
        inputSchema: {}
    },
    async () => {
        const queueData = await getQueue();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(queueData, null, 2)
                }
            ]
        };
    }
);

server.registerTool(
    "spotify_ping",
    {
        description: "Ping/wake up Spotify to make the device active. Use this before playing if Spotify hasn't been used recently.",
        inputSchema: {}
    },
    async () => {
        await pingDevice();
        return {
            content: [
                {
                    type: "text",
                    text: "Pinged Spotify device to wake it up."
                }
            ]
        };
    }
);

server.registerTool(
    "spotify_getPlayback",
    {
        description: "Get current Spotify playback state including track info, playback status, and device name",
        inputSchema: {}
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

server.registerTool(
    "spotify_pause",
    {
        description: "Pause Spotify playback on the active device",
        inputSchema: {}
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

server.registerTool(
    "spotify_play",
    {
        description: "Resume Spotify playback on the active device",
        inputSchema: {}
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

server.registerTool(
    "spotify_listDevices",
    {
        description: "List all available Spotify devices linked to your account",
        inputSchema: {}
    },
    async () => {
        const data = await listDevices();
        const devices = (data.devices || []).map(d => ({
            id: d.id,
            name: d.name,
            type: d.type,
            isActive: d.is_active
        }));
        
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(devices, null, 2)
                }
            ]
        };
    }
);

server.registerTool(
    "spotify_switchDevice",
    {
        description: "Switch the default device for playback",
        inputSchema: {
            deviceName: z.string().describe("Name of the device to switch to")
        }
    },
    async (args) => {
        const { deviceName } = args;
        const data = await listDevices();
        const found = (data.devices || []).find(d => 
            d.name.toLowerCase() === deviceName.toLowerCase()
        );
        
        if (!found) {
            throw new Error(`No device named '${deviceName}' found.`);
        }

        config.defaultDevice = found.id;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");

        return {
            content: [
                {
                    type: "text",
                    text: `Default device switched to ${deviceName}`
                }
            ]
        };
    }
);

// Volume Control
server.registerTool(
    "spotify_setVolume",
    {
        description: "Set Spotify volume (0-100%)",
        inputSchema: {
            volume: z.number().min(0).max(100).describe("Volume percentage (0-100)")
        }
    },
    async (args) => {
        await setVolume(args.volume);
        return {
            content: [
                {
                    type: "text",
                    text: `Volume set to ${args.volume}%`
                }
            ]
        };
    }
);

// Skip Controls
server.registerTool(
    "spotify_skipToNext",
    {
        description: "Skip to the next track",
        inputSchema: {}
    },
    async () => {
        await skipToNext();
        return {
            content: [
                {
                    type: "text",
                    text: "Skipped to next track"
                }
            ]
        };
    }
);

server.registerTool(
    "spotify_skipToPrevious",
    {
        description: "Skip to the previous track",
        inputSchema: {}
    },
    async () => {
        await skipToPrevious();
        return {
            content: [
                {
                    type: "text",
                    text: "Skipped to previous track"
                }
            ]
        };
    }
);

// Seek
server.registerTool(
    "spotify_seek",
    {
        description: "Seek to a specific position in the current track",
        inputSchema: {
            positionMs: z.number().min(0).describe("Position in milliseconds")
        }
    },
    async (args) => {
        await seekToPosition(args.positionMs);
        const seconds = Math.floor(args.positionMs / 1000);
        return {
            content: [
                {
                    type: "text",
                    text: `Seeked to ${seconds} seconds`
                }
            ]
        };
    }
);

// Shuffle & Repeat
server.registerTool(
    "spotify_setShuffle",
    {
        description: "Turn shuffle on or off",
        inputSchema: {
            state: z.boolean().describe("True to enable shuffle, false to disable")
        }
    },
    async (args) => {
        await setShuffle(args.state);
        return {
            content: [
                {
                    type: "text",
                    text: `Shuffle ${args.state ? 'enabled' : 'disabled'}`
                }
            ]
        };
    }
);

server.registerTool(
    "spotify_setRepeat",
    {
        description: "Set repeat mode: 'track' (repeat current track), 'context' (repeat album/playlist), or 'off'",
        inputSchema: {
            state: z.enum(["track", "context", "off"]).describe("Repeat mode")
        }
    },
    async (args) => {
        await setRepeat(args.state);
        return {
            content: [
                {
                    type: "text",
                    text: `Repeat mode set to: ${args.state}`
                }
            ]
        };
    }
);

// Queue Management
server.registerTool(
    "spotify_addToQueue",
    {
        description: "Add a track to the playback queue using its Spotify URI",
        inputSchema: {
            uri: z.string().describe("Spotify URI of the track (e.g., spotify:track:...)")
        }
    },
    async (args) => {
        await addToQueue(args.uri);
        return {
            content: [
                {
                    type: "text",
                    text: "Track added to queue"
                }
            ]
        };
    }
);

// Search
server.registerTool(
    "spotify_search",
    {
        description: "Search for tracks, artists, albums, or playlists on Spotify",
        inputSchema: {
            query: z.string().describe("Search query (song name, artist, album, etc.)"),
            types: z.array(z.enum(["track", "artist", "album", "playlist"])).optional().describe("Types to search for (default: track)"),
            limit: z.number().min(1).max(50).optional().describe("Maximum number of results per type (default: 10)")
        }
    },
    async (args) => {
        const results = await search(args.query, args.types || ["track"], args.limit || 10);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(results, null, 2)
                }
            ]
        };
    }
);

// Play Specific Content
server.registerTool(
    "spotify_playUri",
    {
        description: "Play a specific track, album, or playlist by its Spotify URI",
        inputSchema: {
            uri: z.string().describe("Spotify URI to play (e.g., spotify:track:..., spotify:album:..., spotify:playlist:...)"),
            contextUri: z.string().optional().describe("Optional context URI (album/playlist) when playing a specific track from it")
        }
    },
    async (args) => {
        await playUri(args.uri, args.contextUri);
        return {
            content: [
                {
                    type: "text",
                    text: "Started playing requested content"
                }
            ]
        };
    }
);

// User Playlists
server.registerTool(
    "spotify_getUserPlaylists",
    {
        description: "Get the user's Spotify playlists",
        inputSchema: {
            limit: z.number().min(1).max(50).optional().describe("Maximum number of playlists to return (default: 20)")
        }
    },
    async (args) => {
        const playlists = await getUserPlaylists(args.limit || 20);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(playlists, null, 2)
                }
            ]
        };
    }
);

// Connect with STDIO transport
const transport = new StdioServerTransport();
await server.connect(transport);

// This goes to stderr so it doesn't interfere with MCP protocol on stdout
console.error("Spotify MCP (stdio) ready");
