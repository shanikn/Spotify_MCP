// MCP command definitions
import express from "express";
import { config as loadEnv } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { getLoginUrl, handleCallback } from "./auth.js";
import {
    getPlaybackState,
    pausePlayback,
    resumePlayback
} from "./spotify.js";

loadEnv();

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


// MCP server instance
const server = new McpServer({
    name: "spotify-mcp",
    version: "0.1.0"
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


// MCP HTTP endpoint
app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
        enableJsonResponse: true
    });

    res.on("close", () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});



const PORT = parseInt(process.env.PORT || "8888", 10);
app
    .listen(PORT, () => {
        console.log(`Spotify MCP listening on http://127.0.0.1:${PORT}`);
    })
    .on("error", (err) => {
        console.error("Server error:", err);
        process.exit(1);
    });
