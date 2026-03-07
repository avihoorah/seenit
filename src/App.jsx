import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import ReactDOM from "react-dom";
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

const LISTS_ALL = ["Watching","Watchlist","Finished","Dropped","With Girlfriend","With Friends","Date Night","Comfort Watch","Mind Bending"];

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
async function fetchTrending(){
  try{
    const [movies,series]=await Promise.all([
      tmdb("/trending/movie/week"),
      tmdb("/trending/tv/week"),
    ]);
    return{
      movies:(movies.results||[]).slice(0,10),
      series:(series.results||[]).slice(0,10),
      featured:[...(movies.results||[]).slice(0,8),...(series.results||[]).slice(0,8)],
    };
  }catch{ return{movies:[],series:[],featured:[]}; }
}

// ── Primitives ─────────────────────────────────────────────────────────────────
function Spin({size=20,color=TEXT}){
  return(
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{width:size,height:size,border:`2px solid ${BORDER}`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin .6s linear infinite",flexShrink:0}}/>
    </>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────
const ToastContext = React.createContext(null);
function ToastProvider({children}){
  const [toasts,setToasts]=useState([]);
  const show=useCallback((msg,type="success")=>{
    const id=Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),2800);
  },[]);
  return(
    <ToastContext.Provider value={show}>
      {children}
      <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",zIndex:9999,display:"flex",flexDirection:"column",gap:8,alignItems:"center",pointerEvents:"none"}}>
        {toasts.map(t=>(
          <div key={t.id} style={{
            background:t.type==="error"?"#c0392b":t.type==="info"?TEXT:SAGE,
            color:"#fff",padding:"10px 18px",borderRadius:24,fontSize:13,fontWeight:700,
            fontFamily:"'DM Sans',system-ui,sans-serif",
            boxShadow:"0 4px 20px rgba(0,0,0,0.18)",
            animation:"toastIn .25s ease",whiteSpace:"nowrap",
          }}>{t.msg}</div>
        ))}
      </div>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}`}</style>
    </ToastContext.Provider>
  );
}
function useToast(){ return React.useContext(ToastContext)||((msg)=>{}); }

function Stars({value,onSet,size=14}){
  const [hov,setHov]=useState(0);
  const timers=useRef({});
  const val=hov||value||0;
  const handlePressStart=(n)=>{
    if(!onSet) return;
    timers.current[n]=setTimeout(()=>{ onSet(n-0.5); timers.current[n]=null; },400);
  };
  const handlePressEnd=(n)=>{
    if(!onSet) return;
    if(timers.current[n]){ clearTimeout(timers.current[n]); timers.current[n]=null; onSet(n); }
  };
  return(
    <div style={{display:"flex",gap:2,alignItems:"center"}}>
      {[1,2,3,4,5].map(n=>{
        const full=val>=n;
        const half=!full&&val>=n-0.5;
        return(
          <span key={n}
            onMouseEnter={()=>onSet&&setHov(n)} onMouseLeave={()=>onSet&&setHov(0)}
            onMouseDown={()=>handlePressStart(n)} onMouseUp={()=>handlePressEnd(n)}
            onTouchStart={()=>handlePressStart(n)} onTouchEnd={()=>handlePressEnd(n)}
            style={{fontSize:size,cursor:onSet?"pointer":"default",lineHeight:1,position:"relative",display:"inline-block"}}>
            <span style={{color:TEXT3}}>★</span>
            {(full||half)&&<span style={{position:"absolute",left:0,top:0,width:full?"100%":"50%",overflow:"hidden",color:TEXT}}>★</span>}
          </span>
        );
      })}
      {value&&value%1!==0&&<span style={{fontSize:size*0.8,color:TEXT2,marginLeft:2}}>½</span>}
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
  const dropped=lists.includes("Dropped");
  if(finished) return <span style={{fontSize:10,fontWeight:700,background:"#FFF3E0",color:"#E65100",padding:"2px 8px",borderRadius:10}}>Finished</span>;
  if(watching) return <span style={{fontSize:10,fontWeight:700,background:SAGE_LIGHT,color:SAGE,padding:"2px 8px",borderRadius:10}}>Watching</span>;
  if(dropped) return <span style={{fontSize:10,fontWeight:700,background:"#F5F0F0",color:"#9B4444",padding:"2px 8px",borderRadius:10}}>Dropped</span>;
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
        <div style={{fontSize:13,fontWeight:800,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}><span style={{color:TEXT}}>SEEN</span><span style={{color:SAGE}}>IT</span></div>
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
function DetailSheet({item,onClose,onUpdate,onDelete,onEpisodes,userId,profile}){
  const [tab,setTab]=useState("info");
  const [note,setNote]=useState("");
  const [noteRef,setNoteRef]=useState("");
  const [notes,setNotes]=useState([]);
  const [savingNote,setSavingNote]=useState(false);
  const [showRating,setShowRating]=useState(false);
  const [providers,setProviders]=useState(null);
  const [watchCount,setWatchCount]=useState(item.watch_count||1);

  const title=item._meta?.name||item._meta?.title||"—";
  const year=(item._meta?.first_air_date||item._meta?.release_date||"").slice(0,4);
  const backdrop=item._meta?.backdrop_path;
  const isMovie=item.media_type==="movie";
  const isFinished=(item.lists||[]).includes("Finished");
  const isWatching=(item.lists||[]).includes("Watching");

  useEffect(()=>{
    document.body.style.overflow="hidden";
    return()=>{ document.body.style.overflow=""; };
  },[]);

  useEffect(()=>{
    sb.from("notes").select("*").eq("user_id",userId).eq("tmdb_id",item.tmdb_id).order("created_at",{ascending:false}).then(({data})=>setNotes(data||[]));
    // Fetch streaming providers
    const type=item.media_type==="tv"?"tv":"movie";
    const savedCountry=profile?.country;
    const lang=navigator.language||"en-GB";
    const country=savedCountry||(lang.split("-")[1]||lang.toUpperCase().slice(0,2)||"GB");
    tmdb(`/${type}/${item.tmdb_id}/watch/providers`).then(d=>{
      const res=d.results||{};
      const countryData=res[country]||res["GB"]||res["US"]||Object.values(res)[0]||null;
      setProviders(countryData);
    }).catch(()=>{});
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
    const extra={};
    if(targetList==="Finished"){
      updated=removing?ls.filter(x=>x!=="Finished"):[...ls.filter(x=>x!=="Watching"&&x!=="Watchlist"),"Finished"];
      if(!removing) extra.watched_at=new Date().toISOString();
    } else if(targetList==="Watching"){
      updated=removing?ls.filter(x=>x!=="Watching"):[...ls.filter(x=>x!=="Finished"&&x!=="Watchlist"),"Watching"];
    } else {
      updated=removing?ls.filter(x=>x!==targetList):[...ls,targetList];
    }
    await sb.from("library").update({lists:updated,...extra}).eq("id",item.id);
    onUpdate({...item,lists:updated,...extra});
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
    const watched_at=new Date().toISOString();
    await sb.from("library").update({rating:v,lists:updated,watched_at}).eq("id",item.id);
    onUpdate({...item,rating:v,lists:updated,watched_at});
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
      <div style={{position:"fixed",inset:0,background:"rgba(28,28,26,0.5)"}} onClick={onClose}/>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,maxHeight:"91dvh",background:BG,borderRadius:"20px 20px 0 0",display:"flex",flexDirection:"column",overflow:"hidden",zIndex:201}}>
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
              <p style={{fontSize:14,color:TEXT2,lineHeight:1.8,margin:"0 0 16px"}}>{item._meta?.overview||"No description available."}</p>
              {/* Where to watch */}
              {providers&&(providers.flatrate||providers.free||providers.ads)&&(
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:TEXT3,textTransform:"uppercase",marginBottom:10}}>Where to watch</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[...(providers.flatrate||[]),(providers.free||[]),(providers.ads||[])].flat().filter((p,i,a)=>a.findIndex(x=>x.provider_id===p.provider_id)===i).slice(0,6).map(p=>(
                      <div key={p.provider_id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <img src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt={p.provider_name} style={{width:40,height:40,borderRadius:10,display:"block"}}/>
                        <span style={{fontSize:10,color:TEXT3,textAlign:"center",maxWidth:44,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.provider_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Rewatch count */}
              {(item.lists||[]).includes("Finished")&&(
                <div style={{marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:TEXT2}}>Times watched</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <button onClick={async()=>{ const n=Math.max(1,watchCount-1); setWatchCount(n); await sb.from("library").update({watch_count:n}).eq("id",item.id); onUpdate({...item,watch_count:n}); }} style={{width:26,height:26,borderRadius:"50%",border:`1.5px solid ${BORDER}`,background:"none",cursor:"pointer",fontSize:14,color:TEXT2,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                    <span style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:22,fontWeight:700,color:TEXT,minWidth:20,textAlign:"center"}}>{watchCount}</span>
                    <button onClick={async()=>{ const n=watchCount+1; setWatchCount(n); await sb.from("library").update({watch_count:n}).eq("id",item.id); onUpdate({...item,watch_count:n}); }} style={{width:26,height:26,borderRadius:"50%",border:`1.5px solid ${BORDER}`,background:"none",cursor:"pointer",fontSize:14,color:TEXT2,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                  </div>
                </div>
              )}
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
                    <p style={{fontSize:14,color:TEXT2,lineHeight:1.65,margin:0}}>{n.body}</p>
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
  const [activity,setActivity]=useState([]);
  const [activityMeta,setActivityMeta]=useState({});
  const [friendSearch,setFriendSearch]=useState("");
  const [friendResult,setFriendResult]=useState(undefined);
  const [searching,setSearching]=useState(false);
  const [recQuery,setRecQuery]=useState("");
  const [recSearch,setRecSearch]=useState([]);
  const [recNote,setRecNote]=useState("");
  const [selectedFriend,setSelectedFriend]=useState(null);
  const [sent,setSent]=useState(false);
  const toast=useToast();

  useEffect(()=>{ loadFriends(); loadRecs(); },[]);

  const loadFriends=async()=>{
    const {data}=await sb.from("friendships").select("*, requester:requester_id(id,username,display_name), addressee:addressee_id(id,username,display_name)").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    const accepted=(data||[]).filter(f=>f.status==="accepted");
    const friendList=accepted.map(f=>f.requester_id===userId?f.addressee:f.requester);
    setFriends(friendList);
    setPending((data||[]).filter(f=>f.status==="pending"&&f.addressee_id===userId).map(f=>({...f.requester,friendship_id:f.id})));
    // Load activity feed for friends
    if(friendList.length>0){
      const friendIds=friendList.map(f=>f.id);
      const {data:acts}=await sb.from("library")
        .select("*")
        .in("user_id",friendIds)
        .not("watched_at","is",null)
        .order("watched_at",{ascending:false})
        .limit(20);
      if(acts&&acts.length>0){
        // Attach friend display names
        const withNames=acts.map(a=>({...a,_friend:friendList.find(f=>f.id===a.user_id)}));
        setActivity(withNames);
        // Fetch meta for unique tmdb_ids
        const unique=[...new Map(acts.map(a=>[a.tmdb_id,a])).values()];
        unique.forEach(async a=>{ try{ const m=await fetchMeta(a.tmdb_id,a.media_type); setActivityMeta(p=>({...p,[a.tmdb_id]:m})); }catch{} });
      }
    }
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
    toast("Friend request sent ✓");
  };

  const acceptRequest=async(fid)=>{ await sb.from("friendships").update({status:"accepted"}).eq("id",fid); loadFriends(); toast("Friend added ✓"); };

  useEffect(()=>{
    if(recQuery.length<2){ setRecSearch([]); return; }
    const t=setTimeout(async()=>{ try{ setRecSearch(await searchTMDB(recQuery)); }catch{} },380);
    return()=>clearTimeout(t);
  },[recQuery]);

  const sendRec=async(item)=>{
    if(!selectedFriend) return;
    await sb.from("recommendations").insert({from_user_id:userId,to_user_id:selectedFriend.id,tmdb_id:item.id,media_type:item.media_type,note:recNote});
    setRecQuery(""); setRecNote(""); setRecSearch([]);
    toast(`Recommended to ${selectedFriend.display_name||selectedFriend.username} ✓`);
    setSent(true);
    setTimeout(()=>setSent(false),3000);
  };

  const handleRec=async(recId,status)=>{
    await sb.from("recommendations").update({status}).eq("id",recId);
    setRecs(p=>p.filter(r=>r.id!==recId));
    if(status==="accepted") toast("Added to Watchlist ✓");
  };

  const timeAgo=(dateStr)=>{
    const diff=Date.now()-new Date(dateStr).getTime();
    const h=Math.floor(diff/3600000);
    if(h<1) return "just now";
    if(h<24) return `${h}h ago`;
    const d=Math.floor(h/24);
    if(d<7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString("en-GB",{day:"numeric",month:"short"});
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

      {/* Activity feed */}
      {activity.length>0&&(
        <div style={{marginBottom:28}}>
          <SectionLabel>What friends are watching</SectionLabel>
          {activity.slice(0,8).map((a,i)=>{
            const meta=activityMeta[a.tmdb_id];
            const title=meta?.name||meta?.title||"…";
            const status=(a.lists||[]).includes("Finished")?"finished":(a.lists||[]).includes("Watching")?"started watching":"added";
            const friend=a._friend;
            return(
              <div key={a.id||i} style={{display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${BORDER}`}}>
                <Av name={friend?.display_name||friend?.username||"?"} size={36}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,color:TEXT,lineHeight:1.4}}>
                    <span style={{fontWeight:700}}>{friend?.display_name||friend?.username}</span>
                    <span style={{color:TEXT2}}> {status} </span>
                    <span style={{fontWeight:700}}>{title}</span>
                  </div>
                  {a.rating&&<div style={{marginTop:3}}><Stars value={a.rating} size={11}/></div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                  {meta?.poster_path&&<img src={IMG(meta.poster_path,"w92")} style={{width:32,height:48,borderRadius:5,objectFit:"cover"}} alt={title}/>}
                  <span style={{fontSize:10,color:TEXT3}}>{timeAgo(a.watched_at||a.created_at)}</span>
                </div>
              </div>
            );
          })}
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
function TopRatedSection({items,label}){
  const [expanded,setExpanded]=useState(false);
  const rated=[...items].filter(i=>i.rating).sort((a,b)=>b.rating-a.rating);
  if(rated.length===0) return null;
  const shown=expanded?rated:rated.slice(0,5);
  return(
    <div style={{marginBottom:24}}>
      <SectionLabel>{label}</SectionLabel>
      {shown.map((item,i)=>{
        const title=item._meta?.name||item._meta?.title||"—";
        return(
          <div key={item.id} style={{display:"flex",gap:14,padding:"12px 0",borderBottom:i<shown.length-1?`1px solid ${BORDER}`:"none",alignItems:"center"}}>
            <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:28,color:BORDER,width:28,textAlign:"center",fontWeight:700}}>{i+1}</div>
            <Poster path={item._meta?.poster_path} title={title} w={40} radius={6}/>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:TEXT,marginBottom:4}}>{title}</div>
              <Stars value={item.rating} size={12}/>
            </div>
          </div>
        );
      })}
      {rated.length>5&&(
        <button onClick={()=>setExpanded(e=>!e)} style={{marginTop:10,background:"none",border:`1.5px solid ${BORDER}`,borderRadius:20,padding:"6px 16px",fontSize:12,fontWeight:700,color:TEXT2,cursor:"pointer",fontFamily:"inherit"}}>
          {expanded?`Show less ↑`:`Show all ${rated.length} ↓`}
        </button>
      )}
    </div>
  );
}

function StatsScreen({library,profile}){
  const finished=library.filter(i=>(i.lists||[]).includes("Finished"));
  const watching=library.filter(i=>(i.lists||[]).includes("Watching"));
  const movies=library.filter(i=>i.media_type==="movie");
  const series=library.filter(i=>i.media_type==="tv");
  const watchMins=library.reduce((acc,i)=>{
    if(i.media_type==="movie"&&(i.lists||[]).includes("Finished")) return acc+(i._meta?.runtime||100);
    if(i.media_type==="tv") return acc+(i.progress_episode||0)*45;
    return acc;
  },0);
  const watchHours=Math.round(watchMins/60);
  const genres={};
  library.forEach(i=>{ (i._meta?.genres||[]).forEach(g=>{ genres[g.name]=(genres[g.name]||0)+1; }); });
  const topGenres=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const name=profile?.display_name||profile?.username||"You";

  return(
    <div style={{padding:"0 20px 100px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        {[{label:"Finished",value:finished.length},{label:"Watching now",value:watching.length},{label:"Movies",value:movies.length},{label:"Series",value:series.length}].map((s,i)=>(
          <div key={i} style={{background:i===0?TEXT:CARD,borderRadius:16,padding:"20px 18px"}}>
            <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:44,fontWeight:700,color:i===0?BG:TEXT,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:12,color:i===0?TEXT3:TEXT2,marginTop:6,fontWeight:500}}>{s.label}</div>
          </div>
        ))}
      </div>
      {watchHours>0&&(
        <div style={{background:SAGE_LIGHT,borderRadius:16,padding:"18px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:32}}>🎬</div>
          <div>
            <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:22,color:TEXT,fontWeight:700}}>{watchHours} hours watched</div>
            <div style={{fontSize:12,color:TEXT2,marginTop:2}}>That's {Math.round(watchHours/24)} days of your life. Worth it.</div>
          </div>
        </div>
      )}
      <TopRatedSection items={series} label={`${name}'s top rated series`}/>
      <TopRatedSection items={movies} label={`${name}'s top rated films`}/>
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

// ── Discover Preview Sheet ─────────────────────────────────────────────────────
function DiscoverPreview({item,library,onClose,onAdd,onOpenDetail}){
  const [providers,setProviders]=useState(null);
  const [meta,setMeta]=useState(null);
  const type=item.media_type||(item.first_air_date?"tv":"movie");
  const title=item.title||item.name||"—";
  const year=(item.release_date||item.first_air_date||"").slice(0,4);
  const inLib=library.some(l=>l.tmdb_id===item.id);
  const libItem=library.find(l=>l.tmdb_id===item.id);

  useEffect(()=>{
    fetchMeta(item.id,type).then(setMeta).catch(()=>{});
    const lang=navigator.language||"en-GB";
    const country=lang.split("-")[1]||"GB";
    tmdb(`/${type==="tv"?"tv":"movie"}/${item.id}/watch/providers`).then(d=>{
      const res=d.results||{};
      setProviders(res[country]||res["GB"]||res["US"]||Object.values(res)[0]||null);
    }).catch(()=>{});
  },[item.id]);

  // If already in library, open DetailSheet instead
  useEffect(()=>{
    if(inLib&&libItem&&onOpenDetail){
      onClose();
      onOpenDetail(libItem);
    }
  },[inLib]);

  if(inLib&&libItem) return null;

  const overview=meta?.overview||item.overview||"";
  const genres=(meta?.genres||[]).slice(0,3).map(g=>g.name).join(" · ");

  return ReactDOM.createPortal(
    <div style={{position:"fixed",inset:0,zIndex:450,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      {/* Scrim */}
      <div style={{position:"fixed",inset:0,background:"rgba(28,28,26,0.6)"}} onClick={onClose}/>
      {/* Centred card — always in the middle of the viewport */}
      <div style={{position:"relative",zIndex:451,width:"100%",maxWidth:390,background:BG,borderRadius:20,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        {/* Poster + info header */}
        <div style={{display:"flex",gap:14,padding:"20px 20px 0",alignItems:"flex-start"}}>
          <div style={{flexShrink:0,width:72,borderRadius:10,overflow:"hidden",boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}>
            {item.poster_path
              ?<img src={IMG(item.poster_path)} alt={title} style={{width:"100%",display:"block"}}/>
              :<div style={{aspectRatio:"2/3",background:CARD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🎬</div>}
          </div>
          <div style={{flex:1,minWidth:0,paddingTop:2}}>
            <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:21,fontWeight:700,color:TEXT,lineHeight:1.2}}>{title}</div>
            <div style={{fontSize:12,color:TEXT2,marginTop:3}}>{type==="tv"?"Series":"Film"}{year?" · "+year:""}</div>
            {genres&&<div style={{fontSize:11,color:TEXT3,marginTop:2}}>{genres}</div>}
            {item.vote_average>0&&(
              <div style={{display:"inline-flex",background:TEXT,color:BG,padding:"2px 8px",borderRadius:6,marginTop:6}}>
                <span style={{fontSize:11,fontWeight:700}}>★ {item.vote_average?.toFixed(1)}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{flexShrink:0,background:CARD,border:"none",width:28,height:28,borderRadius:"50%",color:TEXT2,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {/* Scrollable body */}
        <div style={{maxHeight:"45vh",overflowY:"auto",padding:"14px 20px 0"}}>
          {overview&&(
            <p style={{fontSize:14,color:TEXT2,lineHeight:1.8,margin:"0 0 14px 0"}}>
              {overview.slice(0,240)}{overview.length>240?"…":""}
            </p>
          )}
          {providers&&(providers.flatrate||providers.free)&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:TEXT3,textTransform:"uppercase",marginBottom:8}}>Where to watch</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[...(providers.flatrate||[]),(providers.free||[])].flat()
                  .filter((p,i,a)=>a.findIndex(x=>x.provider_id===p.provider_id)===i)
                  .slice(0,5).map(p=>(
                  <div key={p.provider_id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <img src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} alt={p.provider_name} style={{width:36,height:36,borderRadius:8}}/>
                    <span style={{fontSize:9,color:TEXT3,maxWidth:40,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.provider_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Action button */}
        <div style={{padding:"14px 20px 20px"}}>
          <button onClick={()=>{ onAdd({...item,media_type:type,lists:["Watchlist"]}); onClose(); }}
            style={{width:"100%",background:TEXT,border:"none",borderRadius:12,padding:"13px",color:BG,fontWeight:700,fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>
            + Add to Watchlist
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Discover Screen ────────────────────────────────────────────────────────────
const GENRES=[
  {id:null,label:"Popular"},
  {id:28,label:"Action"},{id:35,label:"Comedy"},{id:18,label:"Drama"},
  {id:53,label:"Thriller"},{id:27,label:"Horror"},{id:878,label:"Sci-Fi"},
  {id:10749,label:"Romance"},{id:99,label:"Documentary"},{id:16,label:"Animation"},{id:80,label:"Crime"},
];

function TrendingCarousel({items,onPreview,onAdd}){
  const [idx,setIdx]=useState(0);
  const trackRef=useRef();
  const startX=useRef(null);
  const didDrag=useRef(false);
  const total=Math.min(items.length,8);
  const item=items[idx];
  const toast=useToast();

  const goTo=(n)=>setIdx(Math.max(0,Math.min(total-1,n)));

  const onTouchStart=(e)=>{ startX.current=e.touches[0].clientX; didDrag.current=false; };
  const onTouchEnd=(e)=>{
    if(startX.current===null) return;
    const dx=e.changedTouches[0].clientX-startX.current;
    if(Math.abs(dx)>40){ didDrag.current=true; dx<0?goTo(idx+1):goTo(idx-1); }
    startX.current=null;
  };
  const onMouseDown=(e)=>{ startX.current=e.clientX; didDrag.current=false; };
  const onMouseUp=(e)=>{
    if(startX.current===null) return;
    const dx=e.clientX-startX.current;
    if(Math.abs(dx)>40){ didDrag.current=true; dx<0?goTo(idx+1):goTo(idx-1); }
    startX.current=null;
  };

  if(!item) return null;
  const title=item.title||item.name||"";
  const type=item.first_air_date?"Series":"Film";

  return(
    <div style={{marginBottom:24,userSelect:"none"}}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown} onMouseUp={onMouseUp}>
      {/* Card */}
      <div ref={trackRef} style={{position:"relative",height:270,overflow:"hidden",cursor:"pointer"}}
        onClick={()=>{ if(!didDrag.current) onPreview(item); }}>
        {item.backdrop_path
          ?<img src={IMG(item.backdrop_path,"w780")} alt={title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",transition:"opacity .3s"}} key={item.id}/>
          :<div style={{width:"100%",height:"100%",background:CARD}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom, transparent 15%, rgba(28,28,26,0.92) 100%)"}}/>
        {/* Content */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"0 20px 16px"}}>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",marginBottom:4}}>
            {type} · Trending
            {item.vote_average>0&&<span style={{marginLeft:8,background:"rgba(255,255,255,0.12)",padding:"1px 7px",borderRadius:4}}>★ {item.vote_average?.toFixed(1)}</span>}
          </div>
          <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:24,color:"#fff",fontWeight:700,lineHeight:1.15,marginBottom:6}}>
            {title}
          </div>
          {item.overview&&(
            <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",lineHeight:1.5,marginBottom:12,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
              {item.overview}
            </div>
          )}
          <button
            onClick={e=>{ e.stopPropagation(); onAdd({...item,media_type:item.first_air_date?"tv":"movie",lists:["Watchlist"]}); toast(`Added "${title}" to Watchlist ✓`); }}
            style={{background:"#fff",border:"none",borderRadius:20,padding:"7px 20px",fontSize:12,fontWeight:800,color:TEXT,cursor:"pointer",fontFamily:"inherit"}}>
            + Watchlist
          </button>
        </div>
        {/* Prev/next tap zones */}
        <div style={{position:"absolute",top:0,left:0,width:"30%",height:"100%"}} onClick={e=>{ e.stopPropagation(); goTo(idx-1); }}/>
        <div style={{position:"absolute",top:0,right:0,width:"30%",height:"100%"}} onClick={e=>{ e.stopPropagation(); goTo(idx+1); }}/>
      </div>
      {/* Dot indicators */}
      <div style={{display:"flex",justifyContent:"center",gap:5,marginTop:10}}>
        {Array.from({length:total}).map((_,i)=>(
          <div key={i} onClick={()=>goTo(i)}
            style={{width:i===idx?18:6,height:6,borderRadius:3,background:i===idx?SAGE:BORDER,cursor:"pointer",transition:"width .25s, background .25s"}}/>
        ))}
      </div>
    </div>
  );
}

// Persistent discover state lifted outside component so it survives tab switches
let _discoverCache = { data: null, activeGenre: {id:null,label:"Popular"}, genreData: null };

function DiscoverScreen({library,onAdd,focusSearch,onOpenDetail,suggested=[]}){
  const [data,setData]=useState(_discoverCache.data);
  const [loading,setLoading]=useState(!_discoverCache.data);
  const [loadError,setLoadError]=useState(false);
  const [q,setQ]=useState("");
  const [searchRes,setSearchRes]=useState([]);
  const [searching,setSearching]=useState(false);
  const [activeGenre,setActiveGenre]=useState(_discoverCache.activeGenre);
  const [genreData,setGenreData]=useState(_discoverCache.genreData);
  const [genreLoading,setGenreLoading]=useState(false);
  const [preview,setPreview]=useState(null);
  const [searchHistory,setSearchHistory]=useState(()=>{ try{ return JSON.parse(localStorage.getItem("seenit_search_history")||"[]"); }catch{ return []; } });
  const searchRef=useRef();
  const libIds=new Set(library.map(i=>i.tmdb_id));
  const toast=useToast();

  useEffect(()=>{
    if(_discoverCache.data){ setData(_discoverCache.data); setLoading(false); return; }
    setLoadError(false);
    fetchTrending().then(d=>{
      setData(d); setLoading(false);
      _discoverCache.data=d;
    }).catch(()=>{ setLoading(false); setLoadError(true); });
  },[]);

  // Auto-focus search if coming from header button
  useEffect(()=>{ if(focusSearch) setTimeout(()=>searchRef.current?.focus(),100); },[focusSearch]);

  // Search
  useEffect(()=>{
    if(q.length<2){ setSearchRes([]); return; }
    const t=setTimeout(async()=>{
      setSearching(true);
      try{ setSearchRes(await searchTMDB(q)); }catch{}
      setSearching(false);
    },380);
    return()=>clearTimeout(t);
  },[q]);

  const addToHistory=(term)=>{
    if(!term.trim()||term.length<2) return;
    const next=[term,...searchHistory.filter(h=>h!==term)].slice(0,6);
    setSearchHistory(next);
    try{ localStorage.setItem("seenit_search_history",JSON.stringify(next)); }catch{}
  };

  const clearHistory=()=>{ setSearchHistory([]); try{ localStorage.removeItem("seenit_search_history"); }catch{} };

  // Genre filter — persist across tab switches
  const handleGenre=async(genre)=>{
    if(activeGenre?.id===genre.id) return;
    setActiveGenre(genre);
    _discoverCache.activeGenre=genre;
    if(genre.id===null){ setGenreData(null); _discoverCache.genreData=null; return; }
    setGenreLoading(true);
    try{
      const [movies,series]=await Promise.all([
        tmdb(`/discover/movie?with_genres=${genre.id}&sort_by=popularity.desc`),
        tmdb(`/discover/tv?with_genres=${genre.id}&sort_by=popularity.desc`),
      ]);
      const gd={movies:(movies.results||[]).slice(0,20),series:(series.results||[]).slice(0,20)};
      setGenreData(gd);
      _discoverCache.genreData=gd;
    }catch{}
    setGenreLoading(false);
  };

  const handleAdd=(item,lists=["Watchlist"])=>{
    const type=item.media_type||(item.first_air_date?"tv":"movie");
    onAdd({...item,id:item.id,media_type:type,lists});
    toast(`Added "${item.title||item.name}" to Watchlist ✓`);
  };

  if(loading) return <div style={{display:"flex",justifyContent:"center",padding:"60px 0"}}><Spin/></div>;
  if(loadError) return(
    <div style={{textAlign:"center",padding:"60px 24px"}}>
      <div style={{fontSize:32,marginBottom:12}}>😕</div>
      <div style={{fontSize:15,fontWeight:700,color:TEXT,marginBottom:6}}>Couldn't load trending</div>
      <div style={{fontSize:13,color:TEXT2,marginBottom:20}}>Check your connection and try again.</div>
      <button onClick={()=>{ setLoading(true); setLoadError(false); fetchTrending().then(d=>{ setData(d); setLoading(false); _discoverCache.data=d; }).catch(()=>{ setLoading(false); setLoadError(true); }); }}
        style={{background:TEXT,border:"none",borderRadius:12,padding:"11px 24px",color:BG,fontWeight:700,fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>Retry</button>
    </div>
  );

  const featured=(data.featured||[]).filter(i=>!libIds.has(i.id));
  const isPopular=activeGenre?.id===null;
  const moviesRaw=isPopular?data.movies:genreData?.movies;
  const seriesRaw=isPopular?data.series:genreData?.series;
  const movies=(moviesRaw||[]).filter(i=>!libIds.has(i.id));
  const series=(seriesRaw||[]).filter(i=>!libIds.has(i.id));
  const isSearching=q.length>=2;

  return(
    <div style={{paddingBottom:100}}>
      {preview&&<DiscoverPreview item={preview} library={library} onClose={()=>setPreview(null)} onAdd={(item)=>handleAdd(item,item.lists)} onOpenDetail={(item)=>{ setPreview(null); onOpenDetail&&onOpenDetail(item); }}/>}

      {/* Search bar */}
      <div style={{padding:"0 20px 14px",position:"relative",display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1,position:"relative"}}>
          <input ref={searchRef} value={q}
            onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&q.trim().length>=2) addToHistory(q.trim()); }}
            onBlur={()=>{ if(q.trim().length>=2) addToHistory(q.trim()); }}
            placeholder="Search movies and shows…"
            style={{width:"100%",background:CARD,border:"none",borderRadius:12,padding:"11px 40px 11px 14px",fontFamily:"inherit",color:TEXT,outline:"none",boxSizing:"border-box"}}/>
          {searching&&<div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)"}}><Spin size={16}/></div>}
          {q.length>0&&!searching&&<button onClick={()=>setQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:TEXT3,fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>}
        </div>
      </div>

      {/* Search history — shown when input focused and empty */}
      {!isSearching&&q.length===0&&searchHistory.length>0&&(
        <div style={{padding:"0 20px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:10,fontWeight:800,letterSpacing:2,color:TEXT3,textTransform:"uppercase"}}>Recent searches</span>
            <button onClick={clearHistory} style={{background:"none",border:"none",fontSize:11,color:TEXT3,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Clear</button>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {searchHistory.map(h=>(
              <button key={h} onClick={()=>setQ(h)}
                style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${BORDER}`,background:"transparent",color:TEXT2,fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                🔍 {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search results */}
      {isSearching&&(
        <div style={{paddingBottom:20}}>
          {searchRes.length===0&&!searching&&<div style={{textAlign:"center",color:TEXT3,fontSize:14,padding:"30px 0"}}>No results for "{q}"</div>}
          {searchRes.map(r=>{
            const inLib=libIds.has(r.id);
            const title=r.title||r.name||"";
            const year=(r.release_date||r.first_air_date||"").slice(0,4);
            return(
              <div key={r.id} onClick={()=>setPreview(r)}
                style={{display:"flex",gap:14,padding:"12px 20px",cursor:"pointer",borderBottom:`1px solid ${BORDER}`}}>
                <Poster path={r.poster_path} title={title} w={44} radius={8}/>
                <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",gap:3}}>
                  <div style={{fontSize:15,fontWeight:700,color:TEXT,fontFamily:"'Instrument Serif',Georgia,serif"}}>{title}</div>
                  <div style={{fontSize:12,color:TEXT2}}>{r.media_type==="tv"?"Series":"Film"}{year?" · "+year:""}</div>
                </div>
                <div style={{alignSelf:"center",fontSize:12,fontWeight:700,background:inLib?CARD:TEXT,color:inLib?TEXT3:BG,padding:"5px 12px",borderRadius:20}}>
                  {inLib?"In library":"View"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trending content — hidden while searching */}
      {!isSearching&&(
        <>
          {/* Genre pills */}
          <div style={{display:"flex",gap:8,padding:"0 20px",marginBottom:20,overflowX:"auto"}}>
            {GENRES.map(g=>{
              const active=activeGenre?.id===g.id;
              return(
                <button key={g.id} onClick={()=>handleGenre(g)}
                  style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:`1.5px solid ${active?SAGE:BORDER}`,background:active?SAGE:"transparent",color:active?"#fff":TEXT2,fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all .15s"}}>
                  {g.label}
                </button>
              );
            })}
          </div>

          {genreLoading&&<div style={{display:"flex",justifyContent:"center",padding:"30px 0"}}><Spin/></div>}

          {!genreLoading&&(
            <>
              {/* Trending carousel — only on Popular */}
              {isPopular&&featured.length>0&&(
                <TrendingCarousel items={featured} onPreview={setPreview} onAdd={handleAdd}/>
              )}

              {/* Movies shelf */}
              {movies.length>0&&(
                <div style={{marginBottom:28}}>
                  <div style={{padding:"0 20px",marginBottom:14}}>
                    <SectionLabel>{activeGenre?.id?`${activeGenre.label} movies`:"Popular movies"}</SectionLabel>
                  </div>
                  <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 20px"}}>
                    {movies.slice(0,10).map(item=>(
                      <div key={item.id} style={{flexShrink:0,cursor:"pointer"}} onClick={()=>setPreview({...item,media_type:"movie"})}>
                        <div style={{position:"relative"}}>
                          <Poster path={item.poster_path} title={item.title} w={100} radius={12}/>
                          <div style={{position:"absolute",bottom:6,right:6,background:"rgba(28,28,26,0.75)",borderRadius:6,padding:"2px 6px",fontSize:11,fontWeight:700,color:"#fff"}}>★ {item.vote_average?.toFixed(1)}</div>
                        </div>
                        <div style={{fontSize:11,color:TEXT2,marginTop:6,width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{item.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Series shelf */}
              {series.length>0&&(
                <div style={{marginBottom:28}}>
                  <div style={{padding:"0 20px",marginBottom:14}}>
                    <SectionLabel>{activeGenre?.id?`${activeGenre.label} series`:"Popular series"}</SectionLabel>
                  </div>
                  <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 20px"}}>
                    {series.slice(0,10).map(item=>(
                      <div key={item.id} style={{flexShrink:0,cursor:"pointer"}} onClick={()=>setPreview({...item,media_type:"tv"})}>
                        <div style={{position:"relative"}}>
                          <Poster path={item.poster_path} title={item.name} w={100} radius={12}/>
                          <div style={{position:"absolute",bottom:6,right:6,background:"rgba(28,28,26,0.75)",borderRadius:6,padding:"2px 6px",fontSize:11,fontWeight:700,color:"#fff"}}>★ {item.vote_average?.toFixed(1)}</div>
                        </div>
                        <div style={{fontSize:11,color:TEXT2,marginTop:6,width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{item.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* You might like — only on Popular, only when not searching */}
          {isPopular&&!isSearching&&suggested.length>0&&(
            <div style={{marginBottom:28}}>
              <div style={{padding:"0 20px",marginBottom:14}}><SectionLabel>You might like</SectionLabel></div>
              <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 20px"}}>
                {suggested.filter(i=>!libIds.has(i.id)).map(item=>(
                  <div key={item.id} style={{flexShrink:0,cursor:"pointer"}} onClick={()=>setPreview({...item,media_type:item.media_type||"tv"})}>
                    <div style={{position:"relative"}}>
                      <Poster path={item.poster_path} title={item.name||item.title} w={100} radius={12}/>
                      {item.vote_average>0&&<div style={{position:"absolute",bottom:6,right:6,background:"rgba(28,28,26,0.75)",borderRadius:6,padding:"2px 6px",fontSize:11,fontWeight:700,color:"#fff"}}>★ {item.vote_average?.toFixed(1)}</div>}
                    </div>
                    <div style={{fontSize:11,color:TEXT2,marginTop:6,width:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500}}>{item.name||item.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Profile Screen ─────────────────────────────────────────────────────────────
const COUNTRIES=[
  {code:"GB",label:"🇬🇧 United Kingdom"},{code:"US",label:"🇺🇸 United States"},
  {code:"ZA",label:"🇿🇦 South Africa"},{code:"AU",label:"🇦🇺 Australia"},
  {code:"CA",label:"🇨🇦 Canada"},{code:"IE",label:"🇮🇪 Ireland"},
  {code:"FR",label:"🇫🇷 France"},{code:"DE",label:"🇩🇪 Germany"},
  {code:"NL",label:"🇳🇱 Netherlands"},{code:"ES",label:"🇪🇸 Spain"},
];

function ProfileScreen({profile,library,onClose,onSignOut,onProfileUpdate}){
  const [pinned,setPinned]=useState(profile?.pinned_ids||[]);
  const [picking,setPicking]=useState(false);
  const [displayName,setDisplayName]=useState(profile?.display_name||"");
  const [editingName,setEditingName]=useState(false);
  const [savingName,setSavingName]=useState(false);
  const [country,setCountry]=useState(profile?.country||"");
  const finished=library.filter(i=>(i.lists||[]).includes("Finished")||i.rating);

  const togglePin=async(id)=>{
    let next;
    if(pinned.includes(id)){ next=pinned.filter(x=>x!==id); }
    else if(pinned.length<4){ next=[...pinned,id]; }
    else return;
    setPinned(next);
    await sb.from("profiles").update({pinned_ids:next}).eq("id",profile.id);
  };

  const saveName=async()=>{
    if(!displayName.trim()) return;
    setSavingName(true);
    await sb.from("profiles").update({display_name:displayName.trim()}).eq("id",profile.id);
    onProfileUpdate({...profile,display_name:displayName.trim()});
    setSavingName(false);
    setEditingName(false);
  };

  const saveCountry=async(c)=>{
    setCountry(c);
    await sb.from("profiles").update({country:c}).eq("id",profile.id);
    onProfileUpdate({...profile,country:c});
  };

  const pinnedItems=pinned.map(id=>library.find(i=>i.id===id)).filter(Boolean);

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,background:BG,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <button onClick={onClose} style={{background:CARD,border:"none",width:36,height:36,borderRadius:"50%",cursor:"pointer",fontSize:20,color:TEXT,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{fontSize:13,fontWeight:800,letterSpacing:2,textTransform:"uppercase"}}><span style={{color:TEXT}}>SEEN</span><span style={{color:SAGE}}>IT</span></div>
        <div style={{width:36}}/>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"24px 20px 60px"}}>
        {/* Avatar + editable name */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:32}}>
          <Av name={displayName||profile?.username||"?"} size={72}/>
          <div style={{marginTop:14,textAlign:"center"}}>
            {editingName?(
              <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
                <input value={displayName} onChange={e=>setDisplayName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&saveName()}
                  style={{background:CARD,border:"none",borderRadius:10,padding:"8px 12px",fontFamily:"'Instrument Serif',Georgia,serif",fontSize:20,color:TEXT,outline:"none",textAlign:"center",width:180}}
                  autoFocus/>
                <button onClick={saveName} disabled={savingName} style={{background:SAGE,border:"none",borderRadius:8,padding:"8px 14px",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                  {savingName?"…":"Save"}
                </button>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:24,color:TEXT,fontWeight:700}}>{displayName||profile?.username}</div>
                <button onClick={()=>setEditingName(true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:TEXT3,padding:2}}>✏️</button>
              </div>
            )}
            <div style={{fontSize:13,color:TEXT3,marginTop:4}}>@{profile?.username}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{marginBottom:28}}>
          <SectionLabel>Your stats</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            {[
              {label:"Finished",value:library.filter(i=>(i.lists||[]).includes("Finished")).length},
              {label:"Watching",value:library.filter(i=>(i.lists||[]).includes("Watching")).length},
              {label:"Movies",value:library.filter(i=>i.media_type==="movie").length},
              {label:"Series",value:library.filter(i=>i.media_type==="tv").length},
            ].map((s,i)=>(
              <div key={i} style={{background:i===0?TEXT:CARD,borderRadius:14,padding:"16px 14px"}}>
                <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:36,fontWeight:700,color:i===0?BG:TEXT,lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:11,color:i===0?TEXT3:TEXT2,marginTop:6}}>{s.label}</div>
              </div>
            ))}
          </div>
          {(()=>{
            const watchMins=library.reduce((acc,i)=>{
              if(i.media_type==="movie"&&(i.lists||[]).includes("Finished")) return acc+(i._meta?.runtime||100);
              if(i.media_type==="tv") return acc+(i.progress_episode||0)*45;
              return acc;
            },0);
            const watchHours=Math.round(watchMins/60);
            return watchHours>0?(
              <div style={{background:SAGE_LIGHT,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <div style={{fontSize:28}}>🎬</div>
                <div>
                  <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:18,color:TEXT,fontWeight:700}}>{watchHours} hours watched</div>
                  <div style={{fontSize:11,color:TEXT2,marginTop:2}}>That's {Math.round(watchHours/24)} days. Worth it.</div>
                </div>
              </div>
            ):null;
          })()}
          <TopRatedSection items={library.filter(i=>i.media_type==="tv")} label="Top rated series"/>
          <TopRatedSection items={library.filter(i=>i.media_type==="movie")} label="Top rated films"/>
          {(()=>{
            const genres={};
            library.forEach(i=>(i._meta?.genres||[]).forEach(g=>{genres[g.name]=(genres[g.name]||0)+1;}));
            const topGenres=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,5);
            return topGenres.length>0?(
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
            ):null;
          })()}
        </div>

        {/* Pinned favourites */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <SectionLabel>Pinned favourites</SectionLabel>
            <button onClick={()=>setPicking(p=>!p)} style={{background:"none",border:`1.5px solid ${BORDER}`,borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,color:TEXT2,cursor:"pointer",fontFamily:"inherit"}}>{picking?"Done":"Edit"}</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {[0,1,2,3].map(i=>{
              const item=pinnedItems[i];
              const title=item?._meta?.name||item?._meta?.title||"";
              return(
                <div key={i} onClick={()=>{ if(picking&&item) togglePin(item.id); }} style={{aspectRatio:"2/3",borderRadius:10,overflow:"hidden",background:CARD,cursor:picking&&item?"pointer":"default",position:"relative"}}>
                  {item?._meta?.poster_path
                    ?<img src={IMG(item._meta.poster_path)} alt={title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                    :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:TEXT3,fontSize:22}}>{item?"🎬":"+"}</div>}
                  {picking&&item&&<div style={{position:"absolute",inset:0,background:"rgba(28,28,26,0.45)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>✕</div>}
                  {!item&&<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:TEXT3,fontSize:24}}>+</div>}
                </div>
              );
            })}
          </div>
          {picking&&(
            <div style={{marginTop:14}}>
              <div style={{fontSize:12,color:TEXT2,marginBottom:10}}>Tap to add (max 4):</div>
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
                {finished.filter(i=>!pinned.includes(i.id)).map(item=>{
                  const title=item._meta?.name||item._meta?.title||"—";
                  return(
                    <div key={item.id} onClick={()=>togglePin(item.id)} style={{flexShrink:0,cursor:"pointer",opacity:pinned.length>=4?0.4:1}}>
                      <Poster path={item._meta?.poster_path} title={title} w={56} radius={8}/>
                      <div style={{fontSize:10,color:TEXT3,marginTop:4,width:56,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div style={{marginBottom:28}}>
          <SectionLabel>Settings</SectionLabel>
          <div style={{background:CARD,borderRadius:16,overflow:"hidden"}}>
            <div style={{padding:"14px 16px",borderBottom:`1px solid ${BORDER}`}}>
              <div style={{fontSize:13,fontWeight:700,color:TEXT,marginBottom:8}}>Where to watch country</div>
              <select value={country} onChange={e=>saveCountry(e.target.value)}
                style={{width:"100%",background:BG,border:`1px solid ${BORDER}`,borderRadius:8,padding:"8px 12px",fontSize:14,fontFamily:"inherit",color:TEXT,outline:"none"}}>
                <option value="">Auto-detect</option>
                {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button onClick={onSignOut} style={{width:"100%",background:"none",border:`1.5px solid ${BORDER}`,borderRadius:12,padding:"13px",color:TEXT2,fontWeight:700,fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Monthly Wrapped ────────────────────────────────────────────────────────────
function MonthlyWrapped({library,profile,onClose}){
  const now=new Date();
  const monthName=now.toLocaleDateString("en-GB",{month:"long"});
  const year=now.getFullYear();
  const monthStart=new Date(year,now.getMonth(),1).toISOString();

  const thisMonth=library.filter(i=>i.watched_at&&i.watched_at>=monthStart&&(i.lists||[]).includes("Finished"));
  const topRated=[...thisMonth].sort((a,b)=>(b.rating||0)-(a.rating||0))[0];
  const genres={};
  thisMonth.forEach(i=>(i._meta?.genres||[]).forEach(g=>{genres[g.name]=(genres[g.name]||0)+1;}));
  const topGenre=Object.entries(genres).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const watchMins=thisMonth.reduce((acc,i)=>acc+(i._meta?.runtime||(i.media_type==="tv"?(i.progress_episode||0)*45:100)),0);
  const watchHours=Math.round(watchMins/60);
  const name=profile?.display_name||profile?.username||"You";

  if(thisMonth.length===0) return null;

  return(
    <div style={{position:"fixed",inset:0,zIndex:350,background:"rgba(28,28,26,0.7)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:BG,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:430,padding:"28px 24px 48px",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:16,background:CARD,border:"none",width:30,height:30,borderRadius:"50%",color:TEXT2,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:2,color:SAGE,textTransform:"uppercase",marginBottom:6}}>Monthly Wrapped</div>
        <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:28,color:TEXT,marginBottom:24,lineHeight:1.2}}>{name}'s {monthName} in review</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <div style={{background:TEXT,borderRadius:16,padding:"18px 16px"}}>
            <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:40,color:BG,fontWeight:700,lineHeight:1}}>{thisMonth.length}</div>
            <div style={{fontSize:12,color:TEXT3,marginTop:6}}>finished this month</div>
          </div>
          <div style={{background:CARD,borderRadius:16,padding:"18px 16px"}}>
            <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:40,color:TEXT,fontWeight:700,lineHeight:1}}>{watchHours}h</div>
            <div style={{fontSize:12,color:TEXT2,marginTop:6}}>hours watched</div>
          </div>
        </div>
        {topRated&&(
          <div style={{background:SAGE_LIGHT,borderRadius:16,padding:"14px 16px",marginBottom:10,display:"flex",gap:12,alignItems:"center"}}>
            <Poster path={topRated._meta?.poster_path} title={topRated._meta?.name||topRated._meta?.title} w={44} radius={8}/>
            <div>
              <div style={{fontSize:11,color:SAGE,fontWeight:800,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Top rated</div>
              <div style={{fontSize:15,fontWeight:700,color:TEXT}}>{topRated._meta?.name||topRated._meta?.title}</div>
              <Stars value={topRated.rating} size={12}/>
            </div>
          </div>
        )}
        {topGenre&&(
          <div style={{background:CARD,borderRadius:16,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:13,color:TEXT2}}>Favourite genre</div>
            <div style={{fontSize:14,fontWeight:700,color:TEXT}}>{topGenre}</div>
          </div>
        )}
      </div>
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
  const [libTab,setLibTab]=useState("all");
  const [statusTab,setStatusTab]=useState("all");
  const [libSearch,setLibSearch]=useState("");
  const [libSort,setLibSort]=useState("added"); // "added" | "rating" | "alpha"
  const [showProfile,setShowProfile]=useState(false);
  const [showWrapped,setShowWrapped]=useState(false);
  const [focusSearch,setFocusSearch]=useState(false);
  const [discoverPreview,setDiscoverPreview]=useState(null);
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
    // Show items immediately with no meta, then enrich in batches to avoid TMDB rate limits
    setLibrary(data.map(item=>({...item,_meta:null})));
    setLoadingLib(false);
    const BATCH=5;
    const enriched=[...data.map(item=>({...item,_meta:null}))];
    for(let i=0;i<data.length;i+=BATCH){
      const batch=data.slice(i,i+BATCH);
      await Promise.all(batch.map(async(item,bi)=>{
        try{ const meta=await fetchMeta(item.tmdb_id,item.media_type); enriched[i+bi]={...item,_meta:meta}; }
        catch{ /* keep null meta */ }
      }));
      setLibrary([...enriched]);
    }
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
    // Show monthly wrapped once per month
    const wrappedKey=`wrapped_${new Date().getFullYear()}_${new Date().getMonth()}`;
    if(!localStorage.getItem(wrappedKey)){
      const monthStart=new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString();
      const hasFinished=enriched.some(i=>i.watched_at&&i.watched_at>=monthStart&&(i.lists||[]).includes("Finished"));
      if(hasFinished){ setShowWrapped(true); localStorage.setItem(wrappedKey,"1"); }
    }
  };

  // Reset scroll on tab change
  useEffect(()=>{ if(contentRef.current) contentRef.current.scrollTop=0; },[tab]);

  const addToLibrary=async(result)=>{
    if(!session||library.some(i=>i.tmdb_id===result.id)) return;
    const lists=result.lists||["Watchlist"];
    const {data,error}=await sb.from("library").insert({user_id:session.user.id,tmdb_id:result.id,media_type:result.media_type,lists}).select().single();
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
  const libByStatus=statusTab==="all"?libByType:libByType.filter(i=>(i.lists||[]).includes(statusTab));
  const libSearched=libSearch.trim()===""?libByStatus:libByStatus.filter(i=>(i._meta?.name||i._meta?.title||"").toLowerCase().includes(libSearch.toLowerCase()));
  const libFiltered=[...libSearched].sort((a,b)=>{
    if(libSort==="rating") return (b.rating||0)-(a.rating||0);
    if(libSort==="alpha") return (a._meta?.name||a._meta?.title||"").localeCompare(b._meta?.name||b._meta?.title||"");
    return 0; // "added" — already sorted by created_at desc from DB
  });

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
    {id:"discover",label:"Discover",icon:(active)=>(
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?SAGE:"#C0B8AE"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
      </svg>
    )},
  ];

  if(authLoading) return(
    <ToastProvider>
      <div style={{background:BG,minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        <Spin size={28}/>
      </div>
    </ToastProvider>
  );
  if(!session) return <ToastProvider><AuthScreen/></ToastProvider>;

  return(
    <ToastProvider>
    <div style={{background:BG,height:"100dvh",maxWidth:430,margin:"0 auto",fontFamily:"'DM Sans',system-ui,sans-serif",color:TEXT,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:0;height:0;}
        input,textarea,select{font-size:16px!important;}
        input::placeholder,textarea::placeholder{color:${TEXT3};}
        textarea{outline:none;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes up{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}
        .up{animation:up .25s ease forwards;}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
        <div>
          <div style={{fontSize:13,fontWeight:800,letterSpacing:2,textTransform:"uppercase"}}><span style={{color:TEXT}}>SEEN</span><span style={{color:SAGE}}>IT</span></div>
          <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:26,color:TEXT,lineHeight:1.2,marginTop:2}}>
            {tab==="home"?(profile?.display_name?`Hey, ${profile.display_name}.`:"What are you watching?"):tab==="library"?"Your library":tab==="friends"?"Your people":tab==="discover"?"Discover":"Your stats"}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginTop:2}}>
          <button onClick={()=>{ setTab("discover"); setFocusSearch(f=>!f); }} style={{width:40,height:40,borderRadius:"50%",background:TEXT,border:"none",color:BG,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BG} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <div onClick={()=>setShowProfile(true)} style={{cursor:"pointer"}}><Av name={profile?.display_name||profile?.username||"?"} size={40}/></div>
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
                <button onClick={()=>{ setTab("discover"); setFocusSearch(f=>!f); }} style={{background:TEXT,border:"none",borderRadius:12,padding:"12px 24px",color:BG,fontWeight:700,fontSize:14,fontFamily:"inherit",cursor:"pointer"}}>+ Add something</button>
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

          </div>
        )}

        {/* LIBRARY */}
        {tab==="library"&&(
          <div className="up">
            {/* Series / Movies / All tabs */}
            <div style={{display:"flex",gap:0,padding:"0 20px",marginBottom:12,borderBottom:`1px solid ${BORDER}`}}>
              {[{id:"all",label:"All"},{id:"series",label:"Series"},{id:"movies",label:"Movies"}].map(t=>(
                <button key={t.id} onClick={()=>setLibTab(t.id)} style={{padding:"10px 16px",background:"none",border:"none",borderBottom:`2px solid ${libTab===t.id?SAGE:"transparent"}`,color:libTab===t.id?SAGE:TEXT3,fontFamily:"inherit",fontSize:13,fontWeight:700,cursor:"pointer"}}>{t.label}</button>
              ))}
            </div>
            {/* Library search */}
            <div style={{padding:"0 20px",marginBottom:12}}>
              <input value={libSearch} onChange={e=>setLibSearch(e.target.value)} placeholder="Search your library…"
                style={{width:"100%",background:CARD,border:"none",borderRadius:10,padding:"10px 14px",fontSize:14,fontFamily:"inherit",color:TEXT,outline:"none",boxSizing:"border-box"}}/>
            </div>
            {/* Status filter pills + sort */}
            <div style={{display:"flex",alignItems:"center",padding:"0 20px",marginBottom:16,gap:8}}>
              <div style={{display:"flex",gap:8,flex:1,overflowX:"auto"}}>
                {[{id:"all",label:"All"},{id:"Watching",label:"Watching",color:SAGE},{id:"Watchlist",label:"Watchlist"},{id:"Finished",label:"Finished",color:"#E65100"},{id:"Dropped",label:"Dropped",color:"#9B4444"}].map(s=>{
                  const active=statusTab===s.id;
                  return(
                    <button key={s.id} onClick={()=>setStatusTab(s.id)} style={{flexShrink:0,padding:"6px 14px",borderRadius:20,border:`1.5px solid ${active?(s.color||TEXT):BORDER}`,background:active?(s.color||TEXT):"transparent",color:active?"#fff":TEXT2,fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all .15s"}}>{s.label}</button>
                  );
                })}
              </div>
              {/* Sort dropdown */}
              <select value={libSort} onChange={e=>setLibSort(e.target.value)}
                style={{flexShrink:0,background:CARD,border:`1.5px solid ${BORDER}`,borderRadius:20,padding:"6px 12px",fontSize:12,fontWeight:700,color:TEXT2,fontFamily:"inherit",outline:"none",cursor:"pointer"}}>
                <option value="added">Latest</option>
                <option value="rating">Top rated</option>
                <option value="alpha">A–Z</option>
              </select>
            </div>
            {loadingLib&&library.length===0&&<div style={{display:"flex",justifyContent:"center",padding:"30px 0"}}><Spin/></div>}
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
                        <div style={{position:"absolute",bottom:0,left:0,right:0,height:4,background:(item.lists||[]).includes("Finished")?"#E65100":(item.lists||[]).includes("Watching")?SAGE:(item.lists||[]).includes("Dropped")?"#9B4444":"#C0B8AE"}}/>
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
                  {[{color:"#E65100",label:"Finished"},{color:SAGE,label:"Watching"},{color:"#9B4444",label:"Dropped"},{color:"#C0B8AE",label:"Watchlist"}].map(l=>(
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
        {tab==="discover"&&<div className="up"><DiscoverScreen library={library} onAdd={addToLibrary} focusSearch={focusSearch} onOpenDetail={setDetail} suggested={suggested}/></div>}
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
      {discoverPreview&&<DiscoverPreview item={discoverPreview} library={library} onClose={()=>setDiscoverPreview(null)} onAdd={addToLibrary} onOpenDetail={(item)=>{ setDiscoverPreview(null); setDetail(item); }}/>}
      {detail&&!episodes&&<DetailSheet item={detail} onClose={()=>setDetail(null)} onUpdate={updateItem} onDelete={deleteItem} onEpisodes={()=>setEpisodes(detail)} userId={session?.user?.id} profile={profile}/>}
      {episodes&&<EpisodeSheet item={episodes} userId={session?.user?.id} onClose={()=>setEpisodes(null)} onProgressSaved={updated=>{ updateItem(updated); setEpisodes(null); }}/>}
      {showProfile&&<ProfileScreen profile={profile} library={library} onClose={()=>setShowProfile(false)} onSignOut={()=>{ setShowProfile(false); signOut(); }} onProfileUpdate={setProfile}/>}
      {showWrapped&&<MonthlyWrapped library={library} profile={profile} onClose={()=>setShowWrapped(false)}/>}
    </div>
    </ToastProvider>
  );
}
