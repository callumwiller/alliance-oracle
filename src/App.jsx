import { useState, useEffect, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TBA_API_KEY = "BTKpZuBnD1JbsYD0z1BDsV5D63D4jcTGj9pjRv5a2w4nJkLd5OFhbDp2VAiQN3QY";
const TBA_BASE = "https://www.thebluealliance.com/api/v3";
const CURRENT_YEAR = new Date().getFullYear();
const ALLIANCE_COUNT = 8;
const ADMIN_PASSWORD = "frc2024";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:       "#080c10",
  surface:  "#0e1419",
  border:   "rgba(255,255,255,0.07)",
  borderHover: "rgba(99,179,237,0.5)",
  accent:   "#63b3ed",
  accentDim:"rgba(99,179,237,0.12)",
  success:  "#48bb78",
  warn:     "#f6ad55",
  danger:   "#fc8181",
  text:     "#e2e8f0",
  muted:    "#4a5568",
  subtle:   "#718096",
};

// ─── TBA API ──────────────────────────────────────────────────────────────────
async function tbaFetch(path) {
  const res = await fetch(`${TBA_BASE}${path}`, { headers: { "X-TBA-Auth-Key": TBA_API_KEY } });
  if (!res.ok) throw new Error(`TBA error: ${res.status}`);
  return res.json();
}
async function getOntarioEvents(year = CURRENT_YEAR) {
  const events = await tbaFetch(`/events/${year}`);
  return events.filter(e => e.state_prov === "ON" && e.event_type <= 6).sort((a,b) => new Date(a.start_date)-new Date(b.start_date));
}
async function getEventTeams(eventKey) {
  const teams = await tbaFetch(`/event/${eventKey}/teams`);
  return teams.map(t=>({number:t.team_number,name:t.nickname})).sort((a,b)=>a.number-b.number);
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
async function storageGet(key) { try { const v=localStorage.getItem("shared:"+key); return v?JSON.parse(v):null; } catch{return null;} }
async function storageSet(key,val) { try{localStorage.setItem("shared:"+key,JSON.stringify(val));}catch{} }
async function storageGetPersonal(key) { try{const v=localStorage.getItem("personal:"+key);return v?JSON.parse(v):null;}catch{return null;} }
async function storageSetPersonal(key,val) { try{localStorage.setItem("personal:"+key,JSON.stringify(val));}catch{} }

// ─── SCORING ──────────────────────────────────────────────────────────────────
function scoreSubmission(prediction, actual) {
  let score = 0;
  for (let a=0;a<ALLIANCE_COUNT;a++) {
    const pred=(prediction[a]||[]).filter(Boolean), act=(actual[a]||[]).filter(Boolean), actNums=act.map(t=>t.number);
    for (let s=0;s<pred.length;s++) { if(!pred[s])continue; if(actNums.includes(pred[s].number)) score+=actNums[s]===pred[s].number?3:1; }
    if(pred[0]&&act[0]&&pred[0].number===act[0].number) score+=2;
  }
  return score;
}
const MAX_SCORE = ALLIANCE_COUNT*(3*3+2);

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  card: { background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"18px 22px" },
  input: { width:"100%", boxSizing:"border-box", padding:"10px 14px", background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, borderRadius:7, color:T.text, fontSize:14, outline:"none", fontFamily:"inherit", transition:"border-color 0.2s" },
  btn: (v="primary") => ({ padding:"10px 20px", borderRadius:7, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit", transition:"opacity 0.15s", ...(v==="primary"?{background:T.accent,color:"#050a10"}:v==="ghost"?{background:"rgba(255,255,255,0.05)",color:T.subtle,border:`1px solid ${T.border}`}:{background:T.accentDim,color:T.accent,border:`1px solid rgba(99,179,237,0.3)`}) }),
};

const GS = () => (<style>{`
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html,body,#root{min-height:100%;background:${T.bg};}
  body{font-family:'Inter',system-ui,sans-serif;color:${T.text};-webkit-font-smoothing:antialiased;}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  input::placeholder{color:${T.muted};}
  input:focus{border-color:${T.accent}!important;}
  ::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
`}</style>);

function Spinner({size=16}){return(<div style={{display:"flex",alignItems:"center",gap:10,color:T.subtle,fontSize:13}}><div style={{width:size,height:size,border:"2px solid rgba(255,255,255,0.08)",borderTop:`2px solid ${T.accent}`,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>Loading…</div>);}
function Badge({children,color=T.accent}){return(<span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:4,background:color+"18",border:`1px solid ${color}33`,color,fontSize:11,fontWeight:600,letterSpacing:0.4,whiteSpace:"nowrap"}}>{children}</span>);}
function Divider(){return <div style={{height:1,background:T.border,margin:"24px 0"}}/>;}

function Logo({size="md"}){
  const big=size==="lg";
  return(<div style={{display:"flex",alignItems:"center",gap:big?14:10}}>
    <div style={{width:big?48:32,height:big?48:32,borderRadius:big?12:8,background:`linear-gradient(135deg,${T.accent},#3182ce)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:big?22:15,flexShrink:0,boxShadow:"0 0 20px rgba(99,179,237,0.25)"}}>🏆</div>
    <div>
      <div style={{fontSize:big?22:15,fontWeight:800,color:T.text,letterSpacing:-0.5,lineHeight:1.1}}>WhosOn<span style={{color:T.accent}}>FIRST</span>Alliance</div>
      {big&&<div style={{fontSize:12,color:T.subtle,marginTop:3}}>Ontario FRC Alliance Predictions</div>}
    </div>
  </div>);
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthScreen({onLogin}){
  const [mode,setMode]=useState("login"),[username,setUsername]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const handle=async()=>{
    if(!username.trim()||!password.trim())return setError("Please fill in both fields.");
    setLoading(true);setError("");
    const users=await storageGet("wof:users")||{};
    if(mode==="register"){
      if(users[username.toLowerCase()]){setError("Username already taken.");setLoading(false);return;}
      users[username.toLowerCase()]={username,password,createdAt:Date.now()};
      await storageSet("wof:users",users);await storageSetPersonal("wof:session",{username});onLogin({username});
    } else {
      const user=users[username.toLowerCase()];
      if(!user||user.password!==password){setError("Incorrect username or password.");setLoading(false);return;}
      await storageSetPersonal("wof:session",{username:user.username});onLogin({username:user.username});
    }
    setLoading(false);
  };
  return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,padding:24,backgroundImage:"radial-gradient(ellipse at 60% 0%,rgba(99,179,237,0.06) 0%,transparent 60%)"}}>
    <GS/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <div style={{width:"100%",maxWidth:400,animation:"fadeIn 0.3s ease"}}>
      <div style={{textAlign:"center",marginBottom:40}}><Logo size="lg"/></div>
      <div style={{...S.card,padding:"28px 32px"}}>
        <div style={{display:"flex",background:"rgba(255,255,255,0.04)",borderRadius:8,padding:3,marginBottom:24,border:`1px solid ${T.border}`}}>
          {[["login","Sign In"],["register","Create Account"]].map(([m,label])=>(
            <button key={m} onClick={()=>{setMode(m);setError("");}} style={{flex:1,padding:"8px",border:"none",borderRadius:6,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,background:mode===m?T.accentDim:"transparent",color:mode===m?T.accent:T.muted,transition:"all 0.2s"}}>{label}</button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input style={S.input} placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/>
          <input style={S.input} placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()}/>
          {error&&<div style={{color:T.danger,fontSize:13,padding:"8px 12px",background:"rgba(252,129,129,0.08)",borderRadius:6,border:"1px solid rgba(252,129,129,0.2)"}}>{error}</div>}
          <button style={{...S.btn("primary"),width:"100%",padding:"12px",fontSize:14,marginTop:4}} onClick={handle} onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{loading?"…":mode==="login"?"Sign In":"Create Account"}</button>
        </div>
        <p style={{textAlign:"center",fontSize:11,color:T.muted,marginTop:20,lineHeight:1.5}}>⚠ Passwords stored in plain text in this demo.<br/>Don't reuse a real password.</p>
      </div>
    </div>
  </div>);
}

// ─── TEAM DROPDOWN ────────────────────────────────────────────────────────────
function TeamDropdown({team,allTeams,usedTeams,onSelect,label}){
  const [open,setOpen]=useState(false),[search,setSearch]=useState(""),ref=useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const filtered=allTeams.filter(t=>(!usedTeams.has(t.number)||team?.number===t.number)&&(String(t.number).includes(search)||t.name.toLowerCase().includes(search.toLowerCase())));
  return(<div ref={ref} style={{position:"relative",flex:1,minWidth:0}}>
    <div onClick={()=>setOpen(!open)} style={{padding:"7px 11px",borderRadius:7,minHeight:36,border:`1px solid ${team?"rgba(99,179,237,0.4)":T.border}`,background:team?"rgba(99,179,237,0.06)":"rgba(255,255,255,0.02)",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"border-color 0.2s"}}>
      {team?(<><span style={{color:T.accent,fontWeight:700,fontSize:12,minWidth:36}}>{team.number}</span><span style={{color:T.subtle,fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team.name}</span><button onClick={e=>{e.stopPropagation();onSelect(null);}} style={{background:"none",border:"none",color:T.danger,cursor:"pointer",fontSize:14,padding:0,lineHeight:1}}>×</button></>)
      :(<span style={{color:T.muted,fontSize:11}}>+ {label}</span>)}
    </div>
    {open&&(<div style={{position:"absolute",zIndex:300,top:"calc(100% + 4px)",left:0,right:0,background:"#111820",border:`1px solid rgba(99,179,237,0.25)`,borderRadius:8,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,0.8)",maxHeight:220,display:"flex",flexDirection:"column"}}>
      <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search team…" style={{...S.input,borderRadius:0,border:"none",borderBottom:`1px solid ${T.border}`,fontSize:12}}/>
      <div style={{overflowY:"auto",flex:1}}>
        {filtered.length===0&&<div style={{padding:"12px 14px",color:T.muted,fontSize:12}}>No results</div>}
        {filtered.map(t=>(<div key={t.number} onClick={()=>{onSelect(t);setOpen(false);setSearch("");}} style={{padding:"8px 14px",cursor:"pointer",fontSize:12,display:"flex",gap:10,alignItems:"center",background:team?.number===t.number?T.accentDim:"transparent",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"} onMouseLeave={e=>e.currentTarget.style.background=team?.number===t.number?T.accentDim:"transparent"}><span style={{color:T.accent,fontWeight:700,minWidth:38}}>{t.number}</span><span style={{color:T.subtle}}>{t.name}</span></div>))}
      </div>
    </div>)}
  </div>);
}

function AllianceRow({idx,teams,allTeams,usedTeams,onUpdate}){
  const colors=["#f56565","#ed8936","#ecc94b","#48bb78","#38b2ac","#63b3ed","#9f7aea","#ed64a6"];
  const color=colors[idx];
  const LABELS=["Captain","Pick 1","Pick 2"];
  return(<div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:8,background:"rgba(255,255,255,0.02)",border:`1px solid ${T.border}`,marginBottom:5}}>
    <div style={{width:26,height:26,borderRadius:6,flexShrink:0,background:color+"18",border:`1px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color}}>{idx+1}</div>
    <div style={{display:"flex",gap:6,flex:1,minWidth:0}}>
      {[0,1,2].map(s=>(<TeamDropdown key={s} team={teams[s]||null} allTeams={allTeams} usedTeams={usedTeams} label={LABELS[s]} onSelect={t=>{const next=[...teams];next[s]=t;onUpdate(next);}}/>))}
    </div>
  </div>);
}

// ─── PREDICTION FORM ──────────────────────────────────────────────────────────
function PredictionForm({event,teams,user,existingPrediction,onSubmit}){
  const [alliances,setAlliances]=useState(existingPrediction?.alliances||Array.from({length:ALLIANCE_COUNT},()=>[null,null,null]));
  const [saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
  const usedTeams=new Set(alliances.flat().filter(Boolean).map(t=>t.number));
  const totalFilled=alliances.flat().filter(Boolean).length,allFilled=totalFilled===ALLIANCE_COUNT*3;
  const handleSubmit=async()=>{if(!allFilled)return alert(`Please fill all ${ALLIANCE_COUNT*3} slots first.`);setSaving(true);await onSubmit({alliances,submittedAt:Date.now()});setSaved(true);setSaving(false);};
  return(<div style={{animation:"fadeIn 0.2s ease"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
      <div><h2 style={{fontSize:18,fontWeight:700,color:T.text}}>Your Prediction</h2><div style={{fontSize:12,color:T.subtle,marginTop:3}}>{event.name}</div></div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <Badge color={allFilled?T.success:T.warn}>{totalFilled}/{ALLIANCE_COUNT*3} slots filled</Badge>
        {saved&&<Badge color={T.success}>✓ Saved</Badge>}
      </div>
    </div>
    <div style={{...S.card,padding:"14px 16px",marginBottom:16}}>
      <div style={{fontSize:11,color:T.muted,fontWeight:600,letterSpacing:0.8,marginBottom:12,textTransform:"uppercase"}}>Alliance Selections — Captain · Pick 1 · Pick 2</div>
      {alliances.map((a,i)=>(<AllianceRow key={i} idx={i} teams={a} allTeams={teams} usedTeams={usedTeams} onUpdate={next=>{const copy=[...alliances];copy[i]=next;setAlliances(copy);setSaved(false);}}/>))}
    </div>
    <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:24}}>
      <button onClick={handleSubmit} disabled={saving} style={{...S.btn("primary"),opacity:saving?0.6:1,padding:"11px 24px"}} onMouseEnter={e=>e.currentTarget.style.opacity=saving?"0.6":"0.85"} onMouseLeave={e=>e.currentTarget.style.opacity=saving?"0.6":"1"}>{saving?"Saving…":saved?"Update Prediction":"Lock In Prediction"}</button>
      <span style={{fontSize:12,color:T.muted}}>You can update your picks any time before alliance selection.</span>
    </div>
    <div style={{...S.card}}>
      <div style={{fontSize:11,color:T.muted,fontWeight:600,letterSpacing:0.8,marginBottom:12,textTransform:"uppercase"}}>Scoring Guide</div>
      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
        {[["Correct team, exact slot","+3 pts"],["Correct team, wrong slot","+1 pt"],["Correct alliance captain","+2 bonus"]].map(([label,pts])=>(<div key={label} style={{display:"flex",gap:8,alignItems:"center"}}><span style={{color:T.accent,fontWeight:700,fontSize:13,minWidth:52}}>{pts}</span><span style={{color:T.subtle,fontSize:12}}>{label}</span></div>))}
        <div style={{color:T.muted,fontSize:12}}>Max: {MAX_SCORE} pts</div>
      </div>
    </div>
  </div>);
}

// ─── LEADERBOARD ROW ──────────────────────────────────────────────────────────
function LBRow({rank,username,score,maxScore,subtitle,hasResults,isMe}){
  const medals=["🥇","🥈","🥉"];
  return(<div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:8,background:isMe?"rgba(99,179,237,0.05)":rank===0&&hasResults?"rgba(246,173,85,0.04)":"rgba(255,255,255,0.02)",border:`1px solid ${isMe?"rgba(99,179,237,0.25)":rank===0&&hasResults?"rgba(246,173,85,0.2)":T.border}`,transition:"transform 0.15s",marginBottom:6}} onMouseEnter={e=>e.currentTarget.style.transform="translateX(3px)"} onMouseLeave={e=>e.currentTarget.style.transform="none"}>
    <span style={{fontSize:rank<3&&hasResults?18:13,minWidth:28,textAlign:"center",color:T.muted}}>{rank<3&&hasResults?medals[rank]:`#${rank+1}`}</span>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontWeight:600,color:isMe?T.accent:T.text,fontSize:14,display:"flex",alignItems:"center",gap:6}}>{username}{isMe&&<Badge color={T.accent}>you</Badge>}</div>
      {subtitle&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>{subtitle}</div>}
    </div>
    {hasResults?(<div style={{textAlign:"right"}}>
      <span style={{fontSize:17,fontWeight:800,color:rank===0?T.warn:T.text}}>{score}</span>
      {maxScore&&<span style={{fontSize:11,color:T.muted,marginLeft:3}}>/ {maxScore}</span>}
      {maxScore&&<div style={{width:72,height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,marginTop:5}}><div style={{height:"100%",width:`${Math.min((score/maxScore)*100,100)}%`,background:`linear-gradient(90deg,${T.accent},#3182ce)`,borderRadius:2}}/></div>}
    </div>):<span style={{fontSize:11,color:T.muted}}>pending</span>}
  </div>);
}

function EventLeaderboard({event,allSubmissions,actual,currentUser}){
  const hasResults=!!actual?.[event.key];
  const subs=(allSubmissions[event.key]||[]).map(s=>({...s,score:hasResults?scoreSubmission(s.alliances,actual[event.key]):null})).sort((a,b)=>(b.score??-1)-(a.score??-1));
  return(<div style={{animation:"fadeIn 0.2s ease"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
      <div><h2 style={{fontSize:18,fontWeight:700,color:T.text}}>Event Leaderboard</h2><div style={{fontSize:12,color:T.subtle,marginTop:3}}>{event.name}</div></div>
      {hasResults?<Badge color={T.success}>✓ Results In</Badge>:<Badge color={T.warn}>⏳ Awaiting Results</Badge>}
    </div>
    {!hasResults&&<div style={{...S.card,marginBottom:16,borderColor:"rgba(246,173,85,0.2)",background:"rgba(246,173,85,0.04)"}}><p style={{color:T.warn,fontSize:13}}>Scores will appear once an admin enters the official alliance selections.</p></div>}
    {subs.length===0?<div style={{textAlign:"center",padding:"48px",color:T.muted,fontSize:14}}>No predictions yet for this event.</div>
    :subs.map((s,i)=><LBRow key={i} rank={i} username={s.username} score={s.score} maxScore={MAX_SCORE} subtitle={new Date(s.submittedAt).toLocaleDateString()} hasResults={hasResults} isMe={s.username===currentUser}/>)}
  </div>);
}

function SeasonLeaderboard({allSubmissions,actual,year=CURRENT_YEAR,currentUser}){
  const totals={},counts={};
  for(const[key,subs]of Object.entries(allSubmissions)){if(!key.startsWith(String(year))||!actual?.[key])continue;for(const s of subs){const sc=scoreSubmission(s.alliances,actual[key]);totals[s.username]=(totals[s.username]||0)+sc;counts[s.username]=(counts[s.username]||0)+1;}}
  const rows=Object.entries(totals).map(([u,t])=>({username:u,total:t,events:counts[u]})).sort((a,b)=>b.total-a.total);
  const scored=Object.keys(actual||{}).filter(k=>k.startsWith(String(year))).length;
  return(<div style={{animation:"fadeIn 0.2s ease"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
      <div><h2 style={{fontSize:18,fontWeight:700,color:T.text}}>{year} Season Leaderboard</h2><div style={{fontSize:12,color:T.subtle,marginTop:3}}>Cumulative score across all Ontario events · {scored} event{scored!==1?"s":""} scored</div></div>
      <Badge color={T.accent}>Season {year}</Badge>
    </div>
    {rows.length===0?<div style={{...S.card,textAlign:"center",padding:"48px",color:T.muted,fontSize:14}}>No scored events yet this season.</div>
    :rows.map((r,i)=><LBRow key={r.username} rank={i} username={r.username} score={r.total} subtitle={`${r.events} event${r.events!==1?"s":""} · avg ${Math.round(r.total/r.events)} pts`} hasResults={true} isMe={r.username===currentUser}/>)}
  </div>);
}

function AllTimeLeaderboard({allSubmissions,actual,currentUser}){
  const stats={};
  for(const[key,subs]of Object.entries(allSubmissions)){if(!actual?.[key])continue;const year=key.match(/^(\d{4})/)?.[1];for(const s of subs){const sc=scoreSubmission(s.alliances,actual[key]);if(!stats[s.username])stats[s.username]={total:0,events:0,best:0,seasons:new Set()};stats[s.username].total+=sc;stats[s.username].events++;if(sc>stats[s.username].best)stats[s.username].best=sc;if(year)stats[s.username].seasons.add(year);}}
  const rows=Object.entries(stats).map(([u,s])=>({username:u,...s,seasons:s.seasons.size,avg:Math.round(s.total/s.events)})).sort((a,b)=>b.total-a.total);
  return(<div style={{animation:"fadeIn 0.2s ease"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
      <div><h2 style={{fontSize:18,fontWeight:700,color:T.text}}>All-Time Leaderboard</h2><div style={{fontSize:12,color:T.subtle,marginTop:3}}>Total points across every season and event</div></div>
      <Badge color="#9f7aea">All Time</Badge>
    </div>
    {rows.length===0?<div style={{...S.card,textAlign:"center",padding:"48px",color:T.muted,fontSize:14}}>No scored events yet.</div>
    :rows.map((r,i)=><LBRow key={r.username} rank={i} username={r.username} score={r.total} subtitle={`${r.events} event${r.events!==1?"s":""} · ${r.seasons} season${r.seasons!==1?"s":""} · best: ${r.best} pts · avg: ${r.avg} pts`} hasResults={true} isMe={r.username===currentUser}/>)}
    {rows.length>0&&(<><Divider/><div style={{fontSize:11,color:T.muted,fontWeight:600,letterSpacing:0.8,textTransform:"uppercase",marginBottom:14}}>Hall of Fame</div><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{[["🏆 Most Points",rows[0]?.username,rows[0]?.total+" pts"],["🎯 Best Average",[...rows].sort((a,b)=>b.avg-a.avg)[0]?.username,[...rows].sort((a,b)=>b.avg-a.avg)[0]?.avg+" avg"],["📅 Most Events",[...rows].sort((a,b)=>b.events-a.events)[0]?.username,[...rows].sort((a,b)=>b.events-a.events)[0]?.events+" events"]].map(([label,name,val])=>(<div key={label} style={{...S.card,flex:1,minWidth:140}}><div style={{fontSize:11,color:T.muted,marginBottom:6}}>{label}</div><div style={{fontWeight:700,color:T.text,fontSize:14}}>{name}</div><div style={{fontSize:12,color:T.accent,marginTop:2}}>{val}</div></div>))}</div></>)}
  </div>);
}

function AdminPanel({event,teams,actual,onSaveActual,allSubmissions}){
  const [alliances,setAlliances]=useState(actual?.[event.key]||Array.from({length:ALLIANCE_COUNT},()=>[null,null,null]));
  const [saved,setSaved]=useState(!!actual?.[event.key]);
  const usedTeams=new Set(alliances.flat().filter(Boolean).map(t=>t.number));
  return(<div style={{animation:"fadeIn 0.2s ease"}}>
    <div style={{...S.card,marginBottom:20,borderColor:"rgba(246,173,85,0.2)",background:"rgba(246,173,85,0.04)"}}><p style={{color:T.warn,fontSize:13}}>⚙ Enter the official alliance selections to score all predictions for this event.</p></div>
    <div style={{...S.card,padding:"14px 16px",marginBottom:16}}>
      {alliances.map((a,i)=>(<AllianceRow key={i} idx={i} teams={a} allTeams={teams} usedTeams={usedTeams} onUpdate={next=>{const copy=alliances.map(x=>[...x]);copy[i]=next;setAlliances(copy);setSaved(false);}}/>))}
    </div>
    <button onClick={async()=>{await onSaveActual(event.key,alliances);setSaved(true);}} style={{...S.btn(saved?"outline":"primary"),padding:"11px 24px"}} onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{saved?"✓ Results Saved":"Save Official Results"}</button>
    <Divider/>
    <div style={{fontSize:11,color:T.muted,fontWeight:600,letterSpacing:0.8,textTransform:"uppercase",marginBottom:12}}>{(allSubmissions[event.key]||[]).length} Submissions</div>
    {(allSubmissions[event.key]||[]).map((s,i)=>(<div key={i} style={{...S.card,marginBottom:6,display:"flex",justifyContent:"space-between",padding:"10px 16px"}}><span style={{fontWeight:600,fontSize:13}}>{s.username}</span><span style={{color:T.muted,fontSize:11}}>{new Date(s.submittedAt).toLocaleString()}</span></div>))}
  </div>);
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({onSelectEvent,allSubmissions,actual,currentUser}){
  const [events,setEvents]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[tab,setTab]=useState("events");
  useEffect(()=>{(async()=>{try{setEvents(await getOntarioEvents());}catch{setError("Couldn't load events.");}setLoading(false);})();},[]);
  const fmt=d=>new Date(d).toLocaleDateString("en-CA",{month:"short",day:"numeric"});
  const tabs=[{id:"events",label:"Events"},{id:"season",label:`${CURRENT_YEAR} Season`},{id:"alltime",label:"All-Time"}];
  return(<div>
    <div style={{display:"flex",gap:2,marginBottom:28,borderBottom:`1px solid ${T.border}`}}>
      {tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 18px",border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:tab===t.id?T.accent:T.subtle,borderBottom:`2px solid ${tab===t.id?T.accent:"transparent"}`,marginBottom:-1,transition:"color 0.15s"}}>{t.label}</button>))}
    </div>
    {tab==="events"&&(<div style={{animation:"fadeIn 0.2s ease"}}>
      <div style={{marginBottom:20}}><h2 style={{fontSize:18,fontWeight:700,color:T.text}}>Ontario Events — {CURRENT_YEAR}</h2><p style={{fontSize:12,color:T.subtle,marginTop:4}}>Select an event to submit your alliance selection predictions.</p></div>
      {loading&&<Spinner/>}
      {error&&<div style={{...S.card,borderColor:"rgba(252,129,129,0.2)",background:"rgba(252,129,129,0.04)",color:T.danger,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {events.map(ev=>{
          const hasResults=!!actual?.[ev.key],subCount=(allSubmissions[ev.key]||[]).length,myPick=(allSubmissions[ev.key]||[]).find(s=>s.username===currentUser);
          return(<div key={ev.key} onClick={()=>onSelectEvent(ev)} style={{...S.card,cursor:"pointer",display:"flex",alignItems:"center",gap:16,transition:"border-color 0.2s,background 0.2s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.borderHover;e.currentTarget.style.background="rgba(99,179,237,0.04)";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surface;}}>
            <div style={{minWidth:48,textAlign:"center",padding:"6px 4px",borderRadius:8,background:T.accentDim,flexShrink:0}}>
              <div style={{fontSize:10,color:T.accent,fontWeight:700,letterSpacing:0.5}}>{new Date(ev.start_date+"T12:00:00").toLocaleDateString("en-CA",{month:"short"}).toUpperCase()}</div>
              <div style={{fontSize:18,fontWeight:800,color:T.text,lineHeight:1.2}}>{new Date(ev.start_date+"T12:00:00").getDate()}</div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,color:T.text,fontSize:14}}>{ev.name}</div>
              <div style={{fontSize:11,color:T.subtle,marginTop:2}}>{ev.city} · {fmt(ev.start_date)} – {fmt(ev.end_date)}</div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
              {myPick&&<Badge color={T.accent}>✓ Picked</Badge>}
              {subCount>0&&<Badge color={T.muted}>{subCount}</Badge>}
              {hasResults&&<Badge color={T.success}>Scored</Badge>}
            </div>
            <div style={{color:T.muted,fontSize:16}}>›</div>
          </div>);
        })}
      </div>
    </div>)}
    {tab==="season"&&<SeasonLeaderboard allSubmissions={allSubmissions} actual={actual} year={CURRENT_YEAR} currentUser={currentUser}/>}
    {tab==="alltime"&&<AllTimeLeaderboard allSubmissions={allSubmissions} actual={actual} currentUser={currentUser}/>}
  </div>);
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState(null),[sessionLoaded,setSessionLoaded]=useState(false),[selectedEvent,setSelectedEvent]=useState(null),[teams,setTeams]=useState([]),[teamsLoading,setTeamsLoading]=useState(false),[activeTab,setActiveTab]=useState("predict"),[allSubmissions,setAllSubmissions]=useState({}),[actual,setActual]=useState({}),[isAdmin,setIsAdmin]=useState(false);
  useEffect(()=>{(async()=>{const session=await storageGetPersonal("wof:session");if(session?.username)setUser(session);setAllSubmissions(await storageGet("wof:submissions")||{});setActual(await storageGet("wof:actual")||{});setSessionLoaded(true);})();},[]);
  useEffect(()=>{if(!selectedEvent)return;setTeams([]);setTeamsLoading(true);getEventTeams(selectedEvent.key).then(setTeams).catch(()=>setTeams([])).finally(()=>setTeamsLoading(false));},[selectedEvent]);
  const handleSubmitPrediction=async({alliances,submittedAt})=>{const key=selectedEvent.key,existing=(allSubmissions[key]||[]).filter(s=>s.username!==user.username),updated={...allSubmissions,[key]:[...existing,{username:user.username,alliances,submittedAt}]};setAllSubmissions(updated);await storageSet("wof:submissions",updated);};
  const handleSaveActual=async(eventKey,alliances)=>{const updated={...actual,[eventKey]:alliances};setActual(updated);await storageSet("wof:actual",updated);};
  const handleLogout=async()=>{await storageSetPersonal("wof:session",null);setUser(null);setSelectedEvent(null);setIsAdmin(false);};
  const myPrediction=selectedEvent?(allSubmissions[selectedEvent.key]||[]).find(s=>s.username===user?.username):null;

  if(!sessionLoaded)return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><GS/><Spinner size={24}/></div>);
  if(!user)return <AuthScreen onLogin={setUser}/>;

  const eventTabs=[{id:"predict",label:"Predict"},{id:"leaderboard",label:"Leaderboard"},...(isAdmin?[{id:"admin",label:"Admin"}]:[])];

  return(<div style={{minHeight:"100vh",background:T.bg,color:T.text}}>
    <GS/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
    <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(8,12,16,0.92)",backdropFilter:"blur(12px)",borderBottom:`1px solid ${T.border}`,padding:"0 24px",height:52,display:"flex",alignItems:"center",gap:16}}>
      <button onClick={()=>{setSelectedEvent(null);setIsAdmin(false);}} style={{background:"none",border:"none",cursor:"pointer",padding:0}}><Logo/></button>
      {selectedEvent&&(<><span style={{color:T.muted,fontSize:14}}>/</span><span style={{fontSize:13,color:T.subtle,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedEvent.name}</span></>)}
      <div style={{flex:1}}/>
      {selectedEvent&&!isAdmin&&<button onClick={()=>{const pw=prompt("Admin password:");if(pw===ADMIN_PASSWORD)setIsAdmin(true);else if(pw!==null)alert("Incorrect password.");}} style={{...S.btn("ghost"),fontSize:12,padding:"6px 12px"}}>Admin</button>}
      {isAdmin&&<Badge color={T.warn}>ADMIN</Badge>}
      <div style={{display:"flex",alignItems:"center",gap:10,paddingLeft:8,borderLeft:`1px solid ${T.border}`}}>
        <span style={{fontSize:12,color:T.subtle}}>{user.username}</span>
        <button onClick={handleLogout} style={{...S.btn("ghost"),fontSize:12,padding:"6px 12px"}}>Sign out</button>
      </div>
    </nav>
    <main style={{maxWidth:860,margin:"0 auto",padding:"32px 24px 80px"}}>
      {!selectedEvent?(<HomeScreen onSelectEvent={ev=>{setSelectedEvent(ev);setActiveTab("predict");}} allSubmissions={allSubmissions} actual={actual} currentUser={user.username}/>):(<>
        <button onClick={()=>setSelectedEvent(null)} style={{...S.btn("ghost"),fontSize:12,padding:"6px 12px",marginBottom:20}}>← Back to Events</button>
        <div style={{display:"flex",gap:2,marginBottom:28,borderBottom:`1px solid ${T.border}`}}>
          {eventTabs.map(t=>(<button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:"10px 18px",border:"none",background:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,color:activeTab===t.id?(t.id==="admin"?T.warn:T.accent):T.subtle,borderBottom:`2px solid ${activeTab===t.id?(t.id==="admin"?T.warn:T.accent):"transparent"}`,marginBottom:-1,transition:"color 0.15s"}}>{t.label}</button>))}
        </div>
        {teamsLoading&&<Spinner/>}
        {!teamsLoading&&activeTab==="predict"&&<PredictionForm event={selectedEvent} teams={teams} user={user} existingPrediction={myPrediction} onSubmit={handleSubmitPrediction}/>}
        {!teamsLoading&&activeTab==="leaderboard"&&<EventLeaderboard event={selectedEvent} allSubmissions={allSubmissions} actual={actual} currentUser={user.username}/>}
        {!teamsLoading&&activeTab==="admin"&&isAdmin&&<AdminPanel event={selectedEvent} teams={teams} actual={actual} onSaveActual={handleSaveActual} allSubmissions={allSubmissions}/>}
      </>)}
    </main>
  </div>);
}