import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const TMDB_KEY = import.meta.env.VITE_TMDB_KEY;
const IMG = (p, size = "w500") => p ? `https://image.tmdb.org/t/p/${size}${p}` : null;

const SAGE = "#7A9E7E";
const SAGE_LIGHT = "#EBF2EB";
const BG = "#F8F6F2";
const CARD = "#F0EDE8";
const BORDER = "#E8E2DA";
const TEXT = "#1C1C1A";
const TEXT2 = "#8A8278";
const TEXT3 = "#B8B0A6";

const LISTS_ALL = ["Watching","Watchlist","Finished","With Girlfriend","With Friends","Date Night","Comfort Watch","Mind Bending"];

async function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`https://api.themoviedb.org/3${path}${sep}api_key=${TMDB_KEY}`);
  if (!r.ok) throw new Error("TMDB");
  return r.json();
}
async function searchTMDB(q) {
  const d = await tmdb(`/search/multi?query=${encodeURIComponent(q)}&include_adult=false`);
  return (d.results||[]).filter(r=>r.media_type==="tv"||r.media_type==="movie").slice(0,8);
}
async function fetchMeta(id,type){ return tmdb(`/${type==="tv"?"tv":"movie"}/${id}`); }
async function fetchSeasons(id,count){
  const n=Math.min(count||1,5);
  return Promise.all(Array.from({length:n},(_,i)=>tmdb(`/tv/${id}/season/${i+1}`)));
}
async function fetchUpcoming(ids){
  const results=[];
  for(const {id,type} of ids){
    if(type!=="tv") continue;
    try{
      const d=await tmdb(`/tv/${id}`);
      if(d.next_episode_to_air){
        results.push({tmdb_id:id,show:d.name,poster:d.poster_path,episode:d.next_episode_to_air});
      }
    }catch{}
  }
  return results;
}
async function fetchRecommended(genres){
  try{
    const topGenre=genres[0]?.id;
    const path=topGenre
      ?`/discover/tv?with_genres=${topGenre}&sort_by=popularity.desc&page=1`
      :`/trending/tv/week`;
    const d=await tmdb(path);
    return (d.results||[]).slice(0,8);
  }catch{ return []; }
}

// ── Primitives ─────────────────────────────────────────────────────────────────
function Spin({size=20}){
  return <div style={{width:size,height:size,border:`2px solid ${BORDER}`,borderTop:`2px solid ${TEXT}`,borderRadius:"50%",animation:"spin .6s linear infinite",flexShrink:0}}/>;
}

function Stars({value,onSet,size=14}){
  const [hov,setHov]=useState(0);
  return(
    <div style={{display:"flex",gap:2}}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onClick={()=>onSet&&onSet(n)}
          onMouseEnter={()=>onSet&&setHov(n)} onMouseLeave={()=>onSet&&setHov(0)}
          style={{fontSize:size,color:n<=(hov||value||0)?TEXT:TEXT3,cursor:onSet?"pointer":"default",lineHeight:1}}>★</span>
      ))}
    </div>
  );
}

function Poster({path,title,w=80,radius=10}){
  return path
    ?<img src={IMG(path)} alt={title} style={{width:w,height:w*1.5,objectFit:"cover",borderRadius:radius,display:"block",flexShrink:0}}/>
    :<div style={{width:w,height:w*1.5,borderRadius:radius,background:CARD,display:"flex",alignItems:"center",justifyContent:"center",color:TEXT3,fontSize:w*0.28,flexShrink:0}}>🎬</div>;
}

const AV_COLORS=[
  {bg:"#E8D5B7",tx:"#5C3D1E"},{bg:"#D4E8D5",tx:"#1E5C2A"},
  {bg:"#D5D4E8",tx:"#2A1E5C"},{bg:"#E8D5D5",tx:"#5C1E1E"},
  {bg:"#D5E8E8",tx:"#1E4A5C"},{bg:"#E8E4D5",tx:"#4A3D1E"},
];
function avColor(s){
  if(!s) return AV_COLORS[0];
  let h=0; for(let i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h);
  return AV_COLORS[Math.abs(h)%AV_COLORS.length];
}
function Av({name,size=36}){
  const c=avColor(name);
  return(
    <div style={{width:size,height:size,borderRadius:"50%",background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:800,color:c.tx,flexShrink:0}}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

function SectionLabel({children}){
  return <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:TEXT3,textTransform:"uppercase",marginBottom:14}}>{children}</div>;
}

function StatusBadge({lists=[]}){
  const watching=lists.includes("Watching");
  const finished=lists.includes("Finished");
  if(finished) return <span style={{fontSize:10,fontWeight:700,background:"#FFF3E0",color:"#E65100",padding:"2px 8px",borderRadius:10}}>Finished</span>;
  if(watching) return <span style={{fontSize:10,fontWeight:700,background:SAGE_LIGHT,color:SAGE,padding:"2px 8px",borderRadius:10}}>Watching</span>;
  return <span style={{fontSize:10,fontWeight:700,background:CARD,color:TEXT3,padding:"2px 8px",borderRadius:10}}>Watchlist</span>;
}

// ── Auth ───────────────────────────────────────────────────────────────────────
function AuthScreen(){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [username,setUsername]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  const submit=async()=>{
    setError(""); setSuccess(""); setLoading(true);
    try{
      if(mode==="login"){
        const {error:e}=await sb.auth.signInWithPassword({email,password});
        if(e) throw e;
      } else {
        if(!username.trim()) throw new Error("Username is required");
        if(username.includes(" ")) throw new Error("Username cannot contain spaces");
        const {error:e}=await sb.auth.signUp({email,password,options:{data:{username:username.toLowerCase(),display_name:displayName||username}}});
        if(e) throw e;
        setSuccess("Account created! You can now sign in.");
        setMode("login");
      }
    }catch(e){ setError(e.message); }
    setLoading(false);
  };

  return(
    <div style={{background:BG,minHeight:"100dvh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 28px",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <div style={{marginBottom:48}}>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:3,color:TEXT3,textTransform:"uppercase",marginBottom:10}}>SeenIt</div>
        <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:38,color:TEXT,lineHeight:1.15,whiteSpace:"pre-line"}}>
          {mode==="login"?"Welcome\nback.":"Create your\naccount."}
        </div>
        <div style={{fontSize:14,color:TEXT2,marginTop:10,lineHeight:1.6}}>
          {mode==="login"?"Your personal TV & movie memory.":"Track everything. Remember everything."}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {mode==="signup"&&<>
          <input value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} placeholder="Username (e.g. avihoorah)"
            style={{background:CARD,border:"none",borderRadius:12,padding:"14px 16px",fontSize:15,fontFamily:"inherit",color:TEXT,outline:"none"}}/>
          <input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Display name (e.g. Avi)"
            style={{background:CARD,border:"none",borderRadius:12,padding:"14px 16px",fontSize:15,fontFamily:"inherit",color:TEXT,outline:"none"}}/>
        </>}
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email"
          style={{background:CARD,border:"none",borderRadius:12,padding:"14px 16px",fontSize:15,fontFamily:"inherit",color:TEXT,outline:"none"}}/>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password"
          onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{background:CARD,border:"none",borderRadius:12,padding:"14px 16px",fontSize:15,fontFamily:"inherit",color:TEXT,outline:"none"}}/>
        {error&&<div style={{fontSize:13,color:"#c0392b",background:"#fdf0ee",padding:"10px 14px",borderRadius:8}}>{error}</div>}
        {success&&<div style={{fontSize:13,color:"#1e5c2a",background:"#eef8f0",padding:"10px 14px",borderRadius:8}}>{success}</div>}
        <button onClick={submit} disabled={loading}
          style={{background:TEXT,border:"none",borderRadius:12,padding:"15px",color:BG,fontWeight:800,fontSize:15,fontFamily:"inherit",cursor:loading?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,opacity:loading?0.7:1,marginTop:4}}>
          {loading?<Spin size={18}/>:(mode==="login"?"Sign in":"Create account")}
        </button>
        <button onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");setSuccess("");}}
          style={{background:"none",border:"none",color:TEXT2,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:"8px 0"}}>
          {mode==="login"?"Don't have an account? Sign up":"Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

// ── Rating Modal ───────────────────────────────────────────────────────────────
function RatingModal({title,onRate,onSkip}){
  const [val,setVal]=useState(0);
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(28,28,26,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:BG,borderRadius:20,padding:28,width:"100%",maxWidth:340,textAlign:"center"}}>
        <div style={{fontSize:13,color:TEXT2,marginBottom:6}}>How was it?</div>
        <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:22,color:TEXT,marginBottom:20,lineHeight:1.2}}>{title}</div>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:24}}>
          {[1,2,3,4,5].map(n=>(
            <span key={n} onClick={()=>setVal(n)}
              style={{fontSize:36,color:n<=val?TEXT:BORDER,cursor:"pointer",transition:"color .1s"}}>★</span>
          ))}
        </div>
        <button onClick={()=>val>0&&onRate(val)} style={{width:"100%",background:val>0?TEXT:CARD,border:"none",borderRadius:12,padding:"13px",color:val>0?BG:TEXT3,fontWeight:800,fontSize:15,fontFamily:"inherit",cursor:val>0?"pointer":"default",marginBottom:10,transition:"all .2s"}}>
          {val>0?`Save ${["","★","★★","★★★","★★★★","★★★★★"][val]}`:"Tap a star to rate"}
        </button>
        <button onClick={onSkip} style={{background:"none",border:"none",color:TEXT3,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Skip rating</button>
      </div>
    </div>
  );
}

// ── Search Overlay ─────────────────────────────────────────────────────────────
function SearchOverlay({onClose,onAdd,library}){
  const [q,setQ]=useState("");
  const [res,setRes]=useState([]);
  const [busy,setBusy]=useState(false);
  const ref=useRef();
  useEffect(()=>{ ref.current?.focus(); },[]);
  useEffect(()=>{
    if(q.length<2){ setRes([]); return; }
    const t=setTimeout(async()=>{
      setBusy(true);
      try{ setRes(await searchTMDB(q)); }catch{}
      setBusy(false);
    },380);
    return()=>clearTimeout(t);
  },[q]);
  const inLib=id=>library.some(l=>l.tmdb_id===id);
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:BG,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 16px 12px",display:"flex",gap:10,alignItems:"center",borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
        <button onClick={onClose} style={{background:CARD,border:"none",width:36,height:36,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:TEXT,flexShrink:0}}>‹</button>
        <input ref={ref} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search movies and shows…"
          style={{flex:1,background:CARD,border:"none",borderRadius:10,padding:"10px 14px",fontSize:15,fontFamily:"inherit",color:TEXT,outline:"none"}}/>
        {busy&&<Spin/>}
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {res.map(r=>{
          const already=inLib(r.id);
          const title=r.title||r.name||"";
          const year=(r.release_date||r.first_air_date||"").slice(0,4);
          return(
            <div key={r.id} onClick={()=>{ if(!already){onAdd(r);onClose();} }}
              style={{display:"flex",gap:14,padding:"12px 20px",cursor:already?"default":"pointer",borderBottom:`1px solid ${BORDER}`}}
              onMouseEnter={e=>{ if(!already) e.currentTarget.style.background=CARD; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
              <Poster path={r.poster_path} title={title} w={44} radius={8}/>
              <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:3}}>
                <div style={{fontSize:15,fontWeight:700,color:TEXT,fontFamily:"'Instrument Serif',Georgia,serif"}}>{title}</div>
                <div style={{fontSize:12,color:TEXT2}}>{r.media_type==="tv"?"Series":"Film"}{year?" · "+year:""}</div>
              </div>
              <div style={{alignSelf:"center",fontSize:12,fontWeight:700,background:already?CARD:TEXT,color:already?TEXT3:BG,padding:"5px 12px",borderRadius:20}}>
                {already?"Added":"+ Add"}
              </div>
            </div>
          );
        })}
        {q.length>=2&&!busy&&res.length===0&&<div style={{textAlign:"center",color:TEXT3,fontSize:14,padding:"50px 0"}}>No results for "{q}"</div>}
        {q.length<2&&(
          <div style={{textAlign:"center",padding:"60px 20px 0"}}>
            <div style={{fontSize:40,marginBottom:14}}>🎬</div>
            <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:6,fontFamily:"'Instrument Serif',Georgia,serif"}}>Search anything</div>
            <div style={{fontSize:13,color:TEXT3}}>Movies, series, documentaries</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Episode Tracker ────────────────────────────────────────────────────────────
function EpisodeSheet({item,userId,onClose,onProgressSaved}){
  const [seasons,setSeasons]=useState([]);
  const [loading,setLoading]=useState(true);
  const [watched,setWatched]=useState({});
  const [saving,setSaving]=useState(false);
  const [longPressTimer,setLongPressTimer]=useState(null);

  useEffect(()=>{
    (async()=>{
      try{
        const meta=await fetchMeta(item.tmdb_id,item.media_type);
        const s=await fetchSeasons(item.tmdb_id,meta.number_of_seasons||1);
        setSeasons(s);
        const m={};
        s.forEach(season=>{
          (season.episodes||[]).forEach(ep=>{
            const k=`${season.season_number}-${ep.episode_number}`;
            m[k]=item.progress_season
              ?season.season_number<item.progress_season||(season.season_number===item.progress_season&&ep.episode_number<=item.progress_episode)
              :false;
          });
        });
        setWatched(m);
      }catch{}
      setLoading(false);
    })();
  },[]);

  const toggle=(s,e)=>setWatched(p=>({...p,[`${s}-${e}`]:!p[`${s}-${e}`]}));

  // Long press = mark all up to this episode
  const startLongPress=(s,e)=>{
    const timer=setTimeout(()=>{
      setWatched(prev=>{
        const next={...prev};
        let marking=true;
        seasons.forEach(season=>{
          (season.episodes||[]).forEach(ep=>{
            const k=`${season.season_number}-${ep.episode_number}`;
            if(marking) next[k]=true;
            if(season.season_number===s&&ep.episode_number===e) marking=false;
          });
        });
        return next;
      });
    },500);
    setLongPressTimer(timer);
  };
  const endLongPress=()=>{ if(longPressTimer) clearTimeout(longPressTimer); };

  const save=async()=>{
    setSaving(true);
    // Find last watched episode
    let lastS=0,lastE=0;
    seasons.forEach(season=>{
      (season.episodes||[]).forEach(ep=>{
        if(watched[`${season.season_number}-${ep.episode_number}`]){
          lastS=season.season_number; lastE=ep.episode_number;
        }
      });
    });
    await sb.from("library").update({
      progress_season:lastS||null,
      progress_episode:lastE||null,
      lists: lastS ? (item.lists||[]).includes("Watching") ? item.lists : [...(item.lists||[]).filter(l=>l!=="Watchlist"),"Watching"] : item.lists
    }).eq("id",item.id);
    onProgressSaved({...item,progress_season:lastS||null,progress_episode:lastE||null});
    setSaving(false);
    onClose();
  };

  const allEps=seasons.flatMap(s=>s.episodes||[]);
  const total=allEps.length;
  const done=Object.values(watched).filter(Boolean).length;
  const pct=total?Math.round((done/total)*100):0;
  const title=item._meta?.name||item._meta?.title||"—";

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:BG,display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
        <button onClick={onClose} style={{background:CARD,border:"none",width:36,height:36,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:TEXT,flexShrink:0}}>‹</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:17,fontWeight:700,color:TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
          <div style={{fontSize:12,color:TEXT2,marginTop:1}}>{done}/{total} watched · {pct}%</div>
        </div>
        <button onClick={save} disabled={saving}
          style={{background:SAGE,border:"none",borderRadius:10,padding:"8px 16px",color:"#fff",fontWeight:800,fontSize:13,fontFamily:"inherit",cursor:saving?"default":"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {saving?<Spin size={14}/>:"Save"}
        </button>
      </div>
      {/* Progress */}
      <div style={{height:3,background:BORDER,flexShrink:0}}>
        <div style={{height:"100%",width:`${pct}%`,background:SAGE,transition:"width .3s"}}/>
      </div>
      {/* Hint */}
      <div style={{padding:"8px 20px",background:SAGE_LIGHT,borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
        <div style={{fontSize:11,color:SAGE,fontWeight:600}}>Tap to toggle · Long press to mark all watched up to here</div>
      </div>
      {/* Episodes */}
      <div style={{flex:1,overflowY:"auto"}}>
        {loading&&<div style={{display:"flex",justifyContent:"center",padding:"40px 0"}}><Spin/></div>}
        {seasons.map(season=>(
          <div key={season.season_number}>
            <div style={{padding:"16px 20px 8px",fontSize:10,fontWeight:800,letterSpacing:2,color:TEXT3,textTransform:"uppercase"}}>Season {season.season_number}</div>
            {(season.episodes||[]).map(ep=>{
              const k=`${season.season_number}-${ep.episode_number}`;
              const w=watched[k];
              return(
                <div key={ep.episode_number}
                  onClick={()=>toggle(season.season_number,ep.episode_number)}
                  onMouseDown={()=>startLongPress(season.season_number,ep.episode_number)}
                  onMouseUp={endLongPress} onMouseLeave={endLongPress}
                  onTouchStart={()=>startLongPress(season.season_number,ep.episode_number)}
                  onTouchEnd={endLongPress}
                  style={{display:"flex",alignItems:"center",gap:14,padding:"12px 20px",cursor:"pointer",borderBottom:`1px solid ${BORDER}`,background:w?SAGE_LIGHT:"transparent",transition:"background .1s",userSelect:"none"}}>
                  <div style={{width:24,height:24,borderRadius:"50%",border:`2px solid ${w?SAGE:BORDER}`,background:w?SAGE:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                    {w&&<span style={{fontSize:11,color:"#fff",fontWeight:900}}>✓</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,color:w?TEXT2:TEXT,textDecoration:w?"line-through":"none",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      <span style={{color:TEXT3,marginRight:8,fontSize:11}}>E{String(ep.episode_number).padStart(2,"0")}</span>{ep.name}
                    </div>
                    {ep.air_date&&<div style={{fontSize:11,color:TEXT3,marginTop:2}}>{ep.air_date}</div>}
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
function DetailSheet({item,onClose,onUpdate,onDelete,onEpisodes,userId}){
  const [tab,setTab]=useState("info");
  const [note,setNote]=useState("");
  const [noteRef,setNoteRef]=useState("");
  const [notes,setNotes]=useState([]);
  const [savingNote,setSavingNote]=useState(false);
  const [showRating,setShowRating]=useState(false);

  const title=item._meta?.name||item._meta?.title||"—";
  const year=(item._meta?.first_air_date||item._meta?.release_date||"").slice(0,4);
  const backdrop=item._meta?.backdrop_path;
  const isMovie=item.media_type==="movie";
  const isFinished=(item.lists||[]).includes("Finished");
  const isWatching=(item.lists||[]).includes("Watching");

  useEffect(()=>{
    sb.from("notes").select("*").eq("user_id",userId).eq("tmdb_id",item.tmdb_id).order("created_at",{ascending:false}).then(({data})=>setNotes(data||[]));
  },[item.tmdb_id]);

  const saveNote=async()=>{
    if(!note.trim()) return;
    setSavingNote(true);
    const {data}=await sb.from("notes").insert({user_id:userId,tmdb_id:item.tmdb_id,ref_label:noteRef||"General",body:note}).select().single();
    if(data) setNotes(p=>[data,...p]);
    setNote(""); setNoteRef("");
    setSavingNote(false);
  };

  const setList=async(targetList)=>{
    const ls=item.lists||[];
    const removing=ls.includes(targetList);
    let updated;
    if(targetList==="Finished"){
      updated=removing?ls.filter(x=>x!=="Finished"):[...ls.filter(x=>x!=="Watching"&&x!=="Watchlist"),"Finished"];
    } else if(targetList==="Watching"){
      updated=removing?ls.filter(x=>x!=="Watching"):[...ls.filter(x=>x!=="Finished"&&x!=="Watchlist"),"Watching"];
    } else {
      updated=removing?ls.filter(x=>x!==targetList):[...ls,targetList];
    }
    await sb.from("library").update({lists:updated}).eq("id",item.id);
    onUpdate({...item,lists:updated});
  };

  const setRating=async(v)=>{
    await sb.from("library").update({rating:v}).eq("id",item.id);
    onUpdate({...item,rating:v});
    setShowRating(false);
  };

  const markMovieWatched=async()=>{ setShowRating(true); };
  const finishWithRating=async(v)=>{
    const ls=item.lists||[];
    const updated=[...ls.filter(x=>x!=="Watchlist"&&x!=="Watching"),"Finished"];
    await sb.from("library").update({rating:v,lists:updated}).eq("id",item.id);
    onUpdate({...item,rating:v,lists:updated});
    setShowRating(false);
    onClose();
  };

  const deleteItem=async()=>{
    if(!confirm(`Remove ${title}?`)) return;
    await sb.from("library").delete().eq("id",item.id);
    onDelete(item.id); onClose();
  };

  const TABS=isMovie?["info","notes","lists"]:["info","episodes","notes","lists"];

  return(
    <>
    {showRating&&<RatingModal title={title} onRate={finishWithRating} onSkip={()=>{ setList("Finished"); setShowRating(false); onClose(); }}/>}
    <div style={{position:"fixed",inset:0,zIndex:200}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{position:"absolute",inset:0,background:"rgba(28,28,26,0.5)"}} onClick={onClose}/>
      <div style={{position:"absolute",bottom:0,left:0,right:0,maxHeight:"91dvh",background:BG,borderRadius:"20px 20px 0 0",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Backdrop */}
        <div style={{position:"relative",height:190,flexShrink:0}}>
          {backdrop?<img src={IMG(backdrop,"w780")} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
            :<div style={{width:"100%",height:"100%",background:CARD}}/>}
          <div style={{position:"absolute",inset:0,background:`linear-gradient(to bottom, transparent 30%, ${BG} 100%)`}}/>
          <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",width:40,height:4,background:"rgba(28,28,26,0.15)",borderRadius:2}}/>
          <button onClick={onClose} style={{position:"absolute",top:14,right:16,background:"rgba(248,246,242,0.9)",border:"none",width:30,height:30,borderRadius:"50%",color:TEXT2,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {/* Meta */}
        <div style={{padding:"0 20px 14px",display:"flex",gap:14,alignItems:"flex-end",marginTop:-48,position:"relative"}}>
          <Poster path={item._meta?.poster_path} title={title} w={68} radius={10}/>
          <div style={{flex:1,paddingBottom:4}}>
            <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:21,fontWeight:700,color:TEXT,lineHeight:1.15}}>{title}</div>
            <div style={{fontSize:12,color:TEXT2,marginTop:3}}>{isMovie?"Film":"Series"} · {year}</div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
              <Stars value={item.rating} onSet={setRating} size={14}/>
              <StatusBadge lists={item.lists}/>
            </div>
          </div>
        </div>
        {/* Quick actions */}
        <div style={{padding:"0 20px 14px",display:"flex",gap:8,flexShrink:0}}>
          {isMovie&&!isFinished&&(
            <button onClick={markMovieWatched}
              style={{flex:1,background:TEXT,border:"none",borderRadius:10,padding:"10px",color:BG,fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
              ✓ Mark as Watched
            </button>
          )}
          {!isMovie&&!isWatching&&!isFinished&&(
            <button onClick={()=>setList("Watching")}
              style={{flex:1,background:TEXT,border:"none",borderRadius:10,padding:"10px",color:BG,fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
              ▶ Start Watching
            </button>
          )}
          {!isMovie&&isWatching&&(
            <button onClick={()=>setList("Finished")}
              style={{flex:1,background:SAGE_LIGHT,border:`1.5px solid ${SAGE}`,borderRadius:10,padding:"10px",color:SAGE,fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
              ✓ Mark Finished
            </button>
          )}
          {isFinished&&(
            <button onClick={()=>setList("Watching")}
              style={{flex:1,background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:10,padding:"10px",color:TEXT2,fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
              ↩ Rewatch
            </button>
          )}
        </div>
        {/* Tabs */}
        <div style={{display:"flex",padding:"0 20px",borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"10px 14px",background:"none",border:"none",borderBottom:`2px solid ${tab===t?SAGE:"transparent"}`,color:tab===t?SAGE:TEXT3,fontFamily:"inherit",fontSize:12,fontWeight:700,textTransform:"capitalize",cursor:"pointer"}}>{t}</button>
          ))}
        </div>
        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"18px 20px 40px"}}>
          {tab==="info"&&(
            <div>
              {item._meta?.vote_average>0&&(
                <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,fontWeight:700,background:TEXT,color:BG,padding:"4px 10px",borderRadius:6}}>★ {item._meta.vote_average.toFixed(1)}</span>
                  {!isMovie&&item._meta.number_of_seasons&&<span style={{fontSize:12,color:TEXT2,padding:"4px 10px",border:`1px solid ${BORDER}`,borderRadius:6}}>{item._meta.number_of_seasons} seasons · {item._meta.number_of_episodes} eps</span>}
                </div>
              )}
              <p style={{fontSize:14,color:"#5C5248",lineHeight:1.8,margin:"0 0 20px"}}>{item._meta?.overview||"No description available."}</p>
              <button onClick={deleteItem} style={{background:"none",border:`1.5px solid ${BORDER}`,borderRadius:8,padding:"8px 16px",color:TEXT3,fontSize:12,fontFamily:"inherit",cursor:"pointer"}}>Remove from library</button>
            </div>
          )}
          {tab==="episodes"&&!isMovie&&(
            <div>
              {item.progress_season&&(
                <div style={{background:CARD,borderRadius:12,padding:"14px 16px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:11,color:TEXT2,marginBottom:2}}>Last watched</div>
                    <div style={{fontSize:18,fontWeight:700,fontFamily:"'Instrument Serif',Georgia,serif",color:TEXT}}>S{item.progress_season} · E{item.progress_episode}</div></div>
                  <div style={{width:1,background:BORDER,height:30}}/>
                  <div><div style={{fontSize:11,color:TEXT2,marginBottom:2}}>Up next</div>
                    <div style={{fontSize:18,fontWeight:700,fontFamily:"'Instrument Serif',Georgia,serif",color:TEXT}}>S{item.progress_season} · E{item.progress_episode+1}</div></div>
                </div>
              )}
              <button onClick={onEpisodes} style={{width:"100%",background:TEXT,border:"none",borderRadius:12,padding:"14px",color:BG,fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer"}}>Open Episode Tracker →</button>
            </div>
          )}
          {tab==="notes"&&(
            <div>
              <input value={noteRef} onChange={e=>setNoteRef(e.target.value)} placeholder="Episode or moment (e.g. S2E4)"
                style={{width:"100%",background:CARD,border:"none",borderRadius:8,padding:"10px 13px",fontSize:13,fontFamily:"inherit",color:TEXT,marginBottom:8,boxSizing:"border-box",outline:"none"}}/>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="Your thoughts, who to watch with, what hit you…"
                style={{width:"100%",background:CARD,border:"none",borderRadius:8,padding:"10px 13px",fontSize:13,fontFamily:"inherit",color:TEXT,resize:"none",boxSizing:"border-box",outline:"none"}}/>
              <button onClick={saveNote} disabled={savingNote}
                style={{marginTop:8,background:TEXT,border:"none",borderRadius:8,padding:"10px 22px",color:BG,fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                {savingNote?<Spin size={14}/>:"Save note"}
              </button>
              <div style={{marginTop:20}}>
                {notes.length===0&&<p style={{fontSize:13,color:TEXT3,textAlign:"center",padding:"12px 0"}}>No notes yet.</p>}
                {notes.map(n=>(
                  <div key={n.id} style={{borderLeft:`2px solid ${SAGE_LIGHT}`,paddingLeft:14,marginBottom:18}}>
                    <div style={{fontSize:11,fontWeight:700,color:TEXT3,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>{n.ref_label} · {new Date(n.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
                    <p style={{fontSize:14,color:"#5C5248",lineHeight:1.65,margin:0}}>{n.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab==="lists"&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {LISTS_ALL.map(l=>{
                const on=(item.lists||[]).includes(l);
                return<button key={l} onClick={()=>setList(l)} style={{padding:"8px 16px",borderRadius:20,border:`1.5px solid ${on?SAGE:BORDER}`,background:on?SAGE_LIGHT:"transparent",color:on?SAGE:TEXT2,fontFamily:"inherit",fontSize:13,fontWeight:600,cursor:"pointer"}}>{l}</button>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// ── Friends Screen ─────────────────────────────────────────────────────────────
function FriendsScreen({userId}){
  const [friends,setFriends]=useState([]);
  const [pending,setPending]=useState([]);
  const [recs,setRecs]=useState([]);
  const [recsMeta,setRecsMeta]=useState({});
  const [friendSearch,setFriendSearch]=useState("");
  const [friendResult,setFriendResult]=useState(undefined);
  const [searching,setSearching]=useState(false);
  const [recQuery,setRecQuery]=useState("");
  const [recSearch,setRecSearch]=useState([]);
  const [recNote,setRecNote]=useState("");
  const [selectedFriend,setSelectedFriend]=useState(null);
  const [sent,setSent]=useState(false);

  useEffect(()=>{ loadFriends(); loadRecs(); },[]);

  const loadFriends=async()=>{
    const {data}=await sb.from("friendships").select("*, requester:requester_id(id,username,display_name), addressee:addressee_id(id,username,display_name)").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    setFriends((data||[]).filter(f=>f.status==="accepted").map(f=>f.requester_id===userId?f.addressee:f.requester));
    setPending((data||[]).filter(f=>f.status==="pending"&&f.addressee_id===userId).map(f=>({...f.requester,friendship_id:f.id})));
  };

  const loadRecs=async()=>{
    const {data}=await sb.from("recommendations").select("*, from_user:from_user_id(username,display_name)").eq("to_user_id",userId).eq("status","pending");
    setRecs(data||[]);
    (data||[]).forEach(async r=>{ try{ const m=await fetchMeta(r.tmdb_id,r.media_type); setRecsMeta(p=>({...p,[r.tmdb_id]:m})); }catch{} });
  };

  const searchFriend=async()=>{
    if(!friendSearch.trim()) return;
    setSearching(true);
    const {data}=await sb.from("profiles").select("*").eq("username",friendSearch.toLowerCase().trim()).neq("id",userId).single();
    setFriendResult(data||null);
    setSearching(false);
  };

  const sendRequest=async(id)=>{
    await sb.from("friendships").insert({requester_id:userId,addressee_id:id});
    setFriendResult(undefined); setFriendSearch("");
  };

  const acceptRequest=async(fid)=>{ await sb.from("friendships").update({status:"accepted"}).eq("id",fid); loadFriends(); };

  useEffect(()=>{
    if(recQuery.length<2){ setRecSearch([]); return; }
    const t=setTimeout(async()=>{ try{ setRecSearch(await searchTMDB(recQuery)); }catch{} },380);
    return()=>clearTimeout(t);
  },[recQuery]);

  const sendRec=async(item)=>{
    if(!selectedFriend) return;
    await sb.from("recommendations").insert({from_user_id:userId,to_user_id:selectedFriend.id,tmdb_id:item.id,media_type:item.media_type,note:recNote});
    setRecQuery(""); setRecNote(""); setRecSearch([]); setSent(true);
    setTimeout(()=>setSent(false),3000);
  };

  const handleRec=async(recId,status)=>{
    await sb.from("recommendations").update({status}).eq("id",recId);
    setRecs(p=>p.filter(r=>r.id!==recId));
  };

  return(
    <div style={{padding:"0 20px 100px"}}>
      {pending.length>0&&(
        <div style={{marginBottom:24}}>
          <SectionLabel>Friend requests</SectionLabel>
          {pending.map(p=>(
            <div key={p.id} style={{display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${BORDER}`}}>
              <Av name={p.display_name||p.username} size={42}/>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:TEXT}}>{p.display_name||p.username}</div>
                <div style={{fontSize:12,color:TEXT2}}>@{p.username}</div>
              </div>
              <button onClick={()=>acceptRequest(p.friendship_id)} style={{background:SAGE,border:"none",borderRadius:8,padding:"8px 16px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Accept</button>
            </div>
          ))}
        </div>
      )}
      <div style={{marginBottom:24}}>
        <SectionLabel>Your people ({friends.length})</SectionLabel>
        {friends.length===0&&<p style={{fontSize:13,color:TEXT3,marginBottom:14}}>Add friends below to share what you're watching.</p>}
        {friends.length>0&&(
          <div style={{display:"flex",gap:16,overflowX:"auto",paddingBottom:4}}>
            {friends.map(f=>(
              <div key={f.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0}}>
                <Av name={f.display_name||f.username} size={52}/>
                <div style={{fontSize:12,fontWeight:700,color:TEXT}}>{f.display_name||f.username}</div>
                <div style={{fontSize:10,color:TEXT3}}>@{f.username}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{background:CARD,borderRadius:16,padding:16,marginBottom:24}}>
        <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:10}}>Add a friend by username</div>
        <div style={{display:"flex",gap:8}}>
          <input value={friendSearch} onChange={e=>setFriendSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchFriend()} placeholder="e.g. emilesmith"
            style={{flex:1,background:BG,border:"none",borderRadius:8,padding:"10px 13px",fontSize:13,fontFamily:"inherit",color:TEXT,outline:"none"}}/>
          <button onClick={searchFriend} disabled={searching} style={{background:TEXT,border:"none",borderRadius:8,padding:"10px 16px",color:BG,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{searching?"…":"Find"}</button>
        </div>
        {friendResult===null&&<div style={{fontSize:13,color:TEXT3,marginTop:10}}>No user found with that username.</div>}
        {friendResult&&friendResult.id&&(
          <div style={{marginTop:12,display:"flex",gap:12,alignItems:"center"}}>
            <Av name={friendResult.display_name||friendResult.username} size={40}/>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:TEXT}}>{friendResult.display_name||friendResult.username}</div>
              <div style={{fontSize:12,color:TEXT2}}>@{friendResult.username}</div>
            </div>
            <button onClick={()=>sendRequest(friendResult.id)} style={{background:SAGE,border:"none",borderRadius:8,padding:"8px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
          </div>
        )}
      </div>
      {recs.length>0&&(
        <div style={{marginBottom:24}}>
          <SectionLabel>Recommended for you</SectionLabel>
          {recs.map(rec=>{
            const meta=recsMeta[rec.tmdb_id];
            const title=meta?.name||meta?.title||"Loading…";
            return(
              <div key={rec.id} style={{background:CARD,borderRadius:16,padding:16,marginBottom:10}}>
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
                  <Av name={rec.from_user?.display_name||rec.from_user?.username} size={28}/>
                  <span style={{fontSize:13,fontWeight:700,color:TEXT}}>{rec.from_user?.display_name||rec.from_user?.username}</span>
                  <span style={{fontSize:12,color:TEXT2}}>recommends</span>
                </div>
                <div style={{display:"flex",gap:14}}>
                  <Poster path={meta?.poster_path} title={title} w={54} radius={8}/>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:17,fontWeight:700,color:TEXT,marginBottom:4}}>{title}</div>
                    {rec.note&&<p style={{fontSize:13,color:TEXT2,fontStyle:"italic",lineHeight:1.5,margin:"0 0 10px"}}>"{rec.note}"</p>}
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>handleRec(rec.id,"added")} style={{background:TEXT,border:"none",borderRadius:8,padding:"7px 16px",color:BG,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Watchlist</button>
                      <button onClick={()=>handleRec(rec.id,"skipped")} style={{background:"transparent",border:`1.5px solid ${BORDER}`,borderRadius:8,padding:"7px 14px",color:TEXT2,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Skip</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div>
        <SectionLabel>Send a recommendation</SectionLabel>
        <div style={{background:CARD,borderRadius:16,padding:16}}>
          {friends.length===0&&<div style={{fontSize:13,color:TEXT3,marginBottom:10}}>Add friends first</div>}
          {friends.length>0&&(
            <>
              <div style={{fontSize:12,color:TEXT2,marginBottom:8}}>Send to:</div>
              <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                {friends.map(f=>(
                  <div key={f.id} onClick={()=>setSelectedFriend(selectedFriend?.id===f.id?null:f)}
                    style={{cursor:"pointer",opacity:selectedFriend&&selectedFriend.id!==f.id?0.35:1,transition:"opacity .15s"}}>
                    <Av name={f.display_name||f.username} size={42}/>
                  </div>
                ))}
              </div>
              <input value={recQuery} onChange={e=>setRecQuery(e.target.value)} placeholder="Search what to recommend…"
                style={{width:"100%",background:BG,border:"none",borderRadius:8,padding:"10px 13px",fontSize:13,fontFamily:"inherit",color:TEXT,marginBottom:8,boxSizing:"border-box",outline:"none"}}/>
              {recSearch.length>0&&(
                <div style={{background:BG,borderRadius:8,marginBottom:8,overflow:"hidden"}}>
                  {recSearch.slice(0,4).map(r=>(
                    <div key={r.id} onClick={()=>sendRec(r)}
                      style={{display:"flex",gap:10,padding:"10px 12px",cursor:"pointer",borderBottom:`1px solid ${BORDER}`}}
                      onMouseEnter={e=>e.currentTarget.style.background=CARD}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <Poster path={r.poster_path} title={r.title||r.name} w={30} radius={4}/>
                      <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center"}}>
                        <div style={{fontSize:13,fontWeight:600,color:TEXT}}>{r.title||r.name}</div>
                        <div style={{fontSize:11,color:TEXT2}}>{r.media_type==="tv"?"Series":"Film"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <textarea value={recNote} onChange={e=>setRecNote(e.target.value)} rows={2} placeholder="Why they'll love it…"
                style={{width:"100%",background:BG,border:"none",borderRadius:8,padding:"10px 13px",fontSize:13,fontFamily:"inherit",color:TEXT,resize:"none",boxSizing:"border-box",outline:"none"}}/>
              {sent&&<div style={{fontSize:13,color:SAGE,marginTop:8,fontWeight:600}}>Sent! ✓</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stats Screen ───────────────────────────────────────────────────────────────
function StatsScreen({library,profile}){
  const finished=library.filter(i=>(i.lists||[]).includes("Finished"));
  const watching=library.filter(i=>(i.lists||[]).includes("Watching"));
  const movies=library.filter(i=>i.media_type==="movie");
  const totalEps=library.reduce((acc,i)=>acc+(i.progress_season?((i.progress_season-1)*10+i.progress_episode):0),0);
  const topRated=[...library].filter(i=>i.rating).sort((a,b)=>b.rating-a.rating).slice(0,5);
  const genres={};
  library.forEach(i=>{ (i._meta?.genres||[]).forEach(g=>{ genres[g.name]=(genres[g.name]||0)+1; }); });
  const topGenres=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const name=profile?.display_name||profile?.username||"You";

  return(
    <div style={{padding:"0 20px 100px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        {[{label:"Finished",value:finished.length},{label:"Watching now",value:watching.length},{label:"Movies",value:movies.length},{label:"Episodes tracked",value:totalEps}].map((s,i)=>(
          <div key={i} style={{background:i===0?TEXT:CARD,borderRadius:16,padding:"20px 18px"}}>
            <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:44,fontWeight:700,color:i===0?BG:TEXT,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:12,color:i===0?TEXT3:TEXT2,marginTop:6,fontWeight:500}}>{s.label}</div>
          </div>
        ))}
      </div>
      {topRated.length>0&&(
        <div style={{marginBottom:24}}>
          <SectionLabel>{name}'s top rated</SectionLabel>
          {topRated.map((item,i)=>{
            const title=item._meta?.name||item._meta?.title||"—";
            return(
              <div key={item.id} style={{display:"flex",gap:14,padding:"12px 0",borderBottom:i<topRated.length-1?`1px solid ${BORDER}`:"none",alignItems:"center"}}>
                <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:28,color:BORDER,width:28,textAlign:"center",fontWeight:700}}>{i+1}</div>
                <Poster path={item._meta?.poster_path} title={title} w={40} radius={6}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:TEXT,marginBottom:4}}>{title}</div>
                  <Stars value={item.rating} size={12}/>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {topGenres.length>0&&(
        <div>
          <SectionLabel>Top genres</SectionLabel>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {topGenres.map(([name,count])=>(
              <div key={name} style={{background:CARD,borderRadius:20,padding:"8px 16px",display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:700,color:TEXT}}>{name}</span>
                <span style={{fontSize:11,color:TEXT2}}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function SeenIt(){
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [library,setLibrary]=useState([]);
  const [loadingLib,setLoadingLib]=useState(false);
  const [tab,setTab]=useState("home");
  const [detail,setDetail]=useState(null);
  const [episodes,setEpisodes]=useState(null);
  const [searching,setSearching]=useState(false);
  const [libTab,setLibTab]=useState("all");
  const [statusTab,setStatusTab]=useState("all");
  const [authLoading,setAuthLoading]=useState(true);
  const [upcoming,setUpcoming]=useState([]);
  const [suggested,setSuggested]=useState([]);
  const contentRef=useRef(null);

  useEffect(()=>{
    sb.auth.getSession().then(({data})=>{ setSession(data.session); setAuthLoading(false); });
    const {data:{subscription}}=sb.auth.onAuthStateChange((_,s)=>setSession(s));
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session){ setProfile(null); setLibrary([]); return; }
    sb.from("profiles").select("*").eq("id",session.user.id).single().then(({data})=>setProfile(data));
    loadLibrary(session.user.id);
  },[session]);

  const loadLibrary=async(uid)=>{
    setLoadingLib(true);
    const {data}=await sb.from("library").select("*").eq("user_id",uid).order("created_at",{ascending:false});
    if(!data){ setLoadingLib(false); return; }
    const enriched=await Promise.all(data.map(async item=>{
      try{ const meta=await fetchMeta(item.tmdb_id,item.media_type); return{...item,_meta:meta}; }
      catch{ return{...item,_meta:null}; }
    }));
    setLibrary(enriched);
    setLoadingLib(false);
    // Load upcoming episodes
    const watchingShows=enriched.filter(i=>i.media_type==="tv"&&(i.lists||[]).includes("Watching"));
    if(watchingShows.length>0){
      const up=await fetchUpcoming(watchingShows.map(i=>({id:i.tmdb_id,type:i.media_type})));
      setUpcoming(up);
    }
    // Load suggested based on top genres
    const genres={};
    enriched.forEach(i=>{ (i._meta?.genres||[]).forEach(g=>{ genres[g.name]=(genres[g.name]||0)+1; if(!g._id) g._id=g.id; }); });
    const topGenreItems=enriched.flatMap(i=>i._meta?.genres||[]);
    const genreCounts={};
    topGenreItems.forEach(g=>{ genreCounts[g.id]=(genreCounts[g.id]||0)+1; });
    const topGenreId=Object.entries(genreCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(topGenreId){
      const sug=await fetchRecommended([{id:topGenreId}]);
      const libIds=new Set(enriched.map(i=>i.tmdb_id));
      setSuggested(sug.filter(s=>!libIds.has(s.id)).slice(0,8));
    }
  };

  // Reset scroll on tab change
  useEffect(()=>{ if(contentRef.current) contentRef.current.scrollTop=0; },[tab]);

  const addToLibrary=async(result)=>{
    if(!session||library.some(i=>i.tmdb_id===result.id)) return;
    const {data,error}=await sb.from("library").insert({user_id:session.user.id,tmdb_id:result.id,media_type:result.media_type,lists:["Watchlist"]}).select().single();
    if(error||!data) return;
    try{ const meta=await fetchMeta(result.id,result.media_type); setLibrary(p=>[{...data,_meta:meta},...p]); }
    catch{ setLibrary(p=>[{...data,_meta:null},...p]); }
  };

  const updateItem=useCallback((updated)=>{
    setLibrary(p=>p.map(i=>i.id===updated.id?updated:i));
    setDetail(d=>d?.id===updated.id?updated:d);
  },[]);

  const deleteItem=useCallback((id)=>setLibrary(p=>p.filter(i=>i.id!==id)),[]);

  const signOut=async()=>{ await sb.auth.signOut(); setTab("home"); };

  const watching=library.filter(i=>(i.lists||[]).includes("Watching"));
  const watchlist=library.filter(i=>(i.lists||[]).includes("Watchlist"));
  const libByType=libTab==="all"?library:libTab==="series"?library.filter(i=>i.media_type==="tv"):library.filter(i=>i.media_type==="movie");
  const libFiltered=statusTab==="all"?libByType:libByType.filter(i=>(i.lists||[]).includes(statusTab));

  const TABS=[
    {id:"home",label:"Home",icon:(active)=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?SAGE:"#C0B8AE"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )},
    {id:"library",label:"Library",icon:(active)=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?SAGE:"#C0B8AE"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="7" height="18"/><rect x="9" y="3" width="7" height="18"/><rect x="16" y="3" width="7" height="18" opacity="0.5"/>
      </svg>
    )},
    {id:"friends",label:"Friends",icon:(active)=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?SAGE:"#C0B8AE"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    )},
    {id:"stats",label:"Stats",icon:(active)=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?SAGE:"#C0B8AE"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )},
  ];

  if(authLoading) return(
    <div style={{background:BG,minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <Spin size={28}/>
    </div>
  );
  if(!session) return <AuthScreen/>;

  return(
    <div style={{background:BG,height:"100dvh",maxWidth:430,margin:"0 auto",fontFamily:"'DM Sans',system-ui,sans-serif",color:TEXT,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:0;height:0;}
        input::placeholder,textarea::placeholder{color:${TEXT3};}
        textarea{outline:none;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes up{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}
        .up{animation:up .25s ease forwards;}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
        <div>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:3,color:TEXT3,textTransform:"uppercase"}}>SeenIt</div>
          <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:26,color:TEXT,lineHeight:1.2,marginTop:2}}>
            {tab==="home"?(profile?.display_name?`Hey, ${profile.display_name}.`:"What are you watching?"):tab==="library"?"Your library":tab==="friends"?"Your people":"Your stats"}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginTop:2}}>
          <button onClick={()=>setSearching(true)} style={{width:40,height:40,borderRadius:"50%",background:TEXT,border:"none",color:BG,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BG} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <div onClick={signOut} style={{cursor:"pointer"}} title="Sign out"><Av name={profile?.display_name||profile?.username||"?"} size={40}/></div>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div ref={contentRef} style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"16px 0 0"}}>

        {/* HOME */}
        {tab==="home"&&(
          <div className="up" style={{paddingBottom:24}}>
            {loadingLib&&<div style={{display:"flex",justifyContent:"center",padding:"40px 0"}}><Spin/></div>}
            {!loadingLib&&library.length===0&&(
              <div style={{textAlign:"center",padding:"40px 28px"}}>
                <div style={{fontSize:40,marginBottom:14}}>🎬</div>
                <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:22,color:TEXT,marginBottom:8}}>Start your library</div>
                <div style={{fontSize:14,color:TEXT2,lineHeight:1.6,marginBottom:20}}>Search for a movie or show to add it</div>
                <button onClick={()=>setSearching(true)} style={{background:TEXT,border:"none",borderRadius:12,padding:"12px 24px",color:BG,fontWeight:700,fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>+ Add something</button>
              </div>
            )}

            {/* Continue watching */}
            {watching.length>0&&(
              <div style={{marginBottom:28}}>
                <div style={{padding:"0 20px",marginBottom:14}}><SectionLabel>Continue watching</SectionLabel></div>
                <div style={{display:"flex",gap:12,overflowX:"auto",padding:"0 20px"}}>
                  {watching.map(item=>{
                    const title=item._meta?.name||item._meta?.title||"—";
                    const backdrop=item._meta?.backdrop_path;
                    // Find next episode name
                    return(
                      <div key={item.id} onClick={()=>setDetail(item)}
                        style={{flexShrink:0,width:250,borderRadius:16,overflow:"hidden",background:CARD,cursor:"pointer",boxShadow:"0 2px 12px rgba(0,0,0,0.08)",transition:"transform .15s"}}
                        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.01)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                        <div style={{position:"relative",height:140}}>
                          {backdrop?<img src={IMG(backdrop,"w780")} alt={title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                            :<div style={{width:"100%",height:"100%",background:"#D8D0C8"}}/>}
                          {/* Progress bar overlay */}
                          {item.progress_season&&item._meta?.number_of_episodes&&(
                            <div style={{position:"absolute",bottom:0,left:0,right:0,height:3,background:"rgba(0,0,0,0.2)"}}>
                              <div style={{height:"100%",background:SAGE,width:`${Math.min(((item.progress_season-1)*10+item.progress_episode)/item._meta.number_of_episodes*100,100)}%`}}/>
                            </div>
                          )}
                        </div>
                        <div style={{padding:"10px 12px 12px"}}>
                          <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
                          {item.progress_season
                            ?<div style={{fontSize:11,color:TEXT2}}>Next: S{item.progress_season} · E{item.progress_episode+1}</div>
                            :<div style={{fontSize:11,color:TEXT2}}>Start watching</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming episodes */}
            {upcoming.length>0&&(
              <div style={{marginBottom:28,padding:"0 20px"}}>
                <SectionLabel>Coming up this week</SectionLabel>
                {upcoming.map(u=>(
                  <div key={u.tmdb_id} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${BORDER}`}}>
                    <Poster path={u.poster} title={u.show} w={40} radius={6}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{u.show}</div>
                      <div style={{fontSize:12,color:TEXT2,marginTop:1}}>S{u.episode.season_number} E{u.episode.episode_number} · {u.episode.name}</div>
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:SAGE,background:SAGE_LIGHT,padding:"4px 8px",borderRadius:8,flexShrink:0,whiteSpace:"nowrap"}}>
                      {new Date(u.episode.air_date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Watchlist shelf */}
            {watchlist.length>0&&(
              <div style={{marginBottom:28}}>
                <div style={{padding:"0 20px",marginBottom:14}}><SectionLabel>Up next to watch</SectionLabel></div>
                <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 20px"}}>
                  {watchlist.map(item=>{
                    const title=item._meta?.name||item._meta?.title||"—";
                    return(
                      <div key={item.id} onClick={()=>setDetail(item)} style={{flexShrink:0,cursor:"pointer"}}>
                        <Poster path={item._meta?.poster_path} title={title} w={80} radius={12}/>
                        <div style={{fontSize:11,color:TEXT2,marginTop:6,width:80,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{title}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* You might like */}
            {suggested.length>0&&(
              <div style={{marginBottom:28}}>
                <div style={{padding:"0 20px",marginBottom:14}}><SectionLabel>You might like</SectionLabel></div>
                <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 20px"}}>
                  {suggested.map(item=>(
                    <div key={item.id} onClick={()=>addToLibrary({...item,media_type:"tv"})} style={{flexShrink:0,cursor:"pointer"}}>
                      <Poster path={item.poster_path} title={item.name||item.title} w={80} radius={12}/>
                      <div style={{fontSize:11,color:TEXT2,marginTop:6,width:80,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{item.name||item.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* LIBRARY */}
        {tab==="library"&&(
          <div className="up">
            {/* Series / Movies / All tabs */}
            <div style={{display:"flex",gap:0,padding:"0 20px",marginBottom:12,borderBottom:`1px solid ${BORDER}`}}>
              {[{id:"all",label:"All"},{ id:"series",label:"Series"},{id:"movies",label:"Movies"}].map(t=>(
                <button key={t.id} onClick={()=>setLibTab(t.id)} style={{padding:"10px 16px",background:"none",border:"none",borderBottom:`2px solid ${libTab===t.id?SAGE:"transparent"}`,color:libTab===t.id?SAGE:TEXT3,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t.label}</button>
              ))}
            </div>
            {/* Status filter pills */}
            <div style={{display:"flex",gap:8,padding:"0 20px",marginBottom:16,overflowX:"auto"}}>
              {[{id:"all",label:"All"},{id:"Watching",label:"Watching",color:SAGE},{id:"Watchlist",label:"Watchlist"},{id:"Finished",label:"Finished",color:"#E65100"}].map(s=>{
                const active=statusTab===s.id;
                return(
                  <button key={s.id} onClick={()=>setStatusTab(s.id)} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:`1.5px solid ${active?(s.color||TEXT):BORDER}`,background:active?(s.color||TEXT):"transparent",color:active?"#fff":TEXT2,fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all .15s"}}>{s.label}</button>
                );
              })}
            </div>
            {loadingLib&&<div style={{display:"flex",justifyContent:"center",padding:"30px 0"}}><Spin/></div>}
            {/* Grid view */}
            <div style={{padding:"0 20px 100px"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                {libFiltered.map(item=>{
                  const title=item._meta?.name||item._meta?.title||"—";
                  return(
                    <div key={item.id} onClick={()=>setDetail(item)} style={{cursor:"pointer"}}>
                      <div style={{aspectRatio:"2/3",borderRadius:10,overflow:"hidden",background:CARD,position:"relative"}}>
                        {item._meta?.poster_path?<img src={IMG(item._meta.poster_path)} alt={title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                          :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:TEXT3,fontSize:22}}>🎬</div>}
                        {/* Status bar */}
                        <div style={{position:"absolute",bottom:0,left:0,right:0,height:4,background:(item.lists||[]).includes("Finished")?"#E65100":(item.lists||[]).includes("Watching")?SAGE:"#C0B8AE"}}/>
                      </div>
                      {item.rating&&<div style={{marginTop:4}}><Stars value={item.rating} size={10}/></div>}
                    </div>
                  );
                })}
              </div>
              {libFiltered.length===0&&!loadingLib&&(
                <div style={{textAlign:"center",padding:"50px 0",color:TEXT3}}>
                  <div style={{fontSize:28,marginBottom:10}}>📭</div>
                  <div style={{fontSize:14}}>Nothing here yet</div>
                </div>
              )}
              {/* Legend */}
              {libFiltered.length>0&&(
                <div style={{display:"flex",gap:16,marginTop:20,justifyContent:"center"}}>
                  {[{color:"#E65100",label:"Finished"},{color:SAGE,label:"Watching"},{color:"#C0B8AE",label:"Watchlist"}].map(l=>(
                    <div key={l.label} style={{display:"flex",gap:5,alignItems:"center"}}>
                      <div style={{width:16,height:4,borderRadius:2,background:l.color}}/>
                      <span style={{fontSize:11,color:TEXT2}}>{l.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab==="friends"&&session&&<div className="up"><FriendsScreen userId={session.user.id}/></div>}
        {tab==="stats"&&<div className="up"><StatsScreen library={library} profile={profile}/></div>}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{flexShrink:0,background:"rgba(248,246,242,0.97)",borderTop:`1px solid ${BORDER}`,paddingBottom:"env(safe-area-inset-bottom)",backdropFilter:"blur(16px)"}}>
        <div style={{display:"flex",justifyContent:"space-around",padding:"10px 0 6px"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",padding:"4px 20px",flex:1}}>
              {t.icon(tab===t.id)}
              <span style={{fontSize:10,fontWeight:700,color:tab===t.id?SAGE:"#C0B8AE",fontFamily:"inherit",letterSpacing:0.3}}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERLAYS ── */}
      {searching&&<SearchOverlay onClose={()=>setSearching(false)} onAdd={addToLibrary} library={library}/>}
      {detail&&!episodes&&<DetailSheet item={detail} onClose={()=>setDetail(null)} onUpdate={updateItem} onDelete={deleteItem} onEpisodes={()=>setEpisodes(detail)} userId={session?.user?.id}/>}
      {episodes&&<EpisodeSheet item={episodes} userId={session?.user?.id} onClose={()=>setEpisodes(null)} onProgressSaved={updated=>{ updateItem(updated); setEpisodes(null); }}/>}
    </div>
  );
}
