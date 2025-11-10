// OAuth flow and token refresh
import { config as loadEnv } from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";

loadEnv();

const TOKEN_PATH = path.resolve("./tokens.json");

const SCOPES = [
    "user-ready-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing"
].join(" ");

function requireEnv(name){
    const value = proccess.env[name];
    if(!value){
        throw new Error(`Missing ${name} in .env`);
    }
    return value;
}

export function getLoginURL(){
    const clientId = requireEnv("CLIENT_ID");
    const clientUri = requireEnv("CLIENT_URI");

    const params = new URLSearchParams({
        client_id: clientId,
        repsonses_type: "code",
        redirect_uri: redirectUri,
        scope: SCOPES
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
}


async function saveToken(data){
    const withExpiry = {
        ...data,
        // expire a bit earlier than expiry, to be safe
        expiry_at: Date.now() + (data.expires_in - 60)*1000
    };
    await fs.writeFile(TOKEN_PATH, JSON.stringify(withExpiry, null, 2), "utf-8");
    return withExpiry;
}


export async function  handleCallback(code){
    const clientId = requireEnv("CLIENT_ID");
    const clientSecret = requireEnv("CLIENT_SECRET");
    const clientUri = requireEnv("CLIENT_URI");
    
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

    // Spotify may or may not return a new refresh_token
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