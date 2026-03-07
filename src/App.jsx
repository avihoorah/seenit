import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lenafneepzceeiqsonul.supabase.co";
const SUPABASE_KEY = "sb_publishable_3sDR6w3j31E1zSphzowRYg_gTGQKYHp";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const TMDB_KEY = "4b152a91b5a3963ff8b43773eaa990c8";
const IMG = (p, size = "w500") => p ? `https://image.tmdb.org/t/p/${size}${p}` : null;

async function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}`);
  if (!r.ok) throw new Error("TMDB error");
  return r.json();
}

async function searchTMDB(q) {
  const d = await tmdb(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false`);
  return (d.results || []).filter(r => r.media_type === "tv" || r.media_type === "movie").slice(0, 8);
}

async function fetchMeta(tmdbId, type) {
  return tmdb(`/${type === "tv" ? "tv" : "movie"}/${tmdbId}`);
}

async function fetchSeasons(tmdbId, count) {
  const n = Math.min(count, 5);
  return Promise.all(Array.from({ length: n }, (_, i) => tmdb(`/tv/${tmdbId}/season/${i + 1}`)));
}

// ── Tiny UI ────────────────────────────────────────────────────────────────────
function Spin({ size = 20 }) {
  return <div style={{ width: size, height: size, border: `2px solid #EDE8E1`, borderTop: `2px solid #1a1a1a`, borderRadius: "50%", animation: "spin .6s linear infinite", flexShrink: 0 }} />;
}

function Stars({ value, onSet, size = 14 }) {
  const [hov, setHov] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onSet && onSet(n)}
          onMouseEnter={() => onSet && setHov(n)} onMouseLeave={() => onSet && setHov(0)}
          style={{ fontSize: size, color: n <= (hov || value || 0) ? "#1a1a1a" : "#D8D0C8", cursor: onSet ? "pointer" : "default", lineHeight: 1 }}>★</span>
      ))}
    </div>
  );
}

function Poster({ path, title, w = 80, radius = 10 }) {
  return path
    ? <img src={IMG(path)} alt={title} style={{ width: w, height: w * 1.5, objectFit: "cover", borderRadius: radius, display: "block", flexShrink: 0 }} />
    : <div style={{ width: w, height: w * 1.5, borderRadius: radius, background: "#EDE8E1", display: "flex", alignItems: "center", justifyContent: "center", color: "#C0B8AE", fontSize: w * 0.28, flexShrink: 0 }}>🎬</div>;
}

const AVATAR_COLORS = [
  { bg: "#E8D5B7", text: "#5C3D1E" }, { bg: "#D4E8D5", text: "#1E5C2A" },
  { bg: "#D5D4E8", text: "#2A1E5C" }, { bg: "#E8D5D5", text: "#5C1E1E" },
  { bg: "#D5E8E8", text: "#1E4A5C" }, { bg: "#E8E4D5", text: "#4A3D1E" },
];

function getAvatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Av({ name, size = 36, img }) {
  const c = getAvatarColor(name);
  const letter = (name || "?")[0].toUpperCase();
  if (img) return <img src={img} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: c.text, flexShrink: 0 }}>
      {letter}
    </div>
  );
}

const LISTS_ALL = ["Watching", "Watchlist", "Finished", "With Girlfriend", "With Friends", "Date Night", "Comfort Watch", "Mind Bending"];

// ── Auth Screen ────────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "login") {
        const { data, error: e } = await sb.auth.signInWithPassword({ email, password });
        if (e) throw e;
        onAuth(data.user);
      } else {
        if (!username.trim()) throw new Error("Username is required");
        if (username.includes(" ")) throw new Error("Username cannot have spaces");
        const { data, error: e } = await sb.auth.signUp({
          email, password,
          options: { data: { username: username.toLowerCase(), display_name: displayName || username } }
        });
        if (e) throw e;
        setSuccess("Account created! Check your email to confirm, then log in.");
        setMode("login");
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ background: "#FAF8F5", minHeight: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700;800&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } @keyframes spin { to { transform: rotate(360deg); } } input { outline: none; } input::placeholder { color: #B0A898; }`}</style>

      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, color: "#C0B8AE", textTransform: "uppercase", marginBottom: 8 }}>SeenIt</div>
        <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 36, color: "#1a1a1a", lineHeight: 1.15 }}>
          {mode === "login" ? "Welcome\nback." : "Create your\naccount."}
        </div>
        <div style={{ fontSize: 14, color: "#A09890", marginTop: 10 }}>
          {mode === "login" ? "Your personal TV & movie memory." : "Track everything. Remember everything."}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "signup" && (
          <>
            <input value={username} onChange={e => setUsername(e.target.value.toLowerCase())} placeholder="Username (e.g. avihoorah)"
              style={{ background: "#EDE8E1", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: "inherit", color: "#1a1a1a" }} />
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display name (e.g. Avi)"
              style={{ background: "#EDE8E1", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: "inherit", color: "#1a1a1a" }} />
          </>
        )}
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" type="email"
          style={{ background: "#EDE8E1", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: "inherit", color: "#1a1a1a" }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password"
          onKeyDown={e => e.key === "Enter" && submit()}
          style={{ background: "#EDE8E1", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontFamily: "inherit", color: "#1a1a1a" }} />

        {error && <div style={{ fontSize: 13, color: "#c0392b", background: "#fdf0ee", padding: "10px 14px", borderRadius: 8 }}>{error}</div>}
        {success && <div style={{ fontSize: 13, color: "#1e5c2a", background: "#eef8f0", padding: "10px 14px", borderRadius: 8 }}>{success}</div>}

        <button onClick={submit} disabled={loading}
          style={{ background: "#1a1a1a", border: "none", borderRadius: 12, padding: "15px", color: "#FAF8F5", fontWeight: 800, fontSize: 15, fontFamily: "inherit", cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
          {loading ? <Spin size={18} /> : (mode === "login" ? "Sign in" : "Create account")}
        </button>

        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setSuccess(""); }}
          style={{ background: "none", border: "none", color: "#A09890", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "8px 0" }}>
          {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

// ── Search Overlay ─────────────────────────────────────────────────────────────
function SearchOverlay({ onClose, onAdd, library }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    if (q.length < 2) { setRes([]); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      try { setRes(await searchTMDB(q)); } catch {}
      setBusy(false);
    }, 380);
    return () => clearTimeout(t);
  }, [q]);
  const inLib = id => library.some(l => l.tmdb_id === id);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "#FAF8F5", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 12px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid #EDE8E1" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888", padding: 0 }}>‹</button>
        <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Search movies and shows…"
          style={{ flex: 1, background: "#EDE8E1", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 15, fontFamily: "inherit", color: "#1a1a1a", outline: "none" }} />
        {busy && <Spin />}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {res.map(r => {
          const already = inLib(r.id);
          const title = r.title || r.name || "";
          const year = (r.release_date || r.first_air_date || "").slice(0, 4);
          return (
            <div key={r.id} onClick={() => { if (!already) { onAdd(r); onClose(); } }}
              style={{ display: "flex", gap: 14, padding: "12px 20px", cursor: already ? "default" : "pointer", borderBottom: "1px solid #F5F0EA" }}
              onMouseEnter={e => { if (!already) e.currentTarget.style.background = "#F5F0EA"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              <Poster path={r.poster_path} title={title} w={44} radius={8} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Instrument Serif', Georgia, serif" }}>{title}</div>
                <div style={{ fontSize: 12, color: "#A09890" }}>{r.media_type === "tv" ? "Series" : "Film"}{year ? " · " + year : ""}</div>
              </div>
              <div style={{ alignSelf: "center", fontSize: 12, fontWeight: 700, background: already ? "#EDE8E1" : "#1a1a1a", color: already ? "#A09890" : "#FAF8F5", padding: "5px 12px", borderRadius: 20 }}>
                {already ? "Added" : "+ Add"}
              </div>
            </div>
          );
        })}
        {q.length >= 2 && !busy && res.length === 0 && <div style={{ textAlign: "center", color: "#C0B8AE", fontSize: 14, padding: "50px 0" }}>No results</div>}
        {q.length < 2 && <div style={{ textAlign: "center", padding: "60px 20px 0", color: "#C0B8AE", fontSize: 14 }}>Search anything — movies, series, documentaries</div>}
      </div>
    </div>
  );
}

// ── Episode Sheet ──────────────────────────────────────────────────────────────
function EpisodeSheet({ item, onClose }) {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const meta = await fetchMeta(item.tmdb_id, item.media_type);
        const s = await fetchSeasons(item.tmdb_id, meta.number_of_seasons || 1);
        setSeasons(s);
        const m = {};
        s.forEach(season => {
          (season.episodes || []).forEach(ep => {
            const k = `${season.season_number}-${ep.episode_number}`;
            m[k] = item.progress_season
              ? season.season_number < item.progress_season ||
                (season.season_number === item.progress_season && ep.episode_number <= item.progress_episode)
              : false;
          });
        });
        setWatched(m);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const total = seasons.flatMap(s => s.episodes || []).length;
  const done = Object.values(watched).filter(Boolean).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const toggle = (s, e) => setWatched(p => ({ ...p, [`${s}-${e}`]: !p[`${s}-${e}`] }));
  const title = item._meta?.name || item._meta?.title || "—";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#FAF8F5", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #EDE8E1" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888", padding: 0 }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>{title}</div>
          <div style={{ fontSize: 12, color: "#A09890", marginTop: 2 }}>{done}/{total} watched · {pct}%</div>
        </div>
        <Poster path={item._meta?.poster_path} title={title} w={36} radius={6} />
      </div>
      <div style={{ height: 3, background: "#EDE8E1" }}><div style={{ height: "100%", width: `${pct}%`, background: "#1a1a1a", transition: "width .3s" }} /></div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading && <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Spin /></div>}
        {seasons.map(season => (
          <div key={season.season_number}>
            <div style={{ padding: "18px 20px 8px", fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase" }}>Season {season.season_number}</div>
            {(season.episodes || []).map(ep => {
              const k = `${season.season_number}-${ep.episode_number}`;
              const w = watched[k];
              return (
                <div key={ep.episode_number} onClick={() => toggle(season.season_number, ep.episode_number)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", cursor: "pointer", borderBottom: "1px solid #F5F0EA", background: w ? "#F5F0EA" : "transparent", transition: "background .1s" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${w ? "#1a1a1a" : "#D8D0C8"}`, background: w ? "#1a1a1a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>
                    {w && <span style={{ fontSize: 11, color: "#FAF8F5", fontWeight: 900 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: w ? "#B0A898" : "#1a1a1a", textDecoration: w ? "line-through" : "none", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ color: "#C0B8AE", marginRight: 8, fontSize: 11 }}>E{String(ep.episode_number).padStart(2, "0")}</span>{ep.name}
                    </div>
                    {ep.air_date && <div style={{ fontSize: 11, color: "#C0B8AE", marginTop: 2 }}>{ep.air_date}</div>}
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

// ── Detail Sheet ───────────────────────────────────────────────────────────────
function DetailSheet({ item, onClose, onUpdate, onDelete, onEpisodes, userId }) {
  const [tab, setTab] = useState("info");
  const [note, setNote] = useState("");
  const [noteRef, setNoteRef] = useState("");
  const [notes, setNotes] = useState([]);
  const [savingNote, setSavingNote] = useState(false);

  const title = item._meta?.name || item._meta?.title || "—";
  const year = (item._meta?.first_air_date || item._meta?.release_date || "").slice(0, 4);
  const overview = item._meta?.overview || "";
  const backdrop = item._meta?.backdrop_path;

  useEffect(() => {
    sb.from("notes").select("*").eq("user_id", userId).eq("tmdb_id", item.tmdb_id).order("created_at", { ascending: false })
      .then(({ data }) => setNotes(data || []));
  }, [item.tmdb_id]);

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    const { data } = await sb.from("notes").insert({ user_id: userId, tmdb_id: item.tmdb_id, ref_label: noteRef || "General", body: note }).select().single();
    if (data) setNotes(p => [data, ...p]);
    setNote(""); setNoteRef("");
    setSavingNote(false);
  };

  const toggleList = async l => {
    const ls = item.lists || [];
    const updated = ls.includes(l) ? ls.filter(x => x !== l) : [...ls, l];
    await sb.from("library").update({ lists: updated }).eq("id", item.id);
    onUpdate({ ...item, lists: updated });
  };

  const setRating = async v => {
    await sb.from("library").update({ rating: v }).eq("id", item.id);
    onUpdate({ ...item, rating: v });
  };

  const deleteItem = async () => {
    if (!confirm(`Remove ${title} from your library?`)) return;
    await sb.from("library").delete().eq("id", item.id);
    onDelete(item.id);
    onClose();
  };

  const TABS = item.media_type === "tv" ? ["info", "episodes", "notes", "lists"] : ["info", "notes", "lists"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(26,20,14,0.5)" }} onClick={onClose} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "91vh", background: "#FAF8F5", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ position: "relative", height: 200, flexShrink: 0 }}>
          {backdrop ? <img src={IMG(backdrop, "w780")} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", background: "#EDE8E1" }} />}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(250,248,245,0) 30%, rgba(250,248,245,1) 100%)" }} />
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, background: "rgba(26,20,14,0.2)", borderRadius: 2 }} />
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "rgba(250,248,245,0.8)", border: "none", width: 30, height: 30, borderRadius: "50%", color: "#888", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: "0 20px 16px", display: "flex", gap: 14, alignItems: "flex-end", marginTop: -50, position: "relative" }}>
          <Poster path={item._meta?.poster_path} title={title} w={70} radius={10} />
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.15 }}>{title}</div>
            <div style={{ fontSize: 12, color: "#A09890", marginTop: 4 }}>{item.media_type === "tv" ? "Series" : "Film"} · {year}</div>
            <div style={{ marginTop: 6 }}><Stars value={item.rating} onSet={setRating} size={15} /></div>
          </div>
        </div>
        <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid #EDE8E1", flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "#1a1a1a" : "transparent"}`, color: tab === t ? "#1a1a1a" : "#B0A898", fontFamily: "inherit", fontSize: 12, fontWeight: 700, textTransform: "capitalize", cursor: "pointer" }}>{t}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 40px" }}>
          {tab === "info" && (
            <div>
              {item._meta?.vote_average > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: "#1a1a1a", color: "#FAF8F5", padding: "4px 10px", borderRadius: 6 }}>★ {item._meta.vote_average.toFixed(1)}</span>
                  {item.media_type === "tv" && <span style={{ fontSize: 12, color: "#A09890", padding: "4px 10px", border: "1px solid #EDE8E1", borderRadius: 6 }}>{item._meta.number_of_seasons} seasons · {item._meta.number_of_episodes} eps</span>}
                </div>
              )}
              <p style={{ fontSize: 14, color: "#5C5248", lineHeight: 1.75, margin: "0 0 20px" }}>{overview || "No description available."}</p>
              <button onClick={deleteItem} style={{ background: "none", border: "1.5px solid #EDE8E1", borderRadius: 8, padding: "8px 16px", color: "#C0B8AE", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}>Remove from library</button>
            </div>
          )}
          {tab === "episodes" && item.media_type === "tv" && (
            <div>
              {item.progress_season && (
                <div style={{ background: "#EDE8E1", borderRadius: 12, padding: "14px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontSize: 12, color: "#A09890", marginBottom: 2 }}>Last watched</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Instrument Serif', Georgia, serif", color: "#1a1a1a" }}>S{item.progress_season} E{item.progress_episode}</div></div>
                  <div style={{ width: 1, background: "#D8D0C8", height: 30 }} />
                  <div><div style={{ fontSize: 12, color: "#A09890", marginBottom: 2 }}>Up next</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Instrument Serif', Georgia, serif", color: "#1a1a1a" }}>S{item.progress_season} E{item.progress_episode + 1}</div></div>
                </div>
              )}
              <button onClick={onEpisodes} style={{ width: "100%", background: "#1a1a1a", border: "none", borderRadius: 12, padding: "14px", color: "#FAF8F5", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Track Episodes →</button>
            </div>
          )}
          {tab === "notes" && (
            <div>
              <input value={noteRef} onChange={e => setNoteRef(e.target.value)} placeholder="Episode or moment (e.g. S2E4)"
                style={{ width: "100%", background: "#EDE8E1", border: "none", borderRadius: 8, padding: "10px 13px", fontSize: 13, fontFamily: "inherit", color: "#1a1a1a", marginBottom: 8, boxSizing: "border-box", outline: "none" }} />
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Your thoughts, who to watch with, what hit you…"
                style={{ width: "100%", background: "#EDE8E1", border: "none", borderRadius: 8, padding: "10px 13px", fontSize: 13, fontFamily: "inherit", color: "#1a1a1a", resize: "none", boxSizing: "border-box", outline: "none" }} />
              <button onClick={saveNote} disabled={savingNote} style={{ marginTop: 8, background: "#1a1a1a", border: "none", borderRadius: 8, padding: "10px 22px", color: "#FAF8F5", fontWeight: 700, fontSize: 13, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                {savingNote ? <Spin size={14} /> : "Save note"}
              </button>
              <div style={{ marginTop: 20 }}>
                {notes.length === 0 && <p style={{ fontSize: 13, color: "#C0B8AE", textAlign: "center", padding: "12px 0" }}>No notes yet.</p>}
                {notes.map(n => (
                  <div key={n.id} style={{ borderLeft: "2px solid #EDE8E1", paddingLeft: 14, marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#B0A898", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{n.ref_label} · {new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                    <p style={{ fontSize: 14, color: "#5C5248", lineHeight: 1.65, margin: 0 }}>{n.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "lists" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {LISTS_ALL.map(l => {
                const on = (item.lists || []).includes(l);
                return <button key={l} onClick={() => toggleList(l)} style={{ padding: "8px 16px", borderRadius: 20, border: `1.5px solid ${on ? "#1a1a1a" : "#D8D0C8"}`, background: on ? "#1a1a1a" : "transparent", color: on ? "#FAF8F5" : "#A09890", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{l}</button>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Friends Screen ─────────────────────────────────────────────────────────────
function FriendsScreen({ userId, profile }) {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [recs, setRecs] = useState([]);
  const [recsMeta, setRecsMeta] = useState({});
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResult, setFriendResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [recTitle, setRecTitle] = useState("");
  const [recNote, setRecNote] = useState("");
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [recSearch, setRecSearch] = useState([]);
  const [recQuery, setRecQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { loadFriends(); loadRecs(); }, []);

  const loadFriends = async () => {
    const { data } = await sb.from("friendships").select(`*, requester:requester_id(id,username,display_name), addressee:addressee_id(id,username,display_name)`).or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    const accepted = (data || []).filter(f => f.status === "accepted").map(f => f.requester_id === userId ? f.addressee : f.requester);
    const pend = (data || []).filter(f => f.status === "pending" && f.addressee_id === userId).map(f => ({ ...f.requester, friendship_id: f.id }));
    setFriends(accepted);
    setPending(pend);
  };

  const loadRecs = async () => {
    const { data } = await sb.from("recommendations").select(`*, from_user:from_user_id(username,display_name)`).eq("to_user_id", userId).eq("status", "pending");
    setRecs(data || []);
    (data || []).forEach(async r => {
      try { const m = await fetchMeta(r.tmdb_id, r.media_type); setRecsMeta(p => ({ ...p, [r.tmdb_id]: m })); } catch {}
    });
  };

  const searchFriend = async () => {
    if (!friendSearch.trim()) return;
    setSearching(true);
    const { data } = await sb.from("profiles").select("*").eq("username", friendSearch.toLowerCase().trim()).neq("id", userId).single();
    setFriendResult(data || null);
    setSearching(false);
  };

  const sendRequest = async (addresseeId) => {
    await sb.from("friendships").insert({ requester_id: userId, addressee_id: addresseeId });
    setFriendResult(null); setFriendSearch("");
    alert("Friend request sent!");
  };

  const acceptRequest = async (friendshipId) => {
    await sb.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    loadFriends();
  };

  useEffect(() => {
    if (recQuery.length < 2) { setRecSearch([]); return; }
    const t = setTimeout(async () => {
      try { setRecSearch(await searchTMDB(recQuery)); } catch {}
    }, 380);
    return () => clearTimeout(t);
  }, [recQuery]);

  const sendRec = async (tmdbItem) => {
    if (!selectedFriend) return;
    setSending(true);
    await sb.from("recommendations").insert({ from_user_id: userId, to_user_id: selectedFriend.id, tmdb_id: tmdbItem.id, media_type: tmdbItem.media_type, note: recNote });
    setSending(false); setSent(true); setRecQuery(""); setRecNote(""); setRecSearch([]);
    setTimeout(() => setSent(false), 3000);
  };

  const handleRec = async (recId, status) => {
    await sb.from("recommendations").update({ status }).eq("id", recId);
    setRecs(p => p.filter(r => r.id !== recId));
  };

  return (
    <div style={{ padding: "0 20px 100px" }}>
      {/* Pending requests */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 12 }}>Friend requests</div>
          {pending.map(p => (
            <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #EDE8E1" }}>
              <Av name={p.display_name || p.username} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{p.display_name || p.username}</div>
                <div style={{ fontSize: 12, color: "#A09890" }}>@{p.username}</div>
              </div>
              <button onClick={() => acceptRequest(p.friendship_id)} style={{ background: "#1a1a1a", border: "none", borderRadius: 8, padding: "7px 14px", color: "#FAF8F5", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Accept</button>
            </div>
          ))}
        </div>
      )}

      {/* Your friends */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>Your people ({friends.length})</div>
        {friends.length === 0 && <p style={{ fontSize: 13, color: "#C0B8AE" }}>No friends yet — add some below.</p>}
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
          {friends.map(f => (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <Av name={f.display_name || f.username} size={52} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{f.display_name || f.username}</div>
              <div style={{ fontSize: 10, color: "#B0A898" }}>@{f.username}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Add friend */}
      <div style={{ marginBottom: 24, background: "#EDE8E1", borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 10 }}>Add a friend</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={friendSearch} onChange={e => setFriendSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchFriend()} placeholder="Search by username…"
            style={{ flex: 1, background: "#FAF8F5", border: "none", borderRadius: 8, padding: "10px 13px", fontSize: 13, fontFamily: "inherit", color: "#1a1a1a", outline: "none" }} />
          <button onClick={searchFriend} disabled={searching} style={{ background: "#1a1a1a", border: "none", borderRadius: 8, padding: "10px 16px", color: "#FAF8F5", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {searching ? "…" : "Find"}
          </button>
        </div>
        {friendResult && (
          <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <Av name={friendResult.display_name || friendResult.username} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{friendResult.display_name || friendResult.username}</div>
              <div style={{ fontSize: 12, color: "#A09890" }}>@{friendResult.username}</div>
            </div>
            <button onClick={() => sendRequest(friendResult.id)} style={{ background: "#1a1a1a", border: "none", borderRadius: 8, padding: "7px 14px", color: "#FAF8F5", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
          </div>
        )}
        {friendResult === null && friendSearch && !searching && <div style={{ fontSize: 13, color: "#C0B8AE", marginTop: 10 }}>No user found with that username.</div>}
      </div>

      {/* Incoming recs */}
      {recs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>Recommended for you</div>
          {recs.map(rec => {
            const meta = recsMeta[rec.tmdb_id];
            const title = meta?.name || meta?.title || "Loading…";
            return (
              <div key={rec.id} style={{ background: "#EDE8E1", borderRadius: 16, padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <Av name={rec.from_user?.display_name || rec.from_user?.username} size={28} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{rec.from_user?.display_name || rec.from_user?.username}</span>
                  <span style={{ fontSize: 12, color: "#A09890" }}>recommends</span>
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  <Poster path={meta?.poster_path} title={title} w={54} radius={8} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{title}</div>
                    {rec.note && <p style={{ fontSize: 13, color: "#7C7268", fontStyle: "italic", lineHeight: 1.5, margin: "0 0 10px" }}>"{rec.note}"</p>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleRec(rec.id, "added")} style={{ background: "#1a1a1a", border: "none", borderRadius: 8, padding: "7px 16px", color: "#FAF8F5", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Watchlist</button>
                      <button onClick={() => handleRec(rec.id, "skipped")} style={{ background: "transparent", border: "1.5px solid #C0B8AE", borderRadius: 8, padding: "7px 14px", color: "#A09890", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Skip</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send rec */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>Send a recommendation</div>
        <div style={{ background: "#EDE8E1", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 12, color: "#A09890", marginBottom: 8 }}>Send to:</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {friends.length === 0 && <div style={{ fontSize: 13, color: "#C0B8AE" }}>Add friends first</div>}
            {friends.map(f => (
              <div key={f.id} onClick={() => setSelectedFriend(selectedFriend?.id === f.id ? null : f)}
                style={{ cursor: "pointer", opacity: selectedFriend && selectedFriend.id !== f.id ? 0.4 : 1, transition: "opacity .15s" }}>
                <Av name={f.display_name || f.username} size={40} />
              </div>
            ))}
          </div>
          <input value={recQuery} onChange={e => setRecQuery(e.target.value)} placeholder="Search what to recommend…"
            style={{ width: "100%", background: "#FAF8F5", border: "none", borderRadius: 8, padding: "10px 13px", fontSize: 13, fontFamily: "inherit", color: "#1a1a1a", marginBottom: 8, boxSizing: "border-box", outline: "none" }} />
          {recSearch.length > 0 && (
            <div style={{ background: "#FAF8F5", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
              {recSearch.slice(0, 4).map(r => (
                <div key={r.id} onClick={() => { sendRec(r); }} style={{ display: "flex", gap: 10, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #F5F0EA" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#F5F0EA"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <Poster path={r.poster_path} title={r.title || r.name} w={30} radius={4} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{r.title || r.name}</div>
                    <div style={{ fontSize: 11, color: "#A09890" }}>{r.media_type === "tv" ? "Series" : "Film"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <textarea value={recNote} onChange={e => setRecNote(e.target.value)} rows={2} placeholder="Why they'll love it…"
            style={{ width: "100%", background: "#FAF8F5", border: "none", borderRadius: 8, padding: "10px 13px", fontSize: 13, fontFamily: "inherit", color: "#1a1a1a", resize: "none", boxSizing: "border-box", outline: "none" }} />
          {sent && <div style={{ fontSize: 13, color: "#1e5c2a", marginTop: 8 }}>Recommendation sent! ✓</div>}
        </div>
      </div>
    </div>
  );
}

// ── Stats Screen ───────────────────────────────────────────────────────────────
function StatsScreen({ library, profile }) {
  const finished = library.filter(i => (i.lists || []).includes("Finished"));
  const watching = library.filter(i => (i.lists || []).includes("Watching"));
  const movies = library.filter(i => i.media_type === "movie");
  const totalEps = library.reduce((acc, i) => acc + (i.progress_season ? ((i.progress_season - 1) * 10 + i.progress_episode) : 0), 0);
  const topRated = [...library].filter(i => i.rating).sort((a, b) => b.rating - a.rating).slice(0, 5);
  const genres = {};
  library.forEach(i => { (i._meta?.genres || []).forEach(g => { genres[g.name] = (genres[g.name] || 0) + 1; }); });
  const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const name = profile?.display_name || profile?.username || "You";

  return (
    <div style={{ padding: "0 20px 100px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {[
          { label: "Finished", value: finished.length },
          { label: "Watching now", value: watching.length },
          { label: "Movies", value: movies.length },
          { label: "Episodes tracked", value: totalEps },
        ].map((s, i) => (
          <div key={i} style={{ background: i === 0 ? "#1a1a1a" : "#EDE8E1", borderRadius: 16, padding: "20px 18px" }}>
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 44, fontWeight: 700, color: i === 0 ? "#FAF8F5" : "#1a1a1a", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: i === 0 ? "#888" : "#A09890", marginTop: 6, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {topRated.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>{name}'s top rated</div>
          {topRated.map((item, i) => {
            const title = item._meta?.name || item._meta?.title || "—";
            return (
              <div key={item.id} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: i < topRated.length - 1 ? "1px solid #EDE8E1" : "none", alignItems: "center" }}>
                <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, color: "#EDE8E1", width: 32, textAlign: "center", fontWeight: 700 }}>{i + 1}</div>
                <Poster path={item._meta?.poster_path} title={title} w={40} radius={6} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{title}</div>
                  <Stars value={item.rating} size={12} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {topGenres.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 12 }}>Top genres</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topGenres.map(([name, count]) => (
              <div key={name} style={{ background: "#EDE8E1", borderRadius: 20, padding: "8px 16px", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{name}</span>
                <span style={{ fontSize: 11, color: "#A09890" }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function SeenIt() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [library, setLibrary] = useState([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [tab, setTab] = useState("home");
  const [detail, setDetail] = useState(null);
  const [episodes, setEpisodes] = useState(null);
  const [searching, setSearching] = useState(false);
  const [listFilter, setListFilter] = useState("All");
  const [authLoading, setAuthLoading] = useState(true);

  // Auth listener
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load profile
  useEffect(() => {
    if (!session) { setProfile(null); setLibrary([]); return; }
    sb.from("profiles").select("*").eq("id", session.user.id).single().then(({ data }) => setProfile(data));
    loadLibrary(session.user.id);
  }, [session]);

  const loadLibrary = async (uid) => {
    setLoadingLib(true);
    const { data } = await sb.from("library").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (!data) { setLoadingLib(false); return; }
    // Fetch TMDB meta for each item
    const enriched = await Promise.all(data.map(async item => {
      try { const meta = await fetchMeta(item.tmdb_id, item.media_type); return { ...item, _meta: meta }; }
      catch { return { ...item, _meta: null }; }
    }));
    setLibrary(enriched);
    setLoadingLib(false);
  };

  const addToLibrary = async (result) => {
    if (!session) return;
    const { data, error } = await sb.from("library").insert({
      user_id: session.user.id, tmdb_id: result.id, media_type: result.media_type, lists: ["Watchlist"]
    }).select().single();
    if (error || !data) return;
    try { const meta = await fetchMeta(result.id, result.media_type); setLibrary(p => [{ ...data, _meta: meta }, ...p]); }
    catch { setLibrary(p => [{ ...data, _meta: null }, ...p]); }
  };

  const updateItem = (updated) => {
    setLibrary(p => p.map(i => i.id === updated.id ? updated : i));
    if (detail?.id === updated.id) setDetail(updated);
  };

  const deleteItem = (id) => setLibrary(p => p.filter(i => i.id !== id));

  const signOut = async () => { await sb.auth.signOut(); setTab("home"); };

  const watching = library.filter(i => (i.lists || []).includes("Watching"));
  const watchlist = library.filter(i => (i.lists || []).includes("Watchlist"));
  const filtered = listFilter === "All" ? library : library.filter(i => (i.lists || []).includes(listFilter));

  const TABS = [
    { id: "home",    icon: "⌂", label: "Home" },
    { id: "library", icon: "◫", label: "Library" },
    { id: "friends", icon: "◈", label: "Friends" },
    { id: "stats",   icon: "◉", label: "Stats" },
  ];

  const headings = { home: "What are you\nwatching?", library: "Your library", friends: "Your people", stats: "Your stats" };

  if (authLoading) return (
    <div style={{ background: "#FAF8F5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Spin size={28} />
    </div>
  );

  if (!session) return <AuthScreen onAuth={() => {}} />;

  return (
    <div style={{ background: "#FAF8F5", minHeight: "100vh", maxWidth: 430, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        input::placeholder, textarea::placeholder { color: #B0A898; }
        textarea { outline: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .up { animation: up .28s ease forwards; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "24px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, color: "#C0B8AE", textTransform: "uppercase" }}>SeenIt</div>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, color: "#1a1a1a", lineHeight: 1.2, marginTop: 2, whiteSpace: "pre-line" }}>{headings[tab]}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
          <button onClick={() => setSearching(true)} style={{ width: 42, height: 42, borderRadius: "50%", background: "#1a1a1a", border: "none", color: "#FAF8F5", fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⌕</button>
          <div onClick={signOut} style={{ cursor: "pointer" }}>
            <Av name={profile?.display_name || profile?.username || "?"} size={42} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 0 90px" }}>

        {/* HOME */}
        {tab === "home" && (
          <div className="up">
            {loadingLib && <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Spin /></div>}
            {!loadingLib && library.length === 0 && (
              <div style={{ textAlign: "center", padding: "50px 28px" }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>🎬</div>
                <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, color: "#1a1a1a", marginBottom: 8 }}>Your library is empty</div>
                <div style={{ fontSize: 14, color: "#A09890", lineHeight: 1.6 }}>Tap the search button to add your first movie or show</div>
              </div>
            )}
            {watching.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", padding: "0 20px", marginBottom: 14 }}>Continue watching</div>
                <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 20px" }}>
                  {watching.map(item => {
                    const title = item._meta?.name || item._meta?.title || "—";
                    const backdrop = item._meta?.backdrop_path;
                    return (
                      <div key={item.id} onClick={() => setDetail(item)}
                        style={{ flexShrink: 0, width: 240, borderRadius: 16, overflow: "hidden", background: "#EDE8E1", cursor: "pointer", transition: "transform .15s" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.01)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                        {backdrop ? <img src={IMG(backdrop, "w780")} alt={title} style={{ width: "100%", height: 136, objectFit: "cover", display: "block" }} />
                          : <div style={{ width: "100%", height: 136, background: "#D8D0C8" }} />}
                        <div style={{ padding: "10px 12px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                            {item.progress_season && <div style={{ fontSize: 11, color: "#A09890" }}>Up next: S{item.progress_season} E{item.progress_episode + 1}</div>}
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#FAF8F5", fontSize: 12, flexShrink: 0 }}>▶</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {watchlist.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", padding: "0 20px", marginBottom: 14 }}>Up next to watch</div>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 20px" }}>
                  {watchlist.map(item => {
                    const title = item._meta?.name || item._meta?.title || "—";
                    return (
                      <div key={item.id} onClick={() => setDetail(item)} style={{ flexShrink: 0, cursor: "pointer" }}>
                        <Poster path={item._meta?.poster_path} title={title} w={80} radius={12} />
                        <div style={{ fontSize: 11, color: "#A09890", marginTop: 6, width: 80, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {library.length > 0 && (
              <div style={{ padding: "0 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>Friends</div>
                <div style={{ background: "#EDE8E1", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setTab("friends")}>
                  <Av name={profile?.display_name || "You"} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Recommendations & friends</div>
                    <div style={{ fontSize: 12, color: "#A09890" }}>Add friends and share what to watch</div>
                  </div>
                  <div style={{ fontSize: 20, color: "#C0B8AE" }}>›</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LIBRARY */}
        {tab === "library" && (
          <div className="up">
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 20px 16px" }}>
              {["All", ...LISTS_ALL].map(l => {
                const on = listFilter === l;
                return <button key={l} onClick={() => setListFilter(l)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${on ? "#1a1a1a" : "#D8D0C8"}`, background: on ? "#1a1a1a" : "transparent", color: on ? "#FAF8F5" : "#A09890", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>;
              })}
            </div>
            {loadingLib && <div style={{ display: "flex", justifyContent: "center", padding: "30px 0" }}><Spin /></div>}
            {(listFilter === "Finished" || listFilter === "All") ? (
              <div style={{ padding: "0 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {filtered.map(item => {
                    const title = item._meta?.name || item._meta?.title || "—";
                    return (
                      <div key={item.id} onClick={() => setDetail(item)} style={{ cursor: "pointer" }}>
                        <div style={{ aspectRatio: "2/3", borderRadius: 10, overflow: "hidden", background: "#EDE8E1" }}>
                          {item._meta?.poster_path ? <img src={IMG(item._meta.poster_path)} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#C0B8AE", fontSize: 24 }}>🎬</div>}
                        </div>
                        {item.rating && <div style={{ marginTop: 5 }}><Stars value={item.rating} size={11} /></div>}
                      </div>
                    );
                  })}
                </div>
                {filtered.length === 0 && !loadingLib && <div style={{ textAlign: "center", padding: "50px 0", color: "#C0B8AE" }}><div style={{ fontSize: 30, marginBottom: 10 }}>📭</div><div style={{ fontSize: 14 }}>Nothing here yet</div></div>}
              </div>
            ) : (
              <div style={{ padding: "0 20px" }}>
                {filtered.map((item, i) => {
                  const title = item._meta?.name || item._meta?.title || "—";
                  const year = (item._meta?.first_air_date || item._meta?.release_date || "").slice(0, 4);
                  return (
                    <div key={item.id} onClick={() => setDetail(item)} style={{ display: "flex", gap: 14, padding: "13px 0", borderBottom: i < filtered.length - 1 ? "1px solid #EDE8E1" : "none", cursor: "pointer" }}>
                      <Poster path={item._meta?.poster_path} title={title} w={50} radius={8} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                        <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>{title}</div>
                        <div style={{ fontSize: 12, color: "#A09890" }}>{item.media_type === "tv" ? "Series" : "Film"} · {year}</div>
                        {item.progress_season && <div style={{ fontSize: 11, color: "#7C7268", fontWeight: 600 }}>Last: S{item.progress_season}E{item.progress_episode}</div>}
                        {item.rating && <Stars value={item.rating} size={12} />}
                      </div>
                      <div style={{ alignSelf: "center", color: "#C0B8AE", fontSize: 20 }}>›</div>
                    </div>
                  );
                })}
                {filtered.length === 0 && !loadingLib && <div style={{ textAlign: "center", padding: "50px 0", color: "#C0B8AE" }}><div style={{ fontSize: 30, marginBottom: 10 }}>📭</div><div style={{ fontSize: 14 }}>Nothing in this list yet</div></div>}
              </div>
            )}
          </div>
        )}

        {tab === "friends" && session && <div className="up"><FriendsScreen userId={session.user.id} profile={profile} /></div>}
        {tab === "stats" && <div className="up"><StatsScreen library={library} profile={profile} /></div>}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(250,248,245,0.96)", borderTop: "1px solid #EDE8E1", backdropFilter: "blur(12px)", padding: "10px 0 18px", display: "flex", justifyContent: "space-around" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "2px 20px" }}>
            <span style={{ fontSize: 18, opacity: tab === t.id ? 1 : 0.2 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: tab === t.id ? "#1a1a1a" : "#B0A898", fontFamily: "inherit", letterSpacing: 0.5 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {searching && <SearchOverlay onClose={() => setSearching(false)} onAdd={addToLibrary} library={library} />}
      {detail && !episodes && <DetailSheet item={detail} onClose={() => setDetail(null)} onUpdate={updateItem} onDelete={deleteItem} onEpisodes={() => setEpisodes(detail)} userId={session?.user?.id} />}
      {episodes && <EpisodeSheet item={episodes} onClose={() => setEpisodes(null)} />}
    </div>
  );
}
