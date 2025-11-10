// Web API wrapper (play, pause, search)
import { getAccessToken } from "./auth.js";

const API_BASE = "https://api.spotify.com/v1";



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

export async function resumePlayback() {
    await spotifyFetch("/me/player/play", { method: "PUT" });
    return { ok: true };
}