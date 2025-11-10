// MCP command definitions
import { config as loadEnv } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
    getPlaybackState,
    pausePlayback,
    resumePlayback
} from "./spotify.js";

loadEnv();

// Create MCP server
const server = new McpServer({
    name: "spotify_mcp",
    version: "1.0.0"
});


// Tool: get playback state
server.registerTool(
    "spotify.getPlayback",
    {
        title: "Get Spotify playback state",
        description: "Returns current playback info for the user.",
        inputSchema: z.object({}),
        outputSchema: z.object({
            isPlaying: z.boolean(),
            deviceName: z.string().nullable(),
            progressMs: z.number().nullable(),
            track: z
                .object({
                    name: z.string(),
                    artists: z.array(z.string()),
                    album: z.string().nullable(),
                    url: z.string().nullable()
                })
                .nullable()
        })
    },
    
    async () => {
        const playback = await getPlaybackState();
        return {
            content: [{ type: "text", text: JSON.stringify(playback, null, 2) }],
            structuredContent: playback
        };
    }
);


// Tool: pause
server.registerTool(
    "spotify.pause",
    {
        title: "Pause Spotify",
        description: "Pause playback on the active device.",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() })
    },
    
    async () => {
        const result = await pausePlayback();
        return {
            content: [{ type: "text", text: "Paused Spotify playback." }],
            structuredContent: result
        };
    }
);



// Tool: play
server.registerTool(
    "spotify.play",
    {
        title: "Play Spotify",
        description: "Resume playback on the active device.",
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() })
    },
    
    async () => {
        const result = await resumePlayback();
        return {
            content: [{ type: "text", text: "Resumed Spotify playback." }],
            structuredContent: result
        };
    }
);



// Start stdio transport (Claude Desktop reads/writes here)
const transport = new StdioServerTransport();

await server.connect(transport);
await transport.start();