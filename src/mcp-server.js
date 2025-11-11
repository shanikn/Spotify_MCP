// MCP command definitions
import express from "express";
import { config as loadEnv } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { getLoginUrl, handleCallback } from "./auth.js";
import {
    getPlaybackState,
    pausePlayback,
    resumePlayback
} from "./spotify.js";

import open from "open";
import fs from "fs";


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


// MCP server instance using McpServer (high-level API)
const server = new McpServer({
    name: "spotify_mcp",
    version: "1.0.0"
});

// Register tools using the high-level API
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
    .listen(PORT, () => {
        console.log(`Spotify MCP listening on http://127.0.0.1:${PORT}`);
        if(!fs.existsSync("tokens.json")){
            open(`http://127.0.0.1:${PORT}/login`)
        } else {
            console.log("✅ Already authenticated with Spotify");
        }
    })
    .on("error", (err) => {
        console.error("Server error:", err);
        process.exit(1);
    });
