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

// QUESTION: what's happening here?
//  spotify fetch (token)
async function spotifyFetch(path, options = {}, retryCount = 0) {
    const token = await getAccessToken();

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
        }
    });

    // Handle 403 insufficient scope errors
    if (res.status === 403) {
        const errorText = await res.text();
        let errorData;
        try {
            errorData = JSON.parse(errorText);
        } catch {
            errorData = { error: { message: errorText } };
        }
        
        if (errorData.error?.message?.includes("Insufficient client scope")) {
            // Automatically handle scope issues by clearing tokens and providing auth URL
            const tokenPath = path.join(__dirname, "..", "tokens.json");
            try {
                fs.unlinkSync(tokenPath);
                console.error("🔧 Cleared expired tokens due to insufficient scope");
            } catch {
                // Token file doesn't exist, that's fine
            }
            
            // Import auth function and get login URL
            const { getLoginUrl } = await import("./auth.js");
            const loginUrl = getLoginUrl();
            
            // Try to open the URL automatically
            try {
                const open = (await import('open')).default;
                await open(loginUrl);
                console.error("🚀 Auto-opened authentication URL in browser");
            } catch {
                console.error("📋 Please visit this URL to re-authenticate:");
                console.error(loginUrl);
            }
            
            throw new Error(`Missing Spotify permissions. Authentication URL opened automatically. Please complete authentication and try again.`);
        }
        throw new Error(`Spotify API error ${res.status}: ${errorText}`);
    }

    // Handle 401 unauthorized errors (token expired/invalid)
    if (res.status === 401 && retryCount === 0) {
        // Token might be expired, try refreshing once
        try {
            // Force token refresh by clearing cache and getting new token
            await getAccessToken();
            // Retry the request once
            return await spotifyFetch(path, options, 1);
        } catch (refreshError) {
            throw new Error(`Authentication failed. Please re-authenticate. Error: ${refreshError.message}`);
        }
    }

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Spotify API error ${res.status}: ${text}`);
    }

    // Handle 204 No Content or empty responses
    if (res.status === 204) return null;
    
    // Check if response has content
    const text = await res.text();
    if (!text || text.trim().length === 0) return null;
    
    // Parse JSON
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error('Failed to parse JSON:', text);
        return null;
    }
}

//  whats the playback state right now? (active/not active)
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

// pause playback
export async function pausePlayback() {
    await spotifyFetch("/me/player/pause", { method: "PUT" });
    return { ok: true };
}

// Added a devide property
export async function resumePlayback() {
    const device = config.defaultDevice || null;
    const body = device ? `/me/player/play?device_id=${device}` : "/me/player/play";


    await spotifyFetch(url, { 
        method: "PUT"
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

// BUG:
// FIX:
// TODO: FJLSLS
// [ ]
// [x] 
// IMPLEMENT: 
// QUESTION: 
// NOTE: notice we need to make authentication varifies automatically
// STYLE: 
// TEST: 

// IMPORTANT!! get queue!!!!!!
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

// Restart current track (seek to beginning)
export async function restartTrack() {
    await spotifyFetch("/me/player/previous", { method: "POST" });
    return { ok: true };
}


// Skip to actual previous track (even if >3s into current song)
export async function skipToPreviousTrack() {
    // Get current playback to check progress
    const playback = await spotifyFetch("/me/player");
    
    if (!playback) {
        throw new Error("No active playback");
    }
    
    // If we're more than 3 seconds in, we need to hit previous twice- to actually go to the previous song (instead of just starting over the current one)
    if (playback.progress_ms > 3000) {
        // First call restarts the song
        await spotifyFetch("/me/player/previous", { method: "POST" });
        // Small delay to let Spotify process
        await new Promise(resolve => setTimeout(resolve, 100));
        // Second call goes to actual previous track
        await spotifyFetch("/me/player/previous", { method: "POST" });
    } else {
        // Less than 3 seconds, one call is enough
        await spotifyFetch("/me/player/previous", { method: "POST" });
    }
    
    return { ok: true };
}



// Seek to position in track (milliseconds)
export async function seekToPosition(positionMs) {
    await spotifyFetch(`/me/player/seek?position_ms=${positionMs}`, { method: "PUT" });
    return { ok: true };
}

// Toggle shuffle (on->off, off=>on)
export async function setShuffle(state) {
    await spotifyFetch(`/me/player/shuffle?state=${state}`, { method: "PUT" });
    return { ok: true };
}



// Set repeat mode (track, context, off)
export async function setRepeat(state) {
    await spotifyFetch(`/me/player/repeat?state=${state}`, { method: "PUT" });
    return { ok: true };
}

// IMPORTANT!!  add to queue!!!
// Add item to queue
export async function addToQueue(uri) {
    await spotifyFetch(`/me/player/queue?uri=${encodeURIComponent(uri)}`, { method: "POST" });
    return { ok: true };
}

// IMPORTANT!! search: song/artist/album/playlist
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
    
    // Build URL with device_id query parameter if available
    // This activates the device even if it's inactive
    const url = device ? `/me/player/play?device_id=${device}` : "/me/player/play";
    
    await spotifyFetch(url, { 
        method: "PUT",
        body: JSON.stringify(body)
    });
    return { ok: true };
}


// IMPORTANT!! library playlists
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



// IMPORTANT!! library albums
// Get user's saved albums
export async function getSavedAlbums(limit = 20, offset = 0) {
    const data = await spotifyFetch(`/me/albums?limit=${limit}&offset=${offset}`);
    
    return {
        total: data.total,
        items: (data.items || []).map(item => ({
            addedAt: item.added_at,
            album: {
                name: item.album.name,
                artists: item.album.artists.map(a => a.name),
                releaseDate: item.album.release_date,
                totalTracks: item.album.total_tracks,
                uri: item.album.uri,
                url: item.album.external_urls.spotify
            }
        }))
    };
}


// Get available recommendation seed genres
export async function getAvailableGenres() {
    const data = await spotifyFetch("/recommendations/available-genre-seeds");
    return {
        genres: data.genres || []
    };
}

// Get recently played tracks
export async function getRecentlyPlayed(limit = 20, after = null, before = null) {
    let url = `/me/player/recently-played?limit=${limit}`;
    
    if (after) {
        url += `&after=${after}`;
    }
    if (before) {
        url += `&before=${before}`;
    }
    
    const data = await spotifyFetch(url);
    
    return {
        items: (data.items || []).map(item => ({
            track: {
                name: item.track.name,
                artists: item.track.artists.map(a => a.name),
                album: item.track.album.name,
                uri: item.track.uri,
                url: item.track.external_urls.spotify
            },
            playedAt: item.played_at,
            context: item.context ? {
                type: item.context.type, // playlist, album, etc.
                uri: item.context.uri,
                url: item.context.external_urls?.spotify
            } : null
        })),
        next: data.next,
        cursors: data.cursors
    };
}

// Get recently added albums (sorted by when they were added to library)
export async function getRecentlyAddedAlbums(limit = 20, offset = 0) {
    const data = await spotifyFetch(`/me/albums?limit=${limit}&offset=${offset}`);
    
    // Albums are returned in reverse chronological order by default (most recent first)
    return {
        total: data.total,
        items: (data.items || []).map(item => ({
            addedAt: item.added_at,
            album: {
                name: item.album.name,
                artists: item.album.artists.map(a => a.name),
                releaseDate: item.album.release_date,
                totalTracks: item.album.total_tracks,
                uri: item.album.uri,
                url: item.album.external_urls.spotify
            }
        }))
    };
}

// Get recently added tracks (liked songs, sorted by when they were added)
export async function getRecentlyAddedTracks(limit = 20, offset = 0) {
    const data = await spotifyFetch(`/me/tracks?limit=${limit}&offset=${offset}`);
    
    // Tracks are returned in reverse chronological order by default (most recent first)
    return {
        total: data.total,
        items: (data.items || []).map(item => ({
            addedAt: item.added_at,
            track: {
                name: item.track.name,
                artists: item.track.artists.map(a => a.name),
                album: item.track.album.name,
                uri: item.track.uri,
                url: item.track.external_urls.spotify
            }
        }))
    };
}


// Get recommendations based on seeds
export async function getRecommendations({
    seedArtists = [],
    seedTracks = [],
    seedGenres = [],
    targetEnergy = null,
    targetValence = null,
    targetDanceability = null,
    targetInstrumentalness = null,
    targetTempo = null,
    limit = 20
}) {
    // Validate total seeds (max 5)
    const totalSeeds = seedArtists.length + seedTracks.length + seedGenres.length;
    if (totalSeeds === 0) {
        throw new Error("At least one seed (artist, track, or genre) is required");
    }
    if (totalSeeds > 5) {
        throw new Error("Maximum 5 seeds total (artists + tracks + genres)");
    }
    
    // Build query parameters
    const params = new URLSearchParams();
    
    if (seedArtists.length > 0) params.set("seed_artists", seedArtists.join(","));
    if (seedTracks.length > 0) params.set("seed_tracks", seedTracks.join(","));
    if (seedGenres.length > 0) params.set("seed_genres", seedGenres.join(","));
    
    if (targetEnergy !== null) params.set("target_energy", targetEnergy);
    if (targetValence !== null) params.set("target_valence", targetValence);
    if (targetDanceability !== null) params.set("target_danceability", targetDanceability);
    if (targetInstrumentalness !== null) params.set("target_instrumentalness", targetInstrumentalness);
    if (targetTempo !== null) params.set("target_tempo", targetTempo);
    
    params.set("limit", limit);
    
    const data = await spotifyFetch(`/recommendations?${params.toString()}`);
    
    return {
        seeds: data.seeds,
        tracks: (data.tracks || []).map(track => ({
            name: track.name,
            artists: track.artists.map(a => a.name),
            album: track.album.name,
            uri: track.uri,
            url: track.external_urls.spotify,
            audioFeatures: {
                energy: track.energy,
                valence: track.valence,
                danceability: track.danceability,
                instrumentalness: track.instrumentalness,
                tempo: track.tempo
            }
        }))
    };
}
