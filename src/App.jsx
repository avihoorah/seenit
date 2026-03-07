import { useState, useEffect, useRef } from "react";

const TMDB_KEY = "4b152a91b5a3963ff8b43773eaa990c8";
const IMG = (p, size = "w500") => p ? `https://image.tmdb.org/t/p/${size}${p}` : null;

const SEED = [
  { id: 95396,  type: "tv",    progress: { s: 1, e: 4 }, lists: ["Watching"], rating: null, notes: [{ ref: "S1E3", text: "Episode 3 destroyed me. Zozo would cry.", date: "Jan 12" }] },
  { id: 67136,  type: "tv",    progress: { s: 2, e: 2 }, lists: ["Watching"], rating: null, notes: [{ ref: "S1E9", text: "Best season finale I've ever seen. The cliffhanger.", date: "Mar 2" }] },
  { id: 84958,  type: "tv",    progress: { s: 2, e: 5 }, lists: ["Watching", "With Girlfriend"], rating: null, notes: [] },
  { id: 76331,  type: "tv",    progress: { s: 4, e: 9 }, lists: ["Finished"], rating: 5, notes: [{ ref: "S4E3", text: "Greatest episode of television. Period.", date: "May 10" }] },
  { id: 787699, type: "movie", progress: null, lists: ["Finished"], rating: 5, notes: [{ ref: "Film", text: "Third hour is the real film. Trial scenes are electric.", date: "Dec 5" }] },
  { id: 693134, type: "movie", progress: null, lists: ["Finished"], rating: 4, notes: [{ ref: "Film", text: "Visually insane. Feyd-Rautha scenes hit different.", date: "Apr 3" }] },
  { id: 238,    type: "movie", progress: null, lists: ["Watchlist"], rating: null, notes: [] },
  { id: 76479,  type: "tv",    progress: null, lists: ["Watchlist"], rating: null, notes: [] },
  { id: 1396,   type: "tv",    progress: { s: 3, e: 7 }, lists: ["Finished"], rating: 5, notes: [] },
  { id: 60574,  type: "tv",    progress: null, lists: ["Watchlist", "With Friends"], rating: null, notes: [] },
];

const FRIENDS = [
  { name: "Emile",  initial: "E", color: "#E8D5B7", textColor: "#5C3D1E", tmdbId: 1648,   type: "tv",    note: "Mind-bending time travel. Watch alone at night.", active: "2h ago",    watched: "Dark",     activity: "finished S2" },
  { name: "Kiara",  initial: "K", color: "#D4E8D5", textColor: "#1E5C2A", tmdbId: 100088, type: "tv",    note: "Nathan Fielder at his most unhinged.", active: "5h ago",    watched: "The Bear", activity: "added to list" },
  { name: "Avi",    initial: "A", color: "#D5D4E8", textColor: "#2A1E5C", tmdbId: 83867,  type: "tv",    note: "Best Star Wars content ever made.", active: "Yesterday", watched: "Andor",     activity: "gave 5 stars" },
  { name: "Zozo",   initial: "Z", color: "#E8D5D5", textColor: "#5C1E1E", tmdbId: 209867, type: "tv",    note: "You will not sleep after this.", active: "2d ago",    watched: "Beef",      activity: "finished S1" },
];

const LISTS_ALL = ["Watching", "Watchlist", "Finished", "With Girlfriend", "With Friends", "Date Night", "Comfort Watch", "Mind Bending"];

async function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}`);
  if (!r.ok) throw new Error("TMDB fetch failed");
  return r.json();
}

async function enrich(seed) {
  const endpoint = seed.type === "tv" ? "tv" : "movie";
  const base = await tmdb(`/${endpoint}/${seed.id}`);
  let seasons = [];
  if (seed.type === "tv" && base.number_of_seasons) {
    const count = Math.min(base.number_of_seasons, 4);
    seasons = await Promise.all(Array.from({ length: count }, (_, i) => tmdb(`/tv/${seed.id}/season/${i + 1}`)));
  }
  return { ...seed, meta: base, seasons };
}

async function searchTMDB(q) {
  const d = await tmdb(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false`);
  return (d.results || []).filter(r => r.media_type === "tv" || r.media_type === "movie").slice(0, 8);
}

function Stars({ value, onSet, size = 14 }) {
  const [hov, setHov] = useState(0);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onSet && onSet(n)}
          onMouseEnter={() => onSet && setHov(n)}
          onMouseLeave={() => onSet && setHov(0)}
          style={{ fontSize: size, color: n <= (hov || value || 0) ? "#1a1a1a" : "#D8D0C8", cursor: onSet ? "pointer" : "default", lineHeight: 1 }}>
          {"\u2605"}
        </span>
      ))}
    </div>
  );
}

function Av({ f, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: f.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: f.textColor, flexShrink: 0 }}>
      {f.initial}
    </div>
  );
}

function Poster({ path, title, w = 80, radius = 10 }) {
  const h = w * 1.5;
  return path
    ? <img src={IMG(path)} alt={title} style={{ width: w, height: h, objectFit: "cover", borderRadius: radius, display: "block", flexShrink: 0 }} />
    : <div style={{ width: w, height: h, borderRadius: radius, background: "#EDE8E1", display: "flex", alignItems: "center", justifyContent: "center", color: "#C0B8AE", fontSize: w * 0.3, flexShrink: 0 }}>{"🎬"}</div>;
}

function Spin() {
  return <div style={{ width: 20, height: 20, border: "2px solid #E8E0D8", borderTop: "2px solid #1a1a1a", borderRadius: "50%", animation: "spin .6s linear infinite" }} />;
}

function SearchOverlay({ onClose, onAdd, library }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef();

  useEffect(() => { ref.current && ref.current.focus(); }, []);

  useEffect(() => {
    if (q.length < 2) { setRes([]); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      try { setRes(await searchTMDB(q)); } catch(e) { console.error(e); }
      setBusy(false);
    }, 380);
    return () => clearTimeout(t);
  }, [q]);

  const inLib = (id) => library.some(l => l.id === id);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "#FAF8F5", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 12px", display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid #EDE8E1" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888", lineHeight: 1, padding: 0 }}>{"‹"}</button>
        <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Search movies and shows..."
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
        {q.length >= 2 && !busy && res.length === 0 && (
          <div style={{ textAlign: "center", color: "#C0B8AE", fontSize: 14, padding: "50px 0" }}>No results for "{q}"</div>
        )}
        {q.length < 2 && (
          <div style={{ textAlign: "center", padding: "60px 20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{"🔍"}</div>
            <div style={{ fontSize: 14, color: "#C0B8AE" }}>Search anything — movies, series, documentaries</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EpisodeSheet({ item, onClose }) {
  const title = item.meta ? (item.meta.name || item.meta.title || "—") : "—";

  const initWatched = () => {
    const m = {};
    (item.seasons || []).forEach(s => {
      (s.episodes || []).forEach(e => {
        const k = s.season_number + "-" + e.episode_number;
        m[k] = item.progress
          ? (s.season_number < item.progress.s || (s.season_number === item.progress.s && e.episode_number <= item.progress.e))
          : false;
      });
    });
    return m;
  };

  const [watched, setWatched] = useState(initWatched);
  const allEps = (item.seasons || []).flatMap(s => (s.episodes || []));
  const total = allEps.length;
  const done = Object.values(watched).filter(Boolean).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const toggle = (s, e) => {
    const k = s + "-" + e;
    setWatched(prev => Object.assign({}, prev, { [k]: !prev[k] }));
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#FAF8F5", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #EDE8E1" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#888", padding: 0 }}>{"‹"}</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>{title}</div>
          <div style={{ fontSize: 12, color: "#A09890", marginTop: 2 }}>{done}/{total} watched · {pct}%</div>
        </div>
        <Poster path={item.meta && item.meta.poster_path} title={title} w={36} radius={6} />
      </div>
      <div style={{ height: 3, background: "#EDE8E1" }}>
        <div style={{ height: "100%", width: pct + "%", background: "#1a1a1a", transition: "width .3s" }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {(item.seasons || []).map(season => (
          <div key={season.season_number}>
            <div style={{ padding: "18px 20px 8px", fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase" }}>Season {season.season_number}</div>
            {(season.episodes || []).map(ep => {
              const k = season.season_number + "-" + ep.episode_number;
              const w = watched[k];
              return (
                <div key={ep.episode_number} onClick={() => toggle(season.season_number, ep.episode_number)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", cursor: "pointer", borderBottom: "1px solid #F5F0EA", background: w ? "#F5F0EA" : "transparent" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid " + (w ? "#1a1a1a" : "#D8D0C8"), background: w ? "#1a1a1a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>
                    {w && <span style={{ fontSize: 11, color: "#FAF8F5", fontWeight: 900 }}>{"✓"}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: w ? "#B0A898" : "#1a1a1a", textDecoration: w ? "line-through" : "none", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ color: "#C0B8AE", marginRight: 8, fontSize: 11 }}>{"E" + String(ep.episode_number).padStart(2,"0")}</span>
                      {ep.name}
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

function DetailSheet({ item, onClose, onUpdate, onEpisodes }) {
  const [tab, setTab] = useState("info");
  const [note, setNote] = useState("");
  const [noteRef, setNoteRef] = useState("");

  const title = item.meta ? (item.meta.name || item.meta.title || "—") : "—";
  const year = item.meta ? ((item.meta.first_air_date || item.meta.release_date || "").slice(0, 4)) : "";
  const overview = item.meta ? (item.meta.overview || "") : "";
  const backdrop = item.meta && item.meta.backdrop_path;

  const saveNote = () => {
    if (!note.trim()) return;
    onUpdate(Object.assign({}, item, { notes: (item.notes || []).concat([{ ref: noteRef || "General", text: note, date: "Just now" }]) }));
    setNote(""); setNoteRef("");
  };

  const toggleList = l => {
    const ls = item.lists || [];
    onUpdate(Object.assign({}, item, { lists: ls.includes(l) ? ls.filter(x => x !== l) : ls.concat([l]) }));
  };

  const TABS = item.type === "tv" ? ["info", "episodes", "notes", "lists"] : ["info", "notes", "lists"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(26,20,14,0.5)" }} onClick={onClose} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "91vh", background: "#FAF8F5", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ position: "relative", height: 200, flexShrink: 0 }}>
          {backdrop
            ? <img src={IMG(backdrop, "w780")} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", background: "#EDE8E1" }} />}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(250,248,245,0) 30%, rgba(250,248,245,1) 100%)" }} />
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 40, height: 4, background: "rgba(26,20,14,0.2)", borderRadius: 2 }} />
          <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "rgba(250,248,245,0.8)", border: "none", width: 30, height: 30, borderRadius: "50%", color: "#888", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{"×"}</button>
        </div>
        <div style={{ padding: "0 20px 16px", display: "flex", gap: 14, alignItems: "flex-end", marginTop: -50, position: "relative" }}>
          <Poster path={item.meta && item.meta.poster_path} title={title} w={70} radius={10} />
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 22, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.15 }}>{title}</div>
            <div style={{ fontSize: 12, color: "#A09890", marginTop: 4 }}>{item.type === "tv" ? "Series" : "Film"} · {year}</div>
            <div style={{ marginTop: 6 }}><Stars value={item.rating} onSet={v => onUpdate(Object.assign({}, item, { rating: v }))} size={15} /></div>
          </div>
        </div>
        <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid #EDE8E1", flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 14px", background: "none", border: "none", borderBottom: "2px solid " + (tab === t ? "#1a1a1a" : "transparent"), color: tab === t ? "#1a1a1a" : "#B0A898", fontFamily: "inherit", fontSize: 12, fontWeight: 700, textTransform: "capitalize", cursor: "pointer" }}>{t}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 40px" }}>
          {tab === "info" && (
            <div>
              {item.meta && item.meta.vote_average > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: "#1a1a1a", color: "#FAF8F5", padding: "4px 10px", borderRadius: 6 }}>{"★ " + item.meta.vote_average.toFixed(1)}</span>
                  {item.type === "tv" && item.meta.number_of_seasons && (
                    <span style={{ fontSize: 12, color: "#A09890", padding: "4px 10px", border: "1px solid #EDE8E1", borderRadius: 6 }}>{item.meta.number_of_seasons + " seasons · " + item.meta.number_of_episodes + " eps"}</span>
                  )}
                </div>
              )}
              <p style={{ fontSize: 14, color: "#5C5248", lineHeight: 1.75, margin: 0 }}>{overview || "No description available."}</p>
            </div>
          )}
          {tab === "episodes" && item.type === "tv" && (
            <div>
              {item.progress && (
                <div style={{ background: "#EDE8E1", borderRadius: 12, padding: "14px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#A09890", marginBottom: 2 }}>Last watched</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Instrument Serif', Georgia, serif", color: "#1a1a1a" }}>{"S" + item.progress.s + " E" + item.progress.e}</div>
                  </div>
                  <div style={{ width: 1, background: "#D8D0C8", height: 30 }} />
                  <div>
                    <div style={{ fontSize: 12, color: "#A09890", marginBottom: 2 }}>Up next</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Instrument Serif', Georgia, serif", color: "#1a1a1a" }}>{"S" + item.progress.s + " E" + (item.progress.e + 1)}</div>
                  </div>
                </div>
              )}
              <button onClick={onEpisodes} style={{ width: "100%", background: "#1a1a1a", border: "none", borderRadius: 12, padding: "14px", color: "#FAF8F5", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Track Episodes →
              </button>
            </div>
          )}
          {tab === "notes" && (
            <div>
              <input value={noteRef} onChange={e => setNoteRef(e.target.value)} placeholder="Episode or moment (e.g. S2E4)"
                style={{ width: "100%", background: "#EDE8E1", border: "none", borderRadius: 8, padding: "10px 13px", fontSize: 13, fontFamily: "inherit", color: "#1a1a1a", marginBottom: 8, boxSizing: "border-box", outline: "none" }} />
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Your thoughts, who to watch with, what hit you..."
                style={{ width: "100%", background: "#EDE8E1", border: "none", borderRadius: 8, padding: "10px 13px", fontSize: 13, fontFamily: "inherit", color: "#1a1a1a", resize: "none", boxSizing: "border-box", outline: "none" }} />
              <button onClick={saveNote} style={{ marginTop: 8, background: "#1a1a1a", border: "none", borderRadius: 8, padding: "10px 22px", color: "#FAF8F5", fontWeight: 700, fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>Save note</button>
              <div style={{ marginTop: 20 }}>
                {(item.notes || []).length === 0 && <p style={{ fontSize: 13, color: "#C0B8AE", textAlign: "center", padding: "12px 0" }}>No notes yet.</p>}
                {(item.notes || []).map((n, i) => (
                  <div key={i} style={{ borderLeft: "2px solid #EDE8E1", paddingLeft: 14, marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#B0A898", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{n.ref + " · " + n.date}</div>
                    <p style={{ fontSize: 14, color: "#5C5248", lineHeight: 1.65, margin: 0 }}>{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "lists" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {LISTS_ALL.map(l => {
                const on = (item.lists || []).includes(l);
                return (
                  <button key={l} onClick={() => toggleList(l)} style={{ padding: "8px 16px", borderRadius: 20, border: "1.5px solid " + (on ? "#1a1a1a" : "#D8D0C8"), background: on ? "#1a1a1a" : "transparent", color: on ? "#FAF8F5" : "#A09890", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{l}</button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsScreen({ library }) {
  const finished = library.filter(i => (i.lists || []).includes("Finished"));
  const watching = library.filter(i => (i.lists || []).includes("Watching"));
  const movies = finished.filter(i => i.type === "movie");
  const totalEps = library.reduce((acc, item) => acc + (item.progress ? ((item.progress.s - 1) * 10 + item.progress.e) : 0), 0);
  const topRated = finished.filter(i => i.rating).sort((a, b) => b.rating - a.rating).slice(0, 3);
  const genres = {};
  library.forEach(item => { ((item.meta && item.meta.genres) || []).forEach(g => { genres[g.name] = (genres[g.name] || 0) + 1; }); });
  const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ padding: "0 20px 100px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {[
          { label: "Titles finished", value: finished.length },
          { label: "Watching now",    value: watching.length },
          { label: "Movies watched",  value: movies.length },
          { label: "Episodes tracked",value: totalEps },
        ].map((s, i) => (
          <div key={i} style={{ background: i === 0 ? "#1a1a1a" : "#EDE8E1", borderRadius: 16, padding: "20px 18px" }}>
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 44, fontWeight: 700, color: i === 0 ? "#FAF8F5" : "#1a1a1a", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: i === 0 ? "#888" : "#A09890", marginTop: 6, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {topRated.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>Your top rated</div>
          {topRated.map((item, i) => {
            const title = item.meta ? (item.meta.name || item.meta.title || "—") : "—";
            return (
              <div key={item.id} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: i < topRated.length - 1 ? "1px solid #EDE8E1" : "none", alignItems: "center" }}>
                <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, fontWeight: 700, color: "#EDE8E1", width: 32, textAlign: "center" }}>{i + 1}</div>
                <Poster path={item.meta && item.meta.poster_path} title={title} w={40} radius={6} />
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

function FriendsScreen({ library }) {
  const [recMeta, setRecMeta] = useState({});
  const [sending, setSending] = useState(null);
  const [recNote, setRecNote] = useState("");
  const [recTitle, setRecTitle] = useState("");

  useEffect(() => {
    FRIENDS.forEach(async f => {
      try {
        const d = await tmdb("/" + (f.type === "tv" ? "tv" : "movie") + "/" + f.tmdbId);
        setRecMeta(p => Object.assign({}, p, { [f.tmdbId]: d }));
      } catch(e) { console.error(e); }
    });
  }, []);

  return (
    <div style={{ padding: "0 20px 100px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>Your people</div>
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
          {FRIENDS.map(f => (
            <div key={f.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <Av f={f} size={52} />
                <div style={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: "50%", background: f.active === "2h ago" ? "#4CAF50" : "#D8D0C8", border: "2px solid #FAF8F5" }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{f.name}</div>
              <div style={{ fontSize: 10, color: "#B0A898" }}>{f.active}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>Recent activity</div>
        {FRIENDS.map((f, i) => {
          const meta = recMeta[f.tmdbId];
          return (
            <div key={f.name} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < FRIENDS.length - 1 ? "1px solid #EDE8E1" : "none", alignItems: "center" }}>
              <Av f={f} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#1a1a1a" }}>
                  <span style={{ fontWeight: 700 }}>{f.name}</span>
                  <span style={{ color: "#A09890" }}> {f.activity} </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#5C5248", fontFamily: "'Instrument Serif', Georgia, serif" }}>{meta ? (meta.name || meta.title) : f.watched}</div>
              </div>
              {meta && meta.poster_path && <Poster path={meta.poster_path} title={meta.name || meta.title} w={36} radius={6} />}
            </div>
          );
        })}
      </div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>They think you will love</div>
        {FRIENDS.slice(0, 3).map((f, i) => {
          const meta = recMeta[f.tmdbId];
          const title = meta ? (meta.name || meta.title || "—") : "Loading...";
          return (
            <div key={f.name} style={{ background: "#EDE8E1", borderRadius: 16, padding: 16, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <Av f={f} size={28} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{f.name}</span>
                <span style={{ fontSize: 12, color: "#A09890" }}>recommends</span>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <Poster path={meta && meta.poster_path} title={title} w={54} radius={8} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>{title}</div>
                  <p style={{ fontSize: 13, color: "#7C7268", fontStyle: "italic", lineHeight: 1.5, margin: "0 0 10px" }}>{'"' + f.note + '"'}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ background: "#1a1a1a", border: "none", borderRadius: 8, padding: "7px 16px", color: "#FAF8F5", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Watchlist</button>
                    <button style={{ background: "transparent", border: "1.5px solid #C0B8AE", borderRadius: 8, padding: "7px 14px", color: "#A09890", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Skip</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>Send a recommendation</div>
        <div style={{ background: "#EDE8E1", borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {FRIENDS.map(f => (
              <div key={f.name} onClick={() => setSending(sending === f.name ? null : f.name)}
                style={{ opacity: sending && sending !== f.name ? 0.4 : 1, transition: "opacity .15s", cursor: "pointer" }}>
                <Av f={f} size={38} />
              </div>
            ))}
          </div>
          <input value={recTitle} onChange={e => setRecTitle(e.target.value)} placeholder="What should they watch?"
            style={{ width: "100%", background: "#FAF8F5", border: "none", borderRadius: 8, padding: "10px 13px", fontSize: 13, fontFamily: "inherit", color: "#1a1a1a", marginBottom: 8, boxSizing: "border-box", outline: "none" }} />
          <textarea value={recNote} onChange={e => setRecNote(e.target.value)} rows={2} placeholder="Why they will love it..."
            style={{ width: "100%", background: "#FAF8F5", border: "none", borderRadius: 8, padding: "10px 13px", fontSize: 13, fontFamily: "inherit", color: "#1a1a1a", resize: "none", boxSizing: "border-box", outline: "none" }} />
          <button style={{ marginTop: 10, width: "100%", background: "#1a1a1a", border: "none", borderRadius: 10, padding: "12px", color: "#FAF8F5", fontWeight: 700, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default function SeenIt() {
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [detail, setDetail] = useState(null);
  const [episodes, setEpisodes] = useState(null);
  const [searching, setSearching] = useState(false);
  const [listFilter, setListFilter] = useState("All");

  useEffect(() => {
    (async () => {
      try {
        const enriched = await Promise.all(SEED.map(enrich));
        setLibrary(enriched);
      } catch(e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const update = item => {
    setLibrary(p => p.map(i => i.id === item.id ? item : i));
    if (detail && detail.id === item.id) setDetail(item);
  };

  const addFromSearch = async r => {
    if (library.some(i => i.id === r.id)) return;
    const seed = { id: r.id, type: r.media_type, progress: null, lists: ["Watchlist"], rating: null, notes: [] };
    try { const enriched = await enrich(seed); setLibrary(p => [enriched].concat(p)); } catch(e) { console.error(e); }
  };

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

  return (
    <div style={{ background: "#FAF8F5", minHeight: "100vh", maxWidth: 430, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; height: 0; }
        input::placeholder, textarea::placeholder { color: #B0A898; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .up { animation: up .28s ease forwards; }
      `}</style>

      <div style={{ padding: "24px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, color: "#C0B8AE", textTransform: "uppercase" }}>SeenIt</div>
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, color: "#1a1a1a", lineHeight: 1.2, marginTop: 2, whiteSpace: "pre-line" }}>{headings[tab]}</div>
        </div>
        <button onClick={() => setSearching(true)} style={{ marginTop: 4, width: 42, height: 42, borderRadius: "50%", background: "#1a1a1a", border: "none", color: "#FAF8F5", fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{"⌕"}</button>
      </div>

      <div style={{ padding: "20px 0 90px" }}>
        {tab === "home" && (
          <div className="up">
            {loading && <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><Spin /></div>}
            {watching.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", padding: "0 20px", marginBottom: 14 }}>Continue watching</div>
                <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 20px" }}>
                  {watching.map(item => {
                    const title = item.meta ? (item.meta.name || item.meta.title || "—") : "—";
                    const backdrop = item.meta && item.meta.backdrop_path;
                    return (
                      <div key={item.id} onClick={() => setDetail(item)}
                        style={{ flexShrink: 0, width: 240, borderRadius: 16, overflow: "hidden", background: "#EDE8E1", cursor: "pointer", transition: "transform .15s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.01)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
                        {backdrop
                          ? <img src={IMG(backdrop, "w780")} alt={title} style={{ width: "100%", height: 136, objectFit: "cover", display: "block" }} />
                          : <div style={{ width: "100%", height: 136, background: "#D8D0C8" }} />}
                        <div style={{ padding: "10px 12px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                            {item.progress && <div style={{ fontSize: 11, color: "#A09890" }}>{"Up next: S" + item.progress.s + " E" + (item.progress.e + 1)}</div>}
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#FAF8F5", fontSize: 12, flexShrink: 0 }}>{"▶"}</div>
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
                    const title = item.meta ? (item.meta.name || item.meta.title || "—") : "—";
                    return (
                      <div key={item.id} onClick={() => setDetail(item)} style={{ flexShrink: 0, cursor: "pointer" }}>
                        <Poster path={item.meta && item.meta.poster_path} title={title} w={80} radius={12} />
                        <div style={{ fontSize: 11, color: "#A09890", marginTop: 6, width: 80, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ padding: "0 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "#B0A898", textTransform: "uppercase", marginBottom: 14 }}>Friends recommend</div>
              <div style={{ background: "#EDE8E1", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setTab("friends")}>
                <div style={{ display: "flex" }}>
                  {FRIENDS.slice(0, 3).map((f, i) => (
                    <div key={f.name} style={{ marginLeft: i > 0 ? -10 : 0, position: "relative", zIndex: 3 - i }}>
                      <Av f={f} size={36} />
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>Emile, Kiara & Avi</div>
                  <div style={{ fontSize: 12, color: "#A09890" }}>have recommendations for you</div>
                </div>
                <div style={{ fontSize: 20, color: "#C0B8AE" }}>{"›"}</div>
              </div>
            </div>
          </div>
        )}

        {tab === "library" && (
          <div className="up">
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 20px 16px" }}>
              {["All"].concat(LISTS_ALL).map(l => {
                const on = listFilter === l;
                return (
                  <button key={l} onClick={() => setListFilter(l)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (on ? "#1a1a1a" : "#D8D0C8"), background: on ? "#1a1a1a" : "transparent", color: on ? "#FAF8F5" : "#A09890", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
                );
              })}
            </div>
            {loading && <div style={{ display: "flex", justifyContent: "center", padding: "30px 0" }}><Spin /></div>}
            {(listFilter === "Finished" || listFilter === "All") ? (
              <div style={{ padding: "0 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {filtered.map(item => {
                    const title = item.meta ? (item.meta.name || item.meta.title || "—") : "—";
                    return (
                      <div key={item.id} onClick={() => setDetail(item)} style={{ cursor: "pointer" }}>
                        <div style={{ aspectRatio: "2/3", borderRadius: 10, overflow: "hidden", background: "#EDE8E1" }}>
                          {item.meta && item.meta.poster_path
                            ? <img src={IMG(item.meta.poster_path)} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#C0B8AE", fontSize: 24 }}>{"🎬"}</div>}
                        </div>
                        {item.rating && <div style={{ marginTop: 5 }}><Stars value={item.rating} size={11} /></div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ padding: "0 20px" }}>
                {filtered.map((item, i) => {
                  const title = item.meta ? (item.meta.name || item.meta.title || "—") : "—";
                  const year = item.meta ? ((item.meta.first_air_date || item.meta.release_date || "").slice(0, 4)) : "";
                  return (
                    <div key={item.id} onClick={() => setDetail(item)}
                      style={{ display: "flex", gap: 14, padding: "13px 0", borderBottom: i < filtered.length - 1 ? "1px solid #EDE8E1" : "none", cursor: "pointer" }}>
                      <Poster path={item.meta && item.meta.poster_path} title={title} w={50} radius={8} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
                        <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>{title}</div>
                        <div style={{ fontSize: 12, color: "#A09890" }}>{(item.type === "tv" ? "Series" : "Film") + " · " + year}</div>
                        {item.progress && <div style={{ fontSize: 11, color: "#7C7268", fontWeight: 600 }}>{"Last: S" + item.progress.s + "E" + item.progress.e}</div>}
                        {item.rating && <Stars value={item.rating} size={12} />}
                      </div>
                      <div style={{ alignSelf: "center", color: "#C0B8AE", fontSize: 20 }}>{"›"}</div>
                    </div>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <div style={{ textAlign: "center", padding: "50px 0", color: "#C0B8AE" }}>
                    <div style={{ fontSize: 30, marginBottom: 10 }}>{"📭"}</div>
                    <div style={{ fontSize: 14 }}>Nothing in this list yet</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "friends" && <div className="up"><FriendsScreen library={library} /></div>}
        {tab === "stats" && <div className="up"><StatsScreen library={library} /></div>}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(250,248,245,0.96)", borderTop: "1px solid #EDE8E1", backdropFilter: "blur(12px)", padding: "10px 0 18px", display: "flex", justifyContent: "space-around" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: "2px 20px" }}>
            <span style={{ fontSize: 18, opacity: tab === t.id ? 1 : 0.2, transition: "opacity .15s" }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: tab === t.id ? "#1a1a1a" : "#B0A898", fontFamily: "inherit", letterSpacing: 0.5 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {searching && <SearchOverlay onClose={() => setSearching(false)} onAdd={addFromSearch} library={library} />}
      {detail && !episodes && <DetailSheet item={detail} onClose={() => setDetail(null)} onUpdate={update} onEpisodes={() => setEpisodes(detail)} />}
      {episodes && <EpisodeSheet item={episodes} onClose={() => setEpisodes(null)} />}
    </div>
  );
}
