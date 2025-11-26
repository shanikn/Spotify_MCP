// OAuth flow and token refresh
// NOTE: Environment variables should be set by the parent process!! (either .env via mcp-server.js or Claude Desktop config)
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
    
// Token file is in the project root (one level up from src/ )
const TOKEN_PATH = path.join(__dirname, "..", "tokens.json");

const SCOPES = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "user-library-read",
    "user-read-recently-played",
    "playlist-read-private",
    "playlist-read-collaborative"
].join(" ");


function requireEnv(name){
    const value = process.env[name];
    if(!value){
        throw new Error(`Missing ${name} in .env`);
    }
    return value;
}

export function getLoginUrl(){
    const clientId = requireEnv("CLIENT_ID");
    const redirectUri = requireEnv("REDIRECT_URI");

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: SCOPES
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
}


async function saveToken(data){
    const withExpiry = {
        ...data,
        // expire a bit earlier than expiry, to be safe
        expires_at: Date.now() + (data.expires_in - 60)*1000,
        // Store the granted scope for validation
        scope: data.scope || SCOPES
    };
    await fs.writeFile(TOKEN_PATH, JSON.stringify(withExpiry, null, 2), "utf-8");
    return withExpiry;
}


export async function  handleCallback(code){
    const clientId = requireEnv("CLIENT_ID");
    const clientSecret = requireEnv("CLIENT_SECRET");
    const redirectUri = requireEnv("REDIRECT_URI");
    
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
    });

    const data = await res.json();
    if(!res.ok){
        throw new Error(
            `Token exchange failed ${res.status}: ${JSON.stringify(data)}`
        );
    }

    return saveToken(data);
}

async function loadToken(){
    const json = await fs.readFile(TOKEN_PATH, "utf-8");
    return JSON.parse(json);
}


// auto refresh for spotify token (cause it expires every hour..) 
async function refreshToken(current){
    const clientId = requireEnv("CLIENT_ID");
    const clientSecret = requireEnv("CLIENT_SECRET");

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: current.refresh_token,
        client_id: clientId,
        client_secret: clientSecret
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(
            `Token refresh failed ${res.status}: ${JSON.stringify(data)}`
        );
    }

    // spotify may or may not return a new refresh_token (depeneds on the current token's expiration)
    const merged = {
        ...current,
        ...data,
        refresh_token: data.refresh_token || current.refresh_token
    };

    return saveToken(merged);
}

export async function getAccessToken() {
    let token;
    try {
        token = await loadToken();
    } catch {
        throw new Error("No tokens.json yet. Open /login in your browser first.");
    }

    if (Date.now() < token.expires_at) {
        return token.access_token;
    }

    const refreshed = await refreshToken(token);
    return refreshed.access_token;
}


// Function to check if current tokens have required scopes
export async function checkScopes() {
    try {
        const token = await loadToken();
        // Store the scopes that were granted when this token was issued
        return {
            hasTokens: true,
            currentScopes: token.scope || 'unknown',
            requiredScopes: SCOPES
        };
    } catch {
        return {
            hasTokens: false,
            currentScopes: null,
            requiredScopes: SCOPES
        };
    }
}

// Function to force re-authentication (clears tokens)
export async function forceReauth() {
    try {
        await fs.unlink(TOKEN_PATH);
        console.error("🔧 Cleared tokens to force re-authentication");
        return true;
    } catch {
        // File doesn't exist, that's fine
        return true;
    }
}