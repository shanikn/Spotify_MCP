// Web API wrapper (play, pause, search)
import { getAccessToken } from "./auth.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = "https://api.spotify.com/v1";

// Config file is in the project root, one level up from src/
const CONFIG_PATH = path.join(__dirname, "..", "config.json");

let config = {};
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
} catch {
    config = { enabledTools: ["spotify.getPlayback", "spotify.play", "spotify.pause"], defaultDevice: null };
}

async function spotifyFetch(path, options = {}) {
    const token = await getAccessToken();

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
        }
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Spotify API error ${res.status}: ${text}`);
    }

    if (res.status === 204) return null;
    return res.json();
}


export async function getPlaybackState() {
    const data = await spotifyFetch("/me/player");

    if (!data) {
        return {
        isPlaying: false,
            deviceName: null,
            progressMs: null,
            track: null
        };
    }

    const item = data.item;

    return {
        isPlaying: Boolean(data.is_playing),
        deviceName: data.device ? data.device.name : null,
        progressMs: data.progress_ms ?? null,
        track: item
            ? {
                name: item.name,
                artists: (item.artists || []).map((a) => a.name),
                album: item.album ? item.album.name : null,
                url: item.external_urls?.spotify ?? null
            }
            : null
    };
}

export async function pausePlayback() {
    await spotifyFetch("/me/player/pause", { method: "PUT" });
    return { ok: true };
}

// Added a devide property
export async function resumePlayback() {
    const device = config.defaultDevice || null;
    const body = device ? JSON.stringify({ device_id: device}) : undefined;


    await spotifyFetch("/me/player/play", { 
        method: "PUT",
        body 
    });
    return { ok: true };
}

// Devices IDs
export async function listDevices() {
    return spotifyFetch("/me/player/devices");
}

// Ping device to wake it up / make it active
export async function pingDevice() {
    // Simple ping to check connection
    // Note: For full activation, Claude will use Windows-MCP to click play button
    await spotifyFetch("/me/player");
    return { ok: true };
}

// Get current playback queue
export async function getQueue() {
    const data = await spotifyFetch("/me/player/queue");
    
    if (!data) {
        return {
            currentlyPlaying: null,
            queue: []
        };
    }
    
    // Format the currently playing track
    const currentlyPlaying = data.currently_playing ? {
        name: data.currently_playing.name,
        artists: (data.currently_playing.artists || []).map(a => a.name),
        album: data.currently_playing.album?.name,
        url: data.currently_playing.external_urls?.spotify
    } : null;
    
    // Format the queue
    const queue = (data.queue || []).map(track => ({
        name: track.name,
        artists: (track.artists || []).map(a => a.name),
        album: track.album?.name,
        url: track.external_urls?.spotify
    }));
    
    return {
        currentlyPlaying,
        queue
    };
}

// Set volume (0-100)
export async function setVolume(volumePercent) {
    await spotifyFetch(`/me/player/volume?volume_percent=${volumePercent}`, { method: "PUT" });
    return { ok: true };
}

// Skip to next track
export async function skipToNext() {
    await spotifyFetch("/me/player/next", { method: "POST" });
    return { ok: true };
}

// Skip to previous track
export async function skipToPrevious() {
    await spotifyFetch("/me/player/previous", { method: "POST" });
    return { ok: true };
}

// Seek to position in track (milliseconds)
export async function seekToPosition(positionMs) {
    await spotifyFetch(`/me/player/seek?position_ms=${positionMs}`, { method: "PUT" });
    return { ok: true };
}

// Toggle shuffle
export async function setShuffle(state) {
    await spotifyFetch(`/me/player/shuffle?state=${state}`, { method: "PUT" });
    return { ok: true };
}

// Set repeat mode (track, context, off)
export async function setRepeat(state) {
    await spotifyFetch(`/me/player/repeat?state=${state}`, { method: "PUT" });
    return { ok: true };
}

// Add item to queue
export async function addToQueue(uri) {
    await spotifyFetch(`/me/player/queue?uri=${encodeURIComponent(uri)}`, { method: "POST" });
    return { ok: true };
}

// Search for tracks, artists, albums, playlists
export async function search(query, types = ["track"], limit = 10) {
    const typeString = types.join(",");
    const data = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=${typeString}&limit=${limit}`);
    
    const results = {};
    
    if (data.tracks) {
        results.tracks = data.tracks.items.map(track => ({
            name: track.name,
            artists: track.artists.map(a => a.name),
            album: track.album.name,
            uri: track.uri,
            url: track.external_urls.spotify
        }));
    }
    
    if (data.artists) {
        results.artists = data.artists.items.map(artist => ({
            name: artist.name,
            uri: artist.uri,
            url: artist.external_urls.spotify
        }));
    }
    
    if (data.albums) {
        results.albums = data.albums.items.map(album => ({
            name: album.name,
            artists: album.artists.map(a => a.name),
            uri: album.uri,
            url: album.external_urls.spotify
        }));
    }
    
    if (data.playlists) {
        results.playlists = data.playlists.items.map(playlist => ({
            name: playlist.name,
            owner: playlist.owner.display_name,
            uri: playlist.uri,
            url: playlist.external_urls.spotify
        }));
    }
    
    return results;
}

// Play specific track/album/playlist by URI
export async function playUri(uri, contextUri = null) {
    const device = config.defaultDevice || null;
    const body = {};
    
    if (device) {
        body.device_id = device;
    }
    
    if (contextUri) {
        // Playing from a context (album/playlist)
        body.context_uri = contextUri;
        body.offset = { uri };
    } else if (uri.includes("track")) {
        // Playing a single track
        body.uris = [uri];
    } else {
        // Playing an album/playlist context
        body.context_uri = uri;
    }
    
    await spotifyFetch("/me/player/play", { 
        method: "PUT",
        body: JSON.stringify(body)
    });
    return { ok: true };
}

// Get user's playlists
export async function getUserPlaylists(limit = 20) {
    const data = await spotifyFetch(`/me/playlists?limit=${limit}`);
    
    return (data.items || []).map(playlist => ({
        name: playlist.name,
        owner: playlist.owner.display_name,
        tracks: playlist.tracks.total,
        uri: playlist.uri,
        url: playlist.external_urls.spotify
    }));
}
