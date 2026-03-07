import { useState, useEffect, useCallback } from "react";

const TMDB_KEY = "4b152a91b5a3963ff8b43773eaa990c8";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w780";

// ─── Seed data (user's library) ─────────────────────────────────────────────
const SEED = [
  { tmdbId: 95396,  type: "tv",    progress: { s: 1, e: 4 }, lists: ["Watching"], rating: null, notes: [] },
  { tmdbId: 67136,  type: "tv",    progress: { s: 2, e: 2 }, lists: ["Watching"], rating: null, notes: [{ ref: "S1E9", text: "Best season finale I've ever watched. The cliffhanger.", date: "Mar 2" }] },
  { tmdbId: 84958,  type: "tv",    progress: { s: 2, e: 5 }, lists: ["Watching", "With Girlfriend"], rating: null, notes: [] },
  { tmdbId: 76331,  type: "tv",    progress: { s: 4, e: 9 }, lists: ["Finished"], rating: 5, notes: [{ ref: "S4E3", text: "Greatest episode of television. Period.", date: "May 10" }] },
  { tmdbId: 787699, type: "movie", progress: null,            lists: ["Finished"], rating: 5, notes: [{ ref: "Film", text: "Third hour is the real film. Trial scenes are electric.", date: "Dec 5" }] },
  { tmdbId: 693134, type: "movie", progress: null,            lists: ["Finished"], rating: 4, notes: [{ ref: "Film", text: "Visually insane. Feyd-Rautha scenes hit different.", date: "Apr 3" }] },
  { tmdbId: 100,    type: "movie", progress: null,            lists: ["Watchlist"], rating: null, notes: [] },
  { tmdbId: 76479,  type: "tv",    progress: null,            lists: ["Watchlist"], rating: null, notes: [] },
];

const FRIEND_RECS = [
  { from: "Emile", initial: "E", tmdbId: 1648, type: "tv", note: "Mind-bending time travel. Watch alone at night.", color: "#c0392b" },
  { from: "Kiara", initial: "K", tmdbId: 100088, type: "tv", note: "Nathan Fielder unhinged. Cannot be described.", color: "#8e44ad" },
  { from: "Avi",   initial: "A", tmdbId: 83867,  type: "tv", note: "Best Star Wars content ever made.", color: "#27ae60" },
];

// ─── TMDB helpers ────────────────────────────────────────────────────────────
async function fetchTMDB(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}`);
  if (!r.ok) throw new Error("TMDB error");
  return r.json();
}

async function enrichItem(seed) {
  const base = await fetchTMDB(`/${seed.type === "tv" ? "tv" : "movie"}/${seed.tmdbId}`);
  let seasons = [];
  if (seed.type === "tv" && base.number_of_seasons) {
    const nums = Array.from({ length: Math.min(base.number_of_seasons, 3) }, (_, i) => i + 1);
    seasons = await Promise.all(nums.map(n => fetchTMDB(`/tv/${seed.tmdbId}/season/${n}`)));
  }
  return { ...seed, meta: base, seasons };
}

async function searchTMDB(query) {
  const data = await fetchTMDB(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false`);
  return (data.results || []).filter(r => r.media_type === "tv" || r.media_type === "movie").slice(0, 6);
}

// ─── Small components ────────────────────────────────────────────────────────
function Poster({ path, title, size = 56, radius = 10 }) {
  return path
    ? <img src={`${TMDB_IMG}${path}`} alt={title} style={{ width: size, height: size * 1.5, objectFit: "cover", borderRadius: radius, flexShrink: 0, display: "block" }} />
    : <div style={{ width: size, height: size * 1.5, borderRadius: radius, background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, flexShrink: 0, color: "#444" }}>🎬</div>;
}

function Stars({ value, onSet, size = 15 }) {
  const [hov, setHov] = useState(0);
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onSet?.(n)} onMouseEnter={() => onSet && setHov(n)} onMouseLeave={() => onSet && setHov(0)}
          style={{ fontSize: size, color: n <= (hov || value || 0) ? "#f5c518" : "#2a2a2a", cursor: onSet ? "pointer" : "default", lineHeight: 1 }}>★</span>
      ))}
    </div>
  );
}

function Pill({ children, active, onClick, accent = "#e8e8e8" }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 13px", borderRadius: 20, border: `1px solid ${active ? accent : "#252525"}`,
      background: active ? accent : "transparent", color: active ? "#0a0a0a" : "#666",
      fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s"
    }}>{children}</button>
  );
}

function Avatar({ initial, color, size = 30 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
      {initial}
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 18, height: 18, border: "2px solid #222", borderTop: "2px solid #888", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

// ─── Episode tracker sheet ────────────────────────────────────────────────────
function EpisodeSheet({ item, onClose, onMarkEpisode }) {
  const title = item.meta?.name || item.meta?.title || "Unknown";
  const poster = item.meta?.poster_path;
  const backdrop = item.meta?.backdrop_path;

  const getWatchedKey = (s, e) => `${item.tmdbId}-s${s}e${e}`;
  const [watched, setWatched] = useState(() => {
    const map = {};
    if (item.progress && item.seasons) {
      item.seasons.forEach(season => {
        (season.episodes || []).forEach(ep => {
          const key = getWatchedKey(season.season_number, ep.episode_number);
          map[key] = (season.season_number < item.progress.s) ||
            (season.season_number === item.progress.s && ep.episode_number <= item.progress.e);
        });
      });
    }
    return map;
  });

  const toggle = (s, e) => {
    const key = getWatchedKey(s, e);
    setWatched(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const total = item.seasons?.flatMap(s => s.episodes || []).length || 0;
  const done = Object.values(watched).filter(Boolean).length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "#080808" }}>
      {/* Backdrop header */}
      <div style={{ position: "relative", height: 200, flexShrink: 0, overflow: "hidden" }}>
        {backdrop
          ? <img src={`${TMDB_BACKDROP}${backdrop}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", background: "#111" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(8,8,8,0.95) 100%)" }} />
        <button onClick={onClose} style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.5)", border: "none", width: 34, height: 34, borderRadius: "50%", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>‹</button>
        <div style={{ position: "absolute", bottom: 16, left: 20, right: 20, display: "flex", gap: 14, alignItems: "flex-end" }}>
          <Poster path={poster} title={title} size={52} />
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{done} of {total} episodes</div>
            <div style={{ marginTop: 6, height: 3, width: 140, background: "#1e1e1e", borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${total ? (done/total)*100 : 0}%`, background: "#e8e8e8", borderRadius: 2, transition: "width 0.3s" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Episodes list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 40px" }}>
        {(item.seasons || []).map(season => (
          <div key={season.season_number}>
            <div style={{ padding: "16px 20px 8px", fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: 2, textTransform: "uppercase" }}>
              Season {season.season_number}
            </div>
            {(season.episodes || []).map(ep => {
              const key = getWatchedKey(season.season_number, ep.episode_number);
              const isWatched = watched[key];
              return (
                <div key={ep.episode_number} onClick={() => toggle(season.season_number, ep.episode_number)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 20px", cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#0f0f0f"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${isWatched ? "#e8e8e8" : "#333"}`,
                    background: isWatched ? "#e8e8e8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    {isWatched && <span style={{ fontSize: 12, color: "#0a0a0a", fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: isWatched ? "#3a3a3a" : "#d0d0d0", textDecoration: isWatched ? "line-through" : "none", transition: "color 0.15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ color: isWatched ? "#2a2a2a" : "#555", marginRight: 8, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>E{String(ep.episode_number).padStart(2,"0")}</span>
                      {ep.name}
                    </div>
                    {ep.air_date && <div style={{ fontSize: 11, color: "#333", marginTop: 2 }}>{ep.air_date}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Show detail bottom sheet ─────────────────────────────────────────────────
function DetailSheet({ item, onClose, onUpdate, onOpenEpisodes }) {
  const [tab, setTab] = useState("info");
  const [note, setNote] = useState("");
  const [noteRef, setNoteRef] = useState("");
  const title = item.meta?.name || item.meta?.title || "—";
  const overview = item.meta?.overview || "";
  const poster = item.meta?.poster_path;
  const backdrop = item.meta?.backdrop_path;
  const year = (item.meta?.first_air_date || item.meta?.release_date || "").slice(0,4);
  const rating = item.meta?.vote_average;

  const LISTS_ALL = ["Watching", "Watchlist", "Finished", "With Girlfriend", "With Friends", "Date Night", "Comfort Watch"];

  const addNote = () => {
    if (!note.trim()) return;
    const updated = { ...item, notes: [...(item.notes || []), { ref: noteRef || "General", text: note, date: "Just now" }] };
    onUpdate(updated);
    setNote(""); setNoteRef("");
  };

  const toggleList = (list) => {
    const lists = item.lists || [];
    onUpdate({ ...item, lists: lists.includes(list) ? lists.filter(l => l !== list) : [...lists, list] });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", flexDirection: "column" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "92vh", background: "#0d0d0d", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header image */}
        <div style={{ position: "relative", height: 180, flexShrink: 0 }}>
          {backdrop
            ? <img src={`${TMDB_BACKDROP}${backdrop}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", background: "#151515" }} />}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, #0d0d0d 100%)" }} />
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "rgba(0,0,0,0.5)", border: "none", width: 30, height: 30, borderRadius: "50%", color: "#aaa", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          {/* drag handle */}
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
        </div>

        {/* Meta row */}
        <div style={{ padding: "0 20px 16px", display: "flex", gap: 14, alignItems: "flex-end", marginTop: -40, position: "relative" }}>
          <Poster path={poster} title={title} size={60} />
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, color: "#f0f0f0", lineHeight: 1.2 }}>{title}</div>
            <div style={{ fontSize: 12, color: "#555", marginTop: 3 }}>{year}{rating ? ` · ★ ${rating.toFixed(1)}` : ""}</div>
            <Stars value={item.rating} onSet={v => onUpdate({ ...item, rating: v })} size={13} />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "0 20px", borderBottom: "1px solid #161616", flexShrink: 0 }}>
          {(item.type === "tv" ? ["info","episodes","notes","lists"] : ["info","notes","lists"]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "10px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "#e8e8e8" : "transparent"}`,
              color: tab === t ? "#e8e8e8" : "#444", fontFamily: "inherit", fontSize: 12, fontWeight: 600, textTransform: "capitalize", cursor: "pointer"
            }}>{t}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 40px" }}>
          {tab === "info" && (
            <div>
              <p style={{ fontSize: 13, color: "#777", lineHeight: 1.7, margin: "0 0 16px" }}>{overview || "No description available."}</p>
              {item.type === "tv" && (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, background: "#111", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#e8e8e8", fontFamily: "'Cormorant Garamond', serif" }}>{item.meta?.number_of_seasons || "—"}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Seasons</div>
                  </div>
                  <div style={{ flex: 1, background: "#111", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#e8e8e8", fontFamily: "'Cormorant Garamond', serif" }}>{item.meta?.number_of_episodes || "—"}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Episodes</div>
                  </div>
                  <div style={{ flex: 1, background: "#111", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#e8e8e8", fontFamily: "'Cormorant Garamond', serif" }}>{item.meta?.vote_average?.toFixed(1) || "—"}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>TMDB</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "episodes" && item.type === "tv" && (
            <div>
              <button onClick={onOpenEpisodes} style={{
                width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "16px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "inherit"
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#d0d0d0", textAlign: "left" }}>Track Episodes</div>
                  {item.progress && <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Last: S{item.progress.s}E{item.progress.e}</div>}
                </div>
                <span style={{ color: "#555", fontSize: 18 }}>›</span>
              </button>
            </div>
          )}

          {tab === "notes" && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <input value={noteRef} onChange={e => setNoteRef(e.target.value)} placeholder="Scene or episode (e.g. S2E4)"
                  style={{ width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: "9px 13px", color: "#ccc", fontSize: 13, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }} />
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Your thoughts, who to watch this with…" rows={3}
                  style={{ width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: "9px 13px", color: "#ccc", fontSize: 13, fontFamily: "inherit", resize: "none", boxSizing: "border-box" }} />
                <button onClick={addNote} style={{ marginTop: 8, background: "#e8e8e8", border: "none", borderRadius: 8, padding: "9px 22px", color: "#0a0a0a", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Save</button>
              </div>
              {(item.notes || []).length === 0 && <p style={{ color: "#333", fontSize: 13, textAlign: "center", padding: "16px 0" }}>No notes yet.</p>}
              {(item.notes || []).map((n, i) => (
                <div key={i} style={{ borderLeft: "2px solid #222", paddingLeft: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>{n.ref} · {n.date}</div>
                  <p style={{ fontSize: 13, color: "#999", margin: 0, lineHeight: 1.65 }}>{n.text}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "lists" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {LISTS_ALL.map(l => (
                <Pill key={l} active={(item.lists || []).includes(l)} onClick={() => toggleList(l)}>{l}</Pill>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Search overlay ────────────────────────────────────────────────────────────
function SearchOverlay({ onClose, onAdd }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { setResults(await searchTMDB(q)); } catch {}
      setLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#080808", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 12px", display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: 24, cursor: "pointer", padding: 0, lineHeight: 1 }}>‹</button>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search movies & shows…"
          style={{ flex: 1, background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "10px 14px", color: "#e8e8e8", fontSize: 15, fontFamily: "inherit" }} />
        {loading && <Spinner />}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {results.map(r => (
          <div key={r.id} onClick={() => { onAdd(r); onClose(); }}
            style={{ display: "flex", gap: 14, padding: "10px 20px", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "#0f0f0f"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Poster path={r.poster_path} title={r.title || r.name} size={44} radius={8} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#d0d0d0" }}>{r.title || r.name}</div>
              <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>
                {r.media_type === "tv" ? "Series" : "Film"} · {(r.first_air_date || r.release_date || "").slice(0,4)}
              </div>
            </div>
            <div style={{ alignSelf: "center", fontSize: 20, color: "#2a2a2a" }}>+</div>
          </div>
        ))}
        {q.length >= 2 && !loading && results.length === 0 && (
          <div style={{ textAlign: "center", color: "#333", fontSize: 13, padding: "40px 0" }}>No results found</div>
        )}
        {q.length < 2 && (
          <div style={{ textAlign: "center", color: "#2a2a2a", fontSize: 13, padding: "40px 0" }}>Start typing to search TMDB…</div>
        )}
      </div>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function ReelTrack() {
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [detail, setDetail] = useState(null);
  const [episodes, setEpisodes] = useState(null);
  const [searching, setSearching] = useState(false);
  const [listFilter, setListFilter] = useState("All");

  // Load library from TMDB on mount
  useEffect(() => {
    (async () => {
      try {
        const enriched = await Promise.all(SEED.map(enrichItem));
        setLibrary(enriched);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  const updateItem = useCallback((updated) => {
    setLibrary(prev => prev.map(i => i.tmdbId === updated.tmdbId ? updated : i));
    if (detail?.tmdbId === updated.tmdbId) setDetail(updated);
  }, [detail]);

  const addFromSearch = async (result) => {
    const seed = { tmdbId: result.id, type: result.media_type, progress: null, lists: ["Watchlist"], rating: null, notes: [] };
    try {
      const enriched = await enrichItem(seed);
      setLibrary(prev => [enriched, ...prev]);
    } catch {}
  };

  const watching = library.filter(i => (i.lists || []).includes("Watching"));
  const watchlist = library.filter(i => (i.lists || []).includes("Watchlist"));

  const filteredLibrary = listFilter === "All" ? library : library.filter(i => (i.lists || []).includes(listFilter));

  const getNextEp = (item) => {
    if (!item.progress || !item.seasons) return null;
    for (const s of item.seasons) {
      for (const e of (s.episodes || [])) {
        if (s.season_number === item.progress.s && e.episode_number === item.progress.e + 1) return `S${s.season_number}E${e.episode_number}`;
        if (s.season_number === item.progress.s + 1 && e.episode_number === 1) return `S${s.season_number}E1`;
      }
    }
    return "Up to date";
  };

  const TABS = [
    { id: "home", label: "Home", icon: "⌂" },
    { id: "library", label: "Library", icon: "◫" },
    { id: "friends", label: "Friends", icon: "◈" },
  ];

  const ALL_LISTS = ["Watching", "Watchlist", "Finished", "With Girlfriend", "With Friends", "Date Night", "Comfort Watch"];

  return (
    <div style={{ background: "#080808", minHeight: "100vh", maxWidth: 430, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#e0e0e0", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
        input, textarea { outline: none; }
        input::placeholder, textarea::placeholder { color: #383838; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:none;} }
        .fu { animation: fadeUp 0.25s ease forwards; }
      `}</style>

      {/* ── STATUS BAR ── */}
      <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, color: "#e8e8e8", letterSpacing: -0.5 }}>SeenIt</h1>
        <button onClick={() => setSearching(true)} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, width: 38, height: 38, cursor: "pointer", color: "#888", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>⌕</button>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "16px 0 88px" }}>

        {/* HOME */}
        {tab === "home" && (
          <div className="fu">
            {/* Continue watching */}
            <div style={{ padding: "0 20px", marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#444", textTransform: "uppercase", marginBottom: 14 }}>Continue watching</div>
              {loading && <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}><Spinner /></div>}
              {!loading && watching.length === 0 && (
                <p style={{ color: "#333", fontSize: 13 }}>Nothing here yet. Add something from search.</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {watching.map((item, i) => {
                  const title = item.meta?.name || item.meta?.title || "—";
                  const next = getNextEp(item);
                  return (
                    <div key={item.tmdbId} onClick={() => setDetail(item)}
                      style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: i < watching.length - 1 ? "1px solid #111" : "none", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                      <Poster path={item.meta?.poster_path} title={title} size={48} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#e0e0e0" }}>{title}</div>
                        {item.progress && <div style={{ fontSize: 12, color: "#555" }}>Last watched: S{item.progress.s}E{item.progress.e}</div>}
                        {next && <div style={{ fontSize: 12, color: "#aaa" }}>Up next: {next}</div>}
                      </div>
                      <div style={{ alignSelf: "center", color: "#2a2a2a", fontSize: 20 }}>›</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Watchlist */}
            {watchlist.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#444", textTransform: "uppercase", marginBottom: 14, padding: "0 20px" }}>Up next to watch</div>
                <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingLeft: 20, paddingRight: 20, paddingBottom: 4 }}>
                  {watchlist.map(item => {
                    const title = item.meta?.name || item.meta?.title || "—";
                    return (
                      <div key={item.tmdbId} onClick={() => setDetail(item)} style={{ flexShrink: 0, cursor: "pointer" }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                        <Poster path={item.meta?.poster_path} title={title} size={70} radius={10} />
                        <div style={{ fontSize: 11, color: "#555", marginTop: 6, width: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>{title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* LIBRARY */}
        {tab === "library" && (
          <div className="fu">
            <div style={{ padding: "0 20px 12px", display: "flex", gap: 8, overflowX: "auto" }}>
              {["All", ...ALL_LISTS].map(l => (
                <Pill key={l} active={listFilter === l} onClick={() => setListFilter(l)}>{l}</Pill>
              ))}
            </div>
            {loading && <div style={{ display: "flex", justifyContent: "center", padding: "30px 0" }}><Spinner /></div>}
            <div style={{ padding: "0 20px", display: "flex", flexDirection: "column" }}>
              {filteredLibrary.map((item, i) => {
                const title = item.meta?.name || item.meta?.title || "—";
                const year = (item.meta?.first_air_date || item.meta?.release_date || "").slice(0,4);
                return (
                  <div key={item.tmdbId} onClick={() => setDetail(item)}
                    style={{ display: "flex", gap: 14, padding: "13px 0", borderBottom: i < filteredLibrary.length - 1 ? "1px solid #0f0f0f" : "none", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#0d0d0d"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <Poster path={item.meta?.poster_path} title={title} size={50} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#d8d8d8" }}>{title}</div>
                      <div style={{ fontSize: 12, color: "#444" }}>{item.type === "tv" ? "Series" : "Film"} · {year}</div>
                      {item.rating && <Stars value={item.rating} size={12} />}
                      {(item.lists || []).length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(item.lists || []).map(l => <span key={l} style={{ fontSize: 10, color: "#444", background: "#111", padding: "2px 8px", borderRadius: 10 }}>{l}</span>)}
                        </div>
                      )}
                    </div>
                    <div style={{ alignSelf: "center", color: "#222", fontSize: 20 }}>›</div>
                  </div>
                );
              })}
              {filteredLibrary.length === 0 && !loading && (
                <p style={{ color: "#2a2a2a", fontSize: 13, padding: "30px 0" }}>Nothing here yet.</p>
              )}
            </div>
          </div>
        )}

        {/* FRIENDS */}
        {tab === "friends" && (
          <div className="fu" style={{ padding: "0 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#444", textTransform: "uppercase", marginBottom: 14 }}>Recommendations for you</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {FRIEND_RECS.map((rec, i) => (
                <div key={i} style={{ padding: "16px 0", borderBottom: i < FRIEND_RECS.length - 1 ? "1px solid #111" : "none" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <Avatar initial={rec.initial} color={rec.color} />
                    <div style={{ fontSize: 13, color: "#888" }}><span style={{ color: "#bbb", fontWeight: 600 }}>{rec.from}</span> recommends</div>
                  </div>
                  <div style={{ display: "flex", gap: 14 }}>
                    <div style={{ width: 48, height: 72, borderRadius: 8, background: "#111", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#e0e0e0", marginBottom: 4 }}>{rec.type === "tv" ? "Series" : "Film"} #{rec.tmdbId}</div>
                      <p style={{ fontSize: 13, color: "#666", fontStyle: "italic", lineHeight: 1.5, marginBottom: 10 }}>"{rec.note}"</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ background: "#e8e8e8", border: "none", borderRadius: 8, padding: "7px 16px", color: "#0a0a0a", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
                        <button style={{ background: "transparent", border: "1px solid #1e1e1e", borderRadius: 8, padding: "7px 14px", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Skip</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#444", textTransform: "uppercase", marginBottom: 14 }}>Send a recommendation</div>
              <div style={{ background: "#0f0f0f", border: "1px solid #161616", borderRadius: 14, padding: 16 }}>
                <input placeholder="Title to recommend…" style={{ width: "100%", background: "#151515", border: "1px solid #1e1e1e", borderRadius: 8, padding: "9px 13px", color: "#ccc", fontSize: 13, fontFamily: "inherit", marginBottom: 8 }} />
                <textarea placeholder="Why they'll love it…" rows={2} style={{ width: "100%", background: "#151515", border: "1px solid #1e1e1e", borderRadius: 8, padding: "9px 13px", color: "#ccc", fontSize: 13, fontFamily: "inherit", resize: "none" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto" }}>
                  {["E","K","A","Z"].map(l => <Avatar key={l} initial={l} color={["#c0392b","#8e44ad","#27ae60","#e67e22"][["E","K","A","Z"].indexOf(l)]} size={34} />)}
                  <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px dashed #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", cursor: "pointer" }}>+</div>
                </div>
                <button style={{ marginTop: 12, width: "100%", background: "#e8e8e8", border: "none", borderRadius: 8, padding: "10px", color: "#0a0a0a", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(8,8,8,0.96)", borderTop: "1px solid #111", backdropFilter: "blur(16px)", padding: "10px 0 18px", display: "flex", justifyContent: "space-around" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "2px 28px" }}>
            <span style={{ fontSize: 18, opacity: tab === t.id ? 1 : 0.3, transition: "opacity 0.15s" }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: tab === t.id ? "#e8e8e8" : "#333", fontFamily: "inherit", letterSpacing: 0.5, transition: "color 0.15s" }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── OVERLAYS ── */}
      {searching && <SearchOverlay onClose={() => setSearching(false)} onAdd={addFromSearch} />}
      {detail && !episodes && <DetailSheet item={detail} onClose={() => setDetail(null)} onUpdate={updateItem} onOpenEpisodes={() => setEpisodes(detail)} />}
      {episodes && <EpisodeSheet item={episodes} onClose={() => setEpisodes(null)} onMarkEpisode={() => {}} />}
    </div>
  );
}
