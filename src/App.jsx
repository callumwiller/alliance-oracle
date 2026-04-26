import { useState, useEffect, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Replace this with your actual Blue Alliance API key from thebluealliance.com/account
const TBA_API_KEY = "BTKpZuBnD1JbsYD0z1BDsV5D63D4jcTGj9pjRv5a2w4nJkLd5OFhbDp2VAiQN3QY";
const TBA_BASE = "https://www.thebluealliance.com/api/v3";
const CURRENT_YEAR = new Date().getFullYear();
const ALLIANCE_COUNT = 8;

// ─── TBA API ──────────────────────────────────────────────────────────────────
async function tbaFetch(path) {
  const res = await fetch(`${TBA_BASE}${path}`, {
    headers: { "X-TBA-Auth-Key": TBA_API_KEY },
  });
  if (!res.ok) throw new Error(`TBA error: ${res.status}`);
  return res.json();
}

async function getOntarioEvents(year = CURRENT_YEAR) {
  const events = await tbaFetch(`/events/${year}`);
  return events
    .filter(e => e.state_prov === "Ontario" && e.event_type <= 6)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
}

async function getEventTeams(eventKey) {
  const teams = await tbaFetch(`/event/${eventKey}/teams`);
  return teams
    .map(t => ({ number: t.team_number, name: t.nickname }))
    .sort((a, b) => a.number - b.number);
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
async function storageGet(key) {
  try {
    const val = localStorage.getItem("shared:" + key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}
async function storageSet(key, val) {
  try { localStorage.setItem("shared:" + key, JSON.stringify(val)); } catch {}
}
async function storageGetPersonal(key) {
  try {
    const val = localStorage.getItem("personal:" + key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}
async function storageSetPersonal(key, val) {
  try { localStorage.setItem("personal:" + key, JSON.stringify(val)); } catch {}
}
// ─── SCORING ──────────────────────────────────────────────────────────────────
function scoreSubmission(prediction, actual) {
  let score = 0;
  for (let a = 0; a < ALLIANCE_COUNT; a++) {
    const pred = (prediction[a] || []).filter(Boolean);
    const act = (actual[a] || []).filter(Boolean);
    const actNums = act.map(t => t.number);
    for (let s = 0; s < pred.length; s++) {
      if (!pred[s]) continue;
      if (actNums.includes(pred[s].number)) {
        score += actNums[s] === pred[s].number ? 3 : 1;
      }
    }
    if (pred[0] && act[0] && pred[0].number === act[0].number) score += 2;
  }
  return score;
}
const MAX_SCORE = ALLIANCE_COUNT * (3 * 3 + 2); // 40

// ─── TINY CSS-IN-JS HELPERS ───────────────────────────────────────────────────
const css = {
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "20px 24px",
  },
  input: {
    width: "100%", boxSizing: "border-box",
    padding: "11px 14px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, color: "#f0f0f0",
    fontSize: 14, outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  },
  btn: (variant = "primary") => ({
    padding: "11px 22px", borderRadius: 8, border: "none",
    cursor: "pointer", fontSize: 13, fontWeight: 700,
    fontFamily: "inherit", letterSpacing: "0.5px",
    transition: "opacity 0.15s, transform 0.1s",
    ...(variant === "primary" ? {
      background: "linear-gradient(135deg, #e8ff47, #b8d400)",
      color: "#0a0a0a",
    } : variant === "ghost" ? {
      background: "rgba(255,255,255,0.06)",
      color: "#ccc",
      border: "1px solid rgba(255,255,255,0.1)",
    } : {
      background: "rgba(232,255,71,0.12)",
      color: "#e8ff47",
      border: "1px solid rgba(232,255,71,0.3)",
    }),
  }),
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#888", fontSize: 13 }}>
      <div style={{
        width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)",
        borderTop: "2px solid #e8ff47", borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      Loading…
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function Tag({ children, color = "#e8ff47" }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      background: color + "18", border: `1px solid ${color}44`,
      color, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    }}>{children}</span>
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!username.trim() || !password.trim()) return setError("Fill in both fields.");
    setLoading(true); setError("");
    const usersRaw = await storageGet("frc:users") || {};

    if (mode === "register") {
      if (usersRaw[username.toLowerCase()]) {
        setError("Username taken."); setLoading(false); return;
      }
      usersRaw[username.toLowerCase()] = { username, password, createdAt: Date.now() };
      await storageSet("frc:users", usersRaw);
      await storageSetPersonal("frc:session", { username });
      onLogin({ username });
    } else {
      const user = usersRaw[username.toLowerCase()];
      if (!user || user.password !== password) {
        setError("Wrong username or password."); setLoading(false); return;
      }
      await storageSetPersonal("frc:session", { username: user.username });
      onLogin({ username: user.username });
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0a0a", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg, #e8ff47, #b8d400)",
            fontSize: 26, marginBottom: 16,
          }}>⚙</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#f0f0f0", letterSpacing: -1 }}>
            Alliance Oracle
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>Ontario FRC Predictions</div>
        </div>

        {/* Toggle */}
        <div style={{
          display: "flex", background: "rgba(255,255,255,0.05)",
          borderRadius: 10, padding: 4, marginBottom: 24,
        }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: "9px", border: "none", borderRadius: 7,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                background: mode === m ? "rgba(232,255,71,0.15)" : "transparent",
                color: mode === m ? "#e8ff47" : "#666",
                transition: "all 0.2s",
              }}>
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            style={css.input} placeholder="Username"
            value={username} onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
          />
          <input
            style={css.input} placeholder="Password" type="password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handle()}
          />
          {error && <div style={{ color: "#ff6b6b", fontSize: 13 }}>{error}</div>}
          <button
            style={{ ...css.btn("primary"), width: "100%", padding: "13px", fontSize: 14, marginTop: 4 }}
            onClick={handle}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            {loading ? "…" : mode === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#444", marginTop: 24 }}>
          ⚠ Demo: passwords stored in plain text — don't reuse real passwords.
        </p>
      </div>
    </div>
  );
}

// ── Home Screen (Event Picker + Global Leaderboards) ──────────────────────────
function HomeScreen({ onSelectEvent, allSubmissions, actual }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [homeTab, setHomeTab] = useState("events");

  useEffect(() => {
    (async () => {
      try {
        const evs = await getOntarioEvents();
        setEvents(evs);
      } catch {
        setError("Couldn't load events. Check your TBA API key.");
      }
      setLoading(false);
    })();
  }, []);

  const formatDate = (d) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

  const homeTabs = [
    { id: "events", label: "🤖 Events" },
    { id: "season", label: `📅 ${CURRENT_YEAR} Season` },
    { id: "alltime", label: "🌟 All-Time" },
  ];

  return (
    <div>
      {/* Home tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10, width: "fit-content" }}>
        {homeTabs.map(t => (
          <button key={t.id} onClick={() => setHomeTab(t.id)} style={{
            padding: "8px 18px", border: "none", borderRadius: 7, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: homeTab === t.id ? "rgba(232,255,71,0.12)" : "transparent",
            color: homeTab === t.id ? "#e8ff47" : "#555",
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      {homeTab === "events" && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0", marginBottom: 4 }}>
            Ontario Events — {CURRENT_YEAR}
          </h2>
          <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>
            Pick an event to make your alliance selection predictions.
          </p>

          {loading && <Spinner />}
          {error && (
            <div style={{ padding: "16px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.3)", borderRadius: 8, color: "#ff6b6b", fontSize: 13 }}>
              {error}
              <br /><br />
              <strong>To fix:</strong> Get a free API key at <a href="https://www.thebluealliance.com/account" target="_blank" style={{ color: "#e8ff47" }}>thebluealliance.com/account</a>, then replace <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 3 }}>YOUR_TBA_API_KEY_HERE</code> at the top of this file.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {events.map(ev => {
              const hasResults = !!actual?.[ev.key];
              const subCount = (allSubmissions[ev.key] || []).length;
              return (
                <div
                  key={ev.key}
                  onClick={() => onSelectEvent(ev)}
                  style={{
                    ...css.card, cursor: "pointer", display: "flex",
                    alignItems: "center", gap: 16,
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "rgba(232,255,71,0.4)";
                    e.currentTarget.style.background = "rgba(232,255,71,0.04)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: "rgba(232,255,71,0.1)", border: "1px solid rgba(232,255,71,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, flexShrink: 0,
                  }}>🤖</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#f0f0f0", fontSize: 15 }}>{ev.name}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                      {ev.city} · {formatDate(ev.start_date)} – {formatDate(ev.end_date)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {subCount > 0 && <Tag color="#888">{subCount} pick{subCount !== 1 ? "s" : ""}</Tag>}
                    {hasResults ? <Tag color="#06d6a0">✓ Scored</Tag> : null}
                  </div>
                  <div style={{ color: "#555", fontSize: 18 }}>›</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {homeTab === "season" && (
        <SeasonLeaderboard allSubmissions={allSubmissions} actual={actual} year={CURRENT_YEAR} />
      )}

      {homeTab === "alltime" && (
        <AllTimeLeaderboard allSubmissions={allSubmissions} actual={actual} />
      )}
    </div>
  );
}

// ── Team Dropdown ─────────────────────────────────────────────────────────────
function TeamDropdown({ team, allTeams, usedTeams, onSelect, label }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = allTeams.filter(t =>
    (!usedTeams.has(t.number) || team?.number === t.number) &&
    (String(t.number).includes(search) || t.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "8px 12px", borderRadius: 7,
          border: `1px solid ${team ? "rgba(232,255,71,0.4)" : "rgba(255,255,255,0.1)"}`,
          background: team ? "rgba(232,255,71,0.06)" : "rgba(255,255,255,0.03)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          minHeight: 38, transition: "border-color 0.2s",
        }}
      >
        {team ? (
          <>
            <span style={{ color: "#e8ff47", fontWeight: 800, fontSize: 13 }}>{team.number}</span>
            <span style={{ color: "#aaa", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
            <button onClick={e => { e.stopPropagation(); onSelect(null); }}
              style={{ background: "none", border: "none", color: "#ff6b6b", cursor: "pointer", fontSize: 15, padding: 0 }}>×</button>
          </>
        ) : (
          <span style={{ color: "#444", fontSize: 12 }}>+ {label}</span>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", zIndex: 200, top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#141414", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
          maxHeight: 220, display: "flex", flexDirection: "column",
        }}>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            style={{
              ...css.input, borderRadius: 0, border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 13,
            }}
          />
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 && <div style={{ padding: "12px 14px", color: "#555", fontSize: 13 }}>No teams found</div>}
            {filtered.map(t => (
              <div key={t.number} onClick={() => { onSelect(t); setOpen(false); setSearch(""); }}
                style={{
                  padding: "9px 14px", cursor: "pointer", fontSize: 13,
                  display: "flex", gap: 10,
                  background: team?.number === t.number ? "rgba(232,255,71,0.08)" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = team?.number === t.number ? "rgba(232,255,71,0.08)" : "transparent"}
              >
                <span style={{ color: "#e8ff47", fontWeight: 700, minWidth: 42 }}>{t.number}</span>
                <span style={{ color: "#aaa" }}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Prediction Form ───────────────────────────────────────────────────────────
function PredictionForm({ event, teams, user, existingPrediction, onSubmit }) {
  const SLOT_LABELS = ["Captain", "Pick 1", "Pick 2"];
  const allianceColors = ["#ff6b35","#ffd166","#06d6a0","#4cc9f0","#a78bfa","#f472b6","#fb923c","#86efac"];

  const [alliances, setAlliances] = useState(
    existingPrediction?.alliances || Array.from({ length: ALLIANCE_COUNT }, () => [null, null, null])
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const usedTeams = new Set(alliances.flat().filter(Boolean).map(t => t.number));
  const totalFilled = alliances.flat().filter(Boolean).length;

  const updateSlot = (ai, si, team) => {
    const copy = alliances.map(a => [...a]);
    copy[ai][si] = team;
    setAlliances(copy);
    setSaved(false);
  };

  const handleSubmit = async () => {
    if (totalFilled < ALLIANCE_COUNT * 3) return alert(`Fill all ${ALLIANCE_COUNT * 3} slots first!`);
    setSaving(true);
    await onSubmit({ alliances, submittedAt: Date.now() });
    setSaved(true);
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0", marginBottom: 4 }}>Your Prediction</h2>
          <div style={{ fontSize: 13, color: "#666" }}>{event.name}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Tag color="#e8ff47">{totalFilled}/{ALLIANCE_COUNT * 3} teams</Tag>
          {saved && <Tag color="#06d6a0">✓ Saved</Tag>}
        </div>
      </div>

      {alliances.map((alliance, ai) => (
        <div key={ai} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: allianceColors[ai] + "22", border: `2px solid ${allianceColors[ai]}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: allianceColors[ai],
            }}>{ai + 1}</div>
            <div style={{ display: "flex", gap: 8, flex: 1 }}>
              {[0, 1, 2].map(si => (
                <TeamDropdown
                  key={si}
                  team={alliance[si] || null}
                  allTeams={teams}
                  usedTeams={usedTeams}
                  label={SLOT_LABELS[si]}
                  onSelect={t => updateSlot(ai, si, t)}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            ...css.btn("primary"), padding: "13px 28px", fontSize: 14,
            opacity: saving ? 0.6 : 1,
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = saving ? "0.6" : "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = saving ? "0.6" : "1"}
        >
          {saving ? "Saving…" : saved ? "✓ Update Prediction" : "🔒 Lock In Prediction"}
        </button>
        <div style={{ fontSize: 12, color: "#555", display: "flex", alignItems: "center" }}>
          You can update your picks until alliance selection begins.
        </div>
      </div>

      {/* Scoring guide */}
      <div style={{ ...css.card, marginTop: 32, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ color: "#666", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>SCORING GUIDE</div>
        {[["Correct team, right slot", "+3 pts"], ["Correct team, wrong slot", "+1 pt"], ["Correct captain", "+2 bonus"]].map(([label, pts]) => (
          <div key={label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "#e8ff47", fontWeight: 800, fontSize: 13 }}>{pts}</span>
            <span style={{ color: "#666", fontSize: 12 }}>{label}</span>
          </div>
        ))}
        <div style={{ color: "#555", fontSize: 12 }}>Max score: {MAX_SCORE} pts</div>
      </div>
    </div>
  );
}

// ── Shared leaderboard row ────────────────────────────────────────────────────
function LeaderboardRow({ rank, username, score, maxScore, subtitle, hasResults }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div style={{
      ...css.card,
      display: "flex", alignItems: "center", gap: 16,
      borderColor: rank === 0 && hasResults ? "rgba(232,255,71,0.25)" : "rgba(255,255,255,0.08)",
      background: rank === 0 && hasResults ? "rgba(232,255,71,0.04)" : "rgba(255,255,255,0.03)",
      transition: "transform 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateX(4px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "translateX(0)"}
    >
      <span style={{ fontSize: rank < 3 && hasResults ? 22 : 14, minWidth: 30, textAlign: "center", color: "#555" }}>
        {rank < 3 && hasResults ? medals[rank] : `#${rank + 1}`}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: "#f0f0f0", fontSize: 14 }}>{username}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {hasResults ? (
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: "#e8ff47" }}>{score}</span>
          {maxScore && <span style={{ fontSize: 11, color: "#555", marginLeft: 4 }}>/ {maxScore}</span>}
          {maxScore && (
            <div style={{ width: 80, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 4 }}>
              <div style={{ height: "100%", width: `${Math.min((score / maxScore) * 100, 100)}%`, background: "linear-gradient(90deg,#e8ff47,#b8d400)", borderRadius: 2 }} />
            </div>
          )}
        </div>
      ) : (
        <span style={{ fontSize: 12, color: "#555" }}>pending</span>
      )}
    </div>
  );
}

// ── Per-Event Leaderboard ─────────────────────────────────────────────────────
function EventLeaderboard({ event, allSubmissions, actual }) {
  const eventKey = event.key;
  const hasResults = !!actual?.[eventKey];
  const subs = (allSubmissions[eventKey] || []).map(s => ({
    ...s,
    score: hasResults ? scoreSubmission(s.alliances, actual[eventKey]) : null,
  })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0", marginBottom: 4 }}>Event Leaderboard</h2>
          <div style={{ fontSize: 13, color: "#666" }}>{event.name}</div>
        </div>
        {hasResults ? <Tag color="#06d6a0">✓ Results in</Tag> : <Tag color="#ffd166">⏳ Awaiting results</Tag>}
      </div>

      {!hasResults && (
        <div style={{ ...css.card, marginBottom: 20, borderColor: "rgba(255,209,102,0.2)", background: "rgba(255,209,102,0.04)" }}>
          <p style={{ color: "#ffd166", fontSize: 13, margin: 0 }}>
            Scores will appear once an admin enters the official alliance selections.
          </p>
        </div>
      )}

      {subs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#444", fontSize: 14 }}>
          No predictions yet for this event.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {subs.map((s, i) => (
            <LeaderboardRow
              key={i} rank={i} username={s.username}
              score={s.score} maxScore={MAX_SCORE}
              subtitle={new Date(s.submittedAt).toLocaleDateString()}
              hasResults={hasResults}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Season Leaderboard ────────────────────────────────────────────────────────
function SeasonLeaderboard({ allSubmissions, actual, year = CURRENT_YEAR }) {
  // Aggregate scores across all events whose key starts with the year
  const userTotals = {};
  const userEventCounts = {};

  for (const [eventKey, subs] of Object.entries(allSubmissions)) {
    if (!eventKey.startsWith(String(year))) continue;
    if (!actual?.[eventKey]) continue; // only scored events count
    for (const s of subs) {
      const score = scoreSubmission(s.alliances, actual[eventKey]);
      userTotals[s.username] = (userTotals[s.username] || 0) + score;
      userEventCounts[s.username] = (userEventCounts[s.username] || 0) + 1;
    }
  }

  const rows = Object.entries(userTotals)
    .map(([username, total]) => ({ username, total, events: userEventCounts[username] }))
    .sort((a, b) => b.total - a.total);

  const scoredEventCount = Object.keys(actual || {}).filter(k => k.startsWith(String(year))).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0", marginBottom: 4 }}>
            {year} Season Leaderboard
          </h2>
          <div style={{ fontSize: 13, color: "#666" }}>
            Cumulative score across all Ontario events · {scoredEventCount} event{scoredEventCount !== 1 ? "s" : ""} scored
          </div>
        </div>
        <Tag color="#4cc9f0">Season {year}</Tag>
      </div>

      {rows.length === 0 ? (
        <div style={{ ...css.card, textAlign: "center", padding: "48px 20px", color: "#444", fontSize: 14 }}>
          No scored events yet this season. Check back after an event's alliance selection!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => (
            <LeaderboardRow
              key={r.username} rank={i} username={r.username}
              score={r.total} maxScore={null}
              subtitle={`${r.events} event${r.events !== 1 ? "s" : ""} · avg ${Math.round(r.total / r.events)} pts`}
              hasResults={true}
            />
          ))}
        </div>
      )}

      <div style={{ ...css.card, marginTop: 28, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#555", fontWeight: 700, letterSpacing: 1 }}>HOW IT WORKS</span>
        <span style={{ fontSize: 12, color: "#666" }}>Raw scores from each event are added together. More events = more chances to earn points.</span>
      </div>
    </div>
  );
}

// ── All-Time Leaderboard ──────────────────────────────────────────────────────
function AllTimeLeaderboard({ allSubmissions, actual }) {
  const userStats = {};

  for (const [eventKey, subs] of Object.entries(allSubmissions)) {
    if (!actual?.[eventKey]) continue;
    const year = eventKey.match(/^(\d{4})/)?.[1];
    for (const s of subs) {
      const score = scoreSubmission(s.alliances, actual[eventKey]);
      if (!userStats[s.username]) {
        userStats[s.username] = { total: 0, events: 0, best: 0, bestEvent: "", seasons: new Set() };
      }
      userStats[s.username].total += score;
      userStats[s.username].events += 1;
      if (score > userStats[s.username].best) {
        userStats[s.username].best = score;
        userStats[s.username].bestEvent = eventKey;
      }
      if (year) userStats[s.username].seasons.add(year);
    }
  }

  const rows = Object.entries(userStats)
    .map(([username, s]) => ({ username, ...s, seasons: s.seasons.size, avg: Math.round(s.total / s.events) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f0f0f0", marginBottom: 4 }}>All-Time Leaderboard</h2>
          <div style={{ fontSize: 13, color: "#666" }}>Total points across every season & event, ever</div>
        </div>
        <Tag color="#a78bfa">All Time</Tag>
      </div>

      {rows.length === 0 ? (
        <div style={{ ...css.card, textAlign: "center", padding: "48px 20px", color: "#444", fontSize: 14 }}>
          No scored events yet. Check back after results are entered!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => (
            <LeaderboardRow
              key={r.username} rank={i} username={r.username}
              score={r.total} maxScore={null}
              subtitle={`${r.events} event${r.events !== 1 ? "s" : ""} across ${r.seasons} season${r.seasons !== 1 ? "s" : ""} · best: ${r.best} pts · avg: ${r.avg} pts`}
              hasResults={true}
            />
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ ...css.card, marginTop: 28 }}>
          <div style={{ fontSize: 12, color: "#555", fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>HALL OF FAME</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              ["🏆 Most Points", rows[0]?.username, rows[0]?.total + " pts"],
              ["🎯 Best Avg", [...rows].sort((a,b) => b.avg - a.avg)[0]?.username, [...rows].sort((a,b) => b.avg - a.avg)[0]?.avg + " avg"],
              ["📅 Most Events", [...rows].sort((a,b) => b.events - a.events)[0]?.username, [...rows].sort((a,b) => b.events - a.events)[0]?.events + " events"],
            ].map(([label, name, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 800, color: "#f0f0f0", fontSize: 14 }}>{name}</div>
                <div style={{ fontSize: 12, color: "#e8ff47" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({ event, teams, actual, onSaveActual, allSubmissions }) {
  const eventKey = event.key;
  const [alliances, setAlliances] = useState(
    actual?.[eventKey] || Array.from({ length: ALLIANCE_COUNT }, () => [null, null, null])
  );
  const [saved, setSaved] = useState(!!actual?.[eventKey]);
  const usedTeams = new Set(alliances.flat().filter(Boolean).map(t => t.number));
  const SLOT_LABELS = ["Captain", "Pick 1", "Pick 2"];
  const allianceColors = ["#ff6b35","#ffd166","#06d6a0","#4cc9f0","#a78bfa","#f472b6","#fb923c","#86efac"];

  return (
    <div>
      <div style={{ ...css.card, borderColor: "rgba(255,209,102,0.2)", background: "rgba(255,209,102,0.04)", marginBottom: 24 }}>
        <p style={{ color: "#ffd166", margin: 0, fontSize: 13 }}>
          ⚙ <strong>Admin:</strong> Enter the official alliance selections to score all predictions.
        </p>
      </div>

      {alliances.map((alliance, ai) => (
        <div key={ai} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: allianceColors[ai] + "22", border: `2px solid ${allianceColors[ai]}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: allianceColors[ai],
            }}>{ai + 1}</div>
            <div style={{ display: "flex", gap: 8, flex: 1 }}>
              {[0, 1, 2].map(si => (
                <TeamDropdown
                  key={si}
                  team={alliance[si] || null}
                  allTeams={teams}
                  usedTeams={usedTeams}
                  label={SLOT_LABELS[si]}
                  onSelect={t => {
                    const copy = alliances.map(a => [...a]);
                    copy[ai][si] = t;
                    setAlliances(copy);
                    setSaved(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={async () => { await onSaveActual(eventKey, alliances); setSaved(true); }}
        style={{ ...css.btn(saved ? "outline" : "primary"), marginTop: 20, padding: "13px 28px" }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        {saved ? "✓ Results Saved" : "Save Official Results"}
      </button>

      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 12, color: "#555", letterSpacing: 1, marginBottom: 12 }}>
          {(allSubmissions[eventKey] || []).length} SUBMISSIONS
        </div>
        {(allSubmissions[eventKey] || []).map((s, i) => (
          <div key={i} style={{ ...css.card, marginBottom: 8, display: "flex", justifyContent: "space-between", padding: "10px 16px" }}>
            <span style={{ fontWeight: 700, color: "#f0f0f0", fontSize: 13 }}>{s.username}</span>
            <span style={{ color: "#555", fontSize: 12 }}>{new Date(s.submittedAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "frc2024"; // Change this!

export default function App() {
  const [user, setUser] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("predict");
  const [allSubmissions, setAllSubmissions] = useState({});
  const [actual, setActual] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);

  // Restore session
  useEffect(() => {
    (async () => {
      const session = await storageGetPersonal("frc:session");
      if (session?.username) setUser(session);
      const subs = await storageGet("frc:submissions") || {};
      const act = await storageGet("frc:actual") || {};
      setAllSubmissions(subs);
      setActual(act);
      setSessionLoaded(true);
    })();
  }, []);

  // Load teams when event selected
  useEffect(() => {
    if (!selectedEvent) return;
    setTeams([]);
    setTeamsLoading(true);
    getEventTeams(selectedEvent.key)
      .then(t => setTeams(t))
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
  }, [selectedEvent]);

  const handleSubmitPrediction = async ({ alliances, submittedAt }) => {
    const key = selectedEvent.key;
    const existing = (allSubmissions[key] || []).filter(s => s.username !== user.username);
    const updated = { ...allSubmissions, [key]: [...existing, { username: user.username, alliances, submittedAt }] };
    setAllSubmissions(updated);
    await storageSet("frc:submissions", updated);
  };

  const handleSaveActual = async (eventKey, alliances) => {
    const updated = { ...actual, [eventKey]: alliances };
    setActual(updated);
    await storageSet("frc:actual", updated);
  };

  const handleLogout = async () => {
    await storageSetPersonal("frc:session", null);
    setUser(null); setSelectedEvent(null); setIsAdmin(false);
  };

  const myPrediction = selectedEvent
    ? (allSubmissions[selectedEvent.key] || []).find(s => s.username === user?.username)
    : null;

  if (!sessionLoaded) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8ff47", fontFamily: "system-ui" }}>
      <Spinner />
    </div>
  );

  if (!user) return <AuthScreen onLogin={setUser} />;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800;900&display=swap" rel="stylesheet" />

      {/* Nav */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(10,10,10,0.9)", backdropFilter: "blur(12px)",
        padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 56,
      }}>
        <button onClick={() => setSelectedEvent(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#e8ff47,#b8d400)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚙</div>
          <span style={{ fontWeight: 900, fontSize: 15, color: "#f0f0f0" }}>Alliance Oracle</span>
        </button>

        {selectedEvent && (
          <>
            <span style={{ color: "#333" }}>›</span>
            <span style={{ fontSize: 13, color: "#888", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedEvent.name}</span>
          </>
        )}

        <div style={{ flex: 1 }} />

        {selectedEvent && !isAdmin && (
          <button
            onClick={() => {
              const pw = prompt("Admin password:");
              if (pw === ADMIN_PASSWORD) setIsAdmin(true);
              else if (pw !== null) alert("Wrong password.");
            }}
            style={{ ...css.btn("ghost"), fontSize: 12, padding: "6px 12px" }}
          >⚙ Admin</button>
        )}
        {isAdmin && <Tag color="#ffd166">ADMIN</Tag>}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#666" }}>{user.username}</span>
          <button onClick={handleLogout} style={{ ...css.btn("ghost"), fontSize: 12, padding: "6px 12px" }}>Sign out</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px 80px" }}>
        {!selectedEvent ? (
          <HomeScreen
            onSelectEvent={setSelectedEvent}
            allSubmissions={allSubmissions}
            actual={actual}
          />
        ) : (
          <>
            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 32, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 10, width: "fit-content", flexWrap: "wrap" }}>
              {[
                { id: "predict", label: "📋 Predict" },
                { id: "leaderboard", label: "🏆 Event Board" },
                ...(isAdmin ? [{ id: "admin", label: "⚙ Admin" }] : []),
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding: "8px 18px", border: "none", borderRadius: 7, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  background: activeTab === t.id ? (t.id === "admin" ? "rgba(255,209,102,0.15)" : "rgba(232,255,71,0.12)") : "transparent",
                  color: activeTab === t.id ? (t.id === "admin" ? "#ffd166" : "#e8ff47") : "#555",
                  transition: "all 0.15s",
                }}>{t.label}</button>
              ))}
            </div>

            {teamsLoading && <Spinner />}

            {!teamsLoading && activeTab === "predict" && (
              <PredictionForm
                event={selectedEvent}
                teams={teams}
                user={user}
                existingPrediction={myPrediction}
                onSubmit={handleSubmitPrediction}
              />
            )}
            {!teamsLoading && activeTab === "leaderboard" && (
              <EventLeaderboard event={selectedEvent} allSubmissions={allSubmissions} actual={actual} />
            )}
            {!teamsLoading && activeTab === "admin" && isAdmin && (
              <AdminPanel
                event={selectedEvent}
                teams={teams}
                actual={actual}
                onSaveActual={handleSaveActual}
                allSubmissions={allSubmissions}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}