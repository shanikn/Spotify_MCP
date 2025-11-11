// MCP command definitions
import { config as loadEnv } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";


import {
    getPlaybackState,
    pausePlayback,
    resumePlayback
} from "./spotify.js";

loadEnv();



// Start stdio transport (Claude Desktop reads/writes here)
const transport = new StdioServerTransport();


// Create MCP server
const server = new McpServer({
    name: "spotify_mcp",
    version: "1.0.0",
    transport
});


let config = {};
try {
    config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
} catch {
    config = {};
}

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


// Tool: list devices
server.registerTool(
    "spotify.listDevices",
    {
        title: "List available Spotify devices",
        description: "Shows all devices linked to your spotify account",
        inputSchema: z.object({}),
        outputSchema: z.object({
            devices: z.array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                    type: z.string(),
                    isActive: z.boolean()
                })
            )
        })
    },

    async () => {
        const data = await(await import("./spotify.js")).then(m => m.listDevices());
        const devices = data.map(d => ({
            id: d.id,
            name: d.name,
            type: d.type,
            isActive: d.is_active
        }));

        return {
            content: [{ type:"text", text: JSON.stringify(devices, null, 2)}],
            structuredContent: { devices}
        };
    }
);


// Tool: switch device
server.registerTool(
    "spotify.switchDevice",
    {
        title: "Switch default Spotify device",
        description: "Changes which device MCP uses for playback.",
        inputSchema: z.object({ deviceName: z.string() }),
        outputSchema: z.object({ ok: z.boolean(), defaultDevice: z.string() })
    },
    
    async ({ deviceName }) => {
        const data = await (await import("./spotify.js")).then(m => m.listDevices());
        const found = data.find(d => d.name.toLowerCase() === deviceName.toLowerCase());
        if (!found) {
            throw new Error(`No device named '${deviceName}' found.`);
        }

        config.defaultDevice = deviceName;
        fs.writeFileSync("./config.json", JSON.stringify(config, null, 2), "utf-8");

        return {
            content: [{ type: "text", text: `Default device switched to ${deviceName}` }],
            structuredContent: { ok: true, defaultDevice: deviceName }
        };
    }
);


// await to avoid race conditions why not
await server.connect();
console.log("Spotify MCP (stdio) ready");