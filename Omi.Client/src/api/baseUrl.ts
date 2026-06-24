// Production: VITE_API_URL points at the backend (e.g. https://omi-api.onrender.com)
// Dev: empty string → relative URLs → Vite proxy forwards /api and /ws to localhost:5026
export const API_BASE = import.meta.env.VITE_API_URL ?? ''

// SignalR needs a full URL when cross-origin, but the relative '/ws/game' still works
// behind the dev proxy. So we only join when API_BASE is non-empty.
export const wsUrl = (path: string): string => API_BASE ? `${API_BASE}${path}` : path
