import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const STORAGE_KEY = "kuzure_logs_v5";
const RECOVERY_ORDER_KEY = "kuzure_recovery_order";
const PERIOD_KEY = "kuzure_period_tracking";
const ACTIONS_ORDER_KEY = "kuzure_actions_order";
const MOTIVES_ORDER_KEY = "kuzure_motives_order_v2";
const EVENTS_ORDER_KEY = "kuzure_events_order";

const SLEEP_LABELS = ["", "最悪", "悪ぁE, "まあまぁE, "良ぁE, "ぐっすり"];
const FATIGUE_LABELS = ["", "限界", "めE��疲めE, "ふつぁE, "めE��允E��E, "允E��E];
const EVENTS_DEFAULT = ["バイチE, "授業", "友達", "勉強", "運動", "特になぁE];
const ACTIONS_DEFAULT = ["爁E��い", "スマ�E延、E, "そ�Eまま寝落ち"];
const MOTIVES_DEFAULT = ["だるい", "そわそわ", "しんどぁE, "何もしたくなぁE, "めんどくさぁE, "わかんなぁE];
const RECOVERY_DEFAULT = ["入浴", "運動", "音楽を�EぁE, "友達と話ぁE, "外�E"];

// ── SVG face icons ───────────────────────────────────────
// Sleep: 1=wide awake/wired, 2=tired, 3=neutral, 4=relaxed, 5=deeply asleep
const SleepFace = ({ level, color }) => {
  const faces = {
    1: ( // wired, can't sleep - eyes wide open with stress lines
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <circle cx="11" cy="13" r="2.5" fill={color}/>
        <circle cx="21" cy="13" r="2.5" fill={color}/>
        <path d="M10 21 Q16 18 22 21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 9 L10 11M24 9 L22 11" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M13 9 L11 7M19 9 L21 7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    2: ( // tired, droopy eyes
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <path d="M9 12 Q11 10 13 12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M19 12 Q21 10 23 12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <ellipse cx="11" cy="13" rx="2" ry="1.2" fill={color}/>
        <ellipse cx="21" cy="13" rx="2" ry="1.2" fill={color}/>
        <path d="M12 21 Q16 19 20 21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    3: ( // neutral
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <circle cx="11" cy="13" r="1.8" fill={color}/>
        <circle cx="21" cy="13" r="1.8" fill={color}/>
        <path d="M12 21 L20 21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    4: ( // relaxed, eyes slightly closed
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <path d="M9 13 Q11 15 13 13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M19 13 Q21 15 23 13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 20 Q16 23 20 20" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    5: ( // deeply asleep, eyes shut, zzz
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <path d="M9 13 Q11 11 13 13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M19 13 Q21 11 23 13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M12 20 Q16 23 20 20" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <text x="23" y="10" fontSize="7" fill={color} fontWeight="700">z</text>
        <text x="26" y="7" fontSize="5" fill={color} fontWeight="700">z</text>
      </svg>
    ),
  };
  return faces[level] || null;
};

// Fatigue: 1=exhausted, 2=tired, 3=neutral, 4=fine, 5=energetic (right=good)
const FatigueFace = ({ level, color }) => {
  const faces = {
    5: ( // bright and energetic
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <circle cx="11" cy="13" r="2" fill={color}/>
        <circle cx="21" cy="13" r="2" fill={color}/>
        <circle cx="12" cy="12" r="0.8" fill="#fff"/>
        <circle cx="22" cy="12" r="0.8" fill="#fff"/>
        <path d="M11 20 Q16 24 21 20" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M22 8 L24 6M25 10 L27 9" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    4: ( // slightly tired but okay
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <circle cx="11" cy="13" r="1.8" fill={color}/>
        <circle cx="21" cy="13" r="1.8" fill={color}/>
        <path d="M12 20 Q16 22 20 20" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    3: ( // neutral
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <circle cx="11" cy="13" r="1.8" fill={color}/>
        <circle cx="21" cy="13" r="1.8" fill={color}/>
        <path d="M12 21 L20 21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    2: ( // tired, heavy eyes
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <path d="M9 12 Q11 10 13 12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M19 12 Q21 10 23 12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <ellipse cx="11" cy="13" rx="2" ry="1.3" fill={color}/>
        <ellipse cx="21" cy="13" rx="2" ry="1.3" fill={color}/>
        <path d="M12 21 Q16 19 20 21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    1: ( // completely exhausted, X eyes
      <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5"/>
        <path d="M9 11 L13 15M13 11 L9 15" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M19 11 L23 15M23 11 L19 15" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M11 22 Q16 19 21 22" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14 26 Q16 28 18 26" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  };
  return faces[level] || null;
};

// ── styles ───────────────────────────────────────────────
const S = {
  wrap: { fontFamily: "'Hiragino Sans', sans-serif", maxWidth: 420, margin: "0 auto", padding: "24px 16px 40px", background: "#f5f3ef", minHeight: "100vh", color: "#1a1a1a" },
  heading: { fontSize: 22, fontWeight: 800, margin: "0 0 2px", color: "#1a1a1a", letterSpacing: "-0.5px" },
  sub: { fontSize: 12, color: "#b0a898", margin: "0 0 24px" },
  tabs: { display: "flex", background: "#e8e4dc", borderRadius: 14, padding: 3, marginBottom: 24 },
  tab: (a) => ({ flex: 1, padding: "9px 0", fontSize: 13, fontWeight: a ? 700 : 400, border: "none", borderRadius: 11, background: a ? "#fff" : "transparent", color: a ? "#1a1a1a" : "#9a9080", cursor: "pointer", transition: "all 0.15s", boxShadow: a ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }),
  secWrap: { marginBottom: 28 },
  secHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  secBar: (c) => ({ width: 3, height: 16, borderRadius: 2, background: c, flexShrink: 0 }),
  secLabel: { fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase" },
  faceGrid: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 },
  faceBtn: (a, c) => ({ padding: "10px 0 8px", border: a ? `1.5px solid ${c}` : "1.5px solid #e4e0d8", borderRadius: 12, background: a ? c + "18" : "#fff", cursor: "pointer", textAlign: "center", transition: "all 0.1s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }),
  faceLbl: (a, c) => ({ fontSize: 9, color: a ? c : "#ccc", fontWeight: a ? 700 : 400 }),
  pillGrid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 },
  pill: (a, c = "#5a35c8") => ({ padding: "11px 8px", border: a ? `1.5px solid ${c}` : "1.5px solid #e4e0d8", borderRadius: 12, background: a ? c + "15" : "#fff", color: a ? c : "#888", fontWeight: a ? 600 : 400, fontSize: 13, cursor: "pointer", textAlign: "center", transition: "all 0.1s" }),
  ynGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 },
  ynBtn: (a, c) => ({ padding: "14px 8px", border: a ? `2px solid ${c}` : "1.5px solid #e4e0d8", borderRadius: 14, background: a ? c + "12" : "#fff", color: a ? c : "#999", fontWeight: a ? 700 : 400, fontSize: 15, cursor: "pointer", textAlign: "center", transition: "all 0.1s" }),
  divider: { height: 1, background: "#ebe7df", margin: "20px 0" },
  textarea: { width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#faf9f7", color: "#1a1a1a", resize: "none", lineHeight: 1.6, outline: "none", marginTop: 4 },
  saveBtn: { width: "100%", padding: 15, fontSize: 15, fontWeight: 700, border: "none", borderRadius: 14, background: "#1a1a1a", color: "#fff", cursor: "pointer", marginTop: 8 },
  savedMsg: { textAlign: "center", fontSize: 13, color: "#5a35c8", marginTop: 10 },
  alreadyBox: { background: "#f0ecff", border: "1.5px solid #d6ccf5", borderRadius: 14, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#6b4fd8" },
  logCard: { background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 16, padding: "14px 16px", marginBottom: 10 },
  tag: (bg, c) => ({ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: bg, color: c, fontWeight: 600, display: "inline-block", margin: "2px" }),
  patternBox: { background: "#f0ecff", border: "1.5px solid #d6ccf5", borderRadius: 16, padding: "16px", marginTop: 8 },
};

// ── drag-sortable recovery ───────────────────────────────
function RecoveryManager({ items, setItems, selected, onToggle, onDelete, activeColor = "#1a6030" }) {
  const dragIdx = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const onDragStart = (i) => { dragIdx.current = i; };
  const onDragEnter = (i) => setDragOver(i);
  const onDragEnd = () => {
    if (dragIdx.current !== null && dragOver !== null && dragIdx.current !== dragOver) {
      const next = [...items];
      const [m] = next.splice(dragIdx.current, 1);
      next.splice(dragOver, 0, m);
      setItems(next);
    }
    dragIdx.current = null; setDragOver(null);
  };

  return (
    <>
      <div style={S.pillGrid}>
        {items.map((r, i) => (
          <div key={r} draggable onDragStart={() => onDragStart(i)} onDragEnter={() => onDragEnter(i)} onDragEnd={onDragEnd} onDragOver={(e) => e.preventDefault()} style={{ position: "relative", opacity: dragOver === i ? 0.5 : 1, cursor: "grab" }}>
            <button onClick={() => onToggle(r)} style={{ ...S.pill(selected.includes(r), activeColor), width: "100%", paddingRight: 22 }}>{r}</button>
            <span onClick={(e) => { e.stopPropagation(); setPendingDelete(r); }} style={{ position: "absolute", top: 4, right: 7, fontSize: 14, color: "#ccc", cursor: "pointer", fontWeight: 700 }}>ÁE/span>
          </div>
        ))}
      </div>
      {pendingDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "24px 20px", maxWidth: 300, width: "100%", textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>削除しますか�E�E/p>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>「{pendingDelete}」を削除しまぁE/p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => setPendingDelete(null)} style={{ padding: "12px", fontSize: 14, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>キャンセル</button>
              <button onClick={() => { onDelete(pendingDelete); setPendingDelete(null); }} style={{ padding: "12px", fontSize: 14, border: "none", borderRadius: 12, background: "#c02020", color: "#fff", fontWeight: 700, cursor: "pointer" }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TypeCard({ code, t, onSelect }) {
  return (
    <div onClick={() => onSelect(code, t)} style={{ background: "#ffffff", border: `1.5px solid ${t.color}66`, borderRadius: 14, padding: "14px 12px", cursor: "pointer" }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: t.color, margin: "0 0 2px", fontFamily: "monospace" }}>{code}</p>
      <p style={{ fontSize: 22, margin: "0 0 4px" }}>{t.emoji}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px", lineHeight: 1.3 }}>{t.name}</p>
      <p style={{ fontSize: 10, color: "#888", margin: 0, lineHeight: 1.5 }}>{t.jp}</p>
    </div>
  );
}

// ── main ────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("record");
  const [logs, setLogs] = useState([]);
  const [sleep, setSleep] = useState(null);
  const [fatigue, setFatigue] = useState(null);
  const [events, setEvents] = useState([]);
  const [kuzure, setKuzure] = useState(null);
  const [actions, setActions] = useState([]);
  const [motives, setMotives] = useState([]);
  const [memo, setMemo] = useState("");
  const [otherEvent, setOtherEvent] = useState("");
  const [eventMemo, setEventMemo] = useState("");
  const [recovery, setRecovery] = useState([]);
  const [recoveryItems, setRecoveryItems] = useState(RECOVERY_DEFAULT);
  const [eventItems, setEventItems] = useState(EVENTS_DEFAULT);
  const [actionItems, setActionItems] = useState(ACTIONS_DEFAULT);
  const [motiveItems, setMotiveItems] = useState(MOTIVES_DEFAULT);
  const [newEventInput, setNewEventInput] = useState("");
  const [newRecoveryInput, setNewRecoveryInput] = useState("");
  const [newActionInput, setNewActionInput] = useState("");
  const [newMotiveInput, setNewMotiveInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [alreadyLogged, setAlreadyLogged] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [trackPeriod, setTrackPeriod] = useState(false);
  const [isPeriod, setIsPeriod] = useState(false);
  const [periodDates, setPeriodDates] = useState([]);
  const [showOptional, setShowOptional] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingLog, setEditingLog] = useState(null); // the log entry being edited // { label, onConfirm }
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) loadUserData(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadUserData(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    try {
      // Load logs from Supabase
      const { data: logsData } = await supabase
        .from("logs")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });
      if (logsData) {
        const mapped = logsData.map(l => ({
          date: l.date, sleep: l.sleep, fatigue: l.fatigue,
          events: l.events || [], kuzure: l.kuzure,
          actions: l.actions || [], motives: l.motives || [],
          memo: l.memo || "", recovery: l.recovery || [],
          isPeriod: l.is_period, eventMemo: l.event_memo || "",
          id: l.id,
        }));
        setLogs(mapped);
        if (mapped.length > 0 && mapped[0].date === todayStr()) setAlreadyLogged(true);
      }
      // Load settings from localStorage
      try {
        const orderRaw = localStorage.getItem(RECOVERY_ORDER_KEY);
        if (orderRaw) setRecoveryItems(JSON.parse(orderRaw));
        const evOrderRaw = localStorage.getItem(EVENTS_ORDER_KEY);
        if (evOrderRaw) setEventItems(JSON.parse(evOrderRaw));
        const actOrderRaw = localStorage.getItem(ACTIONS_ORDER_KEY);
        if (actOrderRaw) setActionItems(JSON.parse(actOrderRaw));
        const motOrderRaw = localStorage.getItem(MOTIVES_ORDER_KEY);
        if (motOrderRaw) setMotiveItems(JSON.parse(motOrderRaw));
        const savedType = localStorage.getItem("kuzure_recovery_type");
        if (savedType && RECOVERY_TYPES[savedType]) setRecoveryTypeFull(RECOVERY_TYPES[savedType]);
        const periodRaw = localStorage.getItem(PERIOD_KEY);
        if (periodRaw) {
          const pd = JSON.parse(periodRaw);
          setTrackPeriod(pd.track || false);
          setPeriodDates(pd.dates || []);
        }
      } catch {}
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    try { localStorage.setItem(RECOVERY_ORDER_KEY, JSON.stringify(recoveryItems)); } catch {}
  }, [recoveryItems]);

  useEffect(() => {
    try { localStorage.setItem(PERIOD_KEY, JSON.stringify({ track: trackPeriod, dates: periodDates })); } catch {}
  }, [trackPeriod, periodDates]);

  useEffect(() => {
    try { localStorage.setItem(EVENTS_ORDER_KEY, JSON.stringify(eventItems)); } catch {}
  }, [eventItems]);

  useEffect(() => {
    try { localStorage.setItem(ACTIONS_ORDER_KEY, JSON.stringify(actionItems)); } catch {}
  }, [actionItems]);

  useEffect(() => {
    try { localStorage.setItem(MOTIVES_ORDER_KEY, JSON.stringify(motiveItems)); } catch {}
  }, [motiveItems]);

  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`; };
  const saveLogs = async (nl) => {
    setLogs(nl);
    // Also save to localStorage as backup
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nl)); } catch {}
  };
  const toggleEvent = (ev) => {
    if (ev === "特になぁE) { setEvents(["特になぁE]); return; }
    setEvents((p) => { const w = p.filter((e) => e !== "特になぁE); return w.includes(ev) ? w.filter((e) => e !== ev) : [...w, ev]; });
  };

  const openEdit = (entry) => {
    setSleep(entry.sleep);
    setFatigue(entry.fatigue);
    setEvents(entry.events || []);
    setKuzure(entry.kuzure);
    setActions(entry.actions || []);
    setMotives(entry.motives || []);
    setMemo(entry.memo || "");
    setOtherEvent(entry.otherEvent || "");
    setRecovery(entry.recovery || []);
    setIsPeriod(entry.isPeriod || false);
    setSelectedDate(entry.date);
    setEditingLog(entry);
    setTab("record");
    window.scrollTo(0, 0);
  };

  const addEvent = () => {
    const v = newEventInput.trim();
    if (v && !eventItems.includes(v)) setEventItems((p) => [...p, v]);
    setNewEventInput("");
  };

  const deleteEvent = (ev) => {
    setEventItems((p) => p.filter((x) => x !== ev));
    setEvents((p) => p.filter((x) => x !== ev));
  };
  const toggleMulti = (arr, setArr, val) => setArr((p) => p.includes(val) ? p.filter((v) => v !== val) : [...p, val]);

  const handleSave = async () => {
    if (!sleep || !fatigue || events.length === 0 || kuzure === null) { alert("全頁E��を選んでください"); return; }
    const dateToSave = selectedDate || todayStr();
    const entry = { date: dateToSave, sleep, fatigue, events, kuzure, actions, motives, memo, otherEvent, recovery, isPeriod: trackPeriod ? isPeriod : null, eventMemo };
    if (trackPeriod && isPeriod) setPeriodDates((p) => p.includes(dateToSave) ? p : [...p, dateToSave]);
    
    // Save to Supabase if logged in
    if (user) {
      const dbEntry = {
        user_id: user.id, date: dateToSave, sleep, fatigue,
        events, kuzure, actions, motives, memo,
        recovery, is_period: trackPeriod ? isPeriod : null, event_memo: eventMemo,
      };
      const existingLog = logs.find(l => l.date === dateToSave);
      if (existingLog?.id) {
        await supabase.from("logs").update(dbEntry).eq("id", existingLog.id);
      } else {
        await supabase.from("logs").insert(dbEntry);
      }
      // Reload logs from Supabase only
      await loadUserData(user.id);
    } else {
      const newLogs = [entry, ...logs.filter(l => l.date !== dateToSave)];
      newLogs.sort((a, b) => new Date(b.date.replace(/\//g,"-")) - new Date(a.date.replace(/\//g,"-")));
      saveLogs(newLogs);
    }
    setSleep(null); setFatigue(null); setEvents([]); setKuzure(null);
    setActions([]); setMotives([]); setMemo(""); setOtherEvent(""); setRecovery([]); setIsPeriod(false); setEventMemo("");
    if (dateToSave === todayStr()) setAlreadyLogged(true);
    setEditingLog(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addAction = () => {
    const v = newActionInput.trim();
    if (v && !actionItems.includes(v)) setActionItems((p) => [...p, v]);
    setNewActionInput("");
  };
  const deleteAction = (a) => {
    setActionItems((p) => p.filter((x) => x !== a));
    setActions((p) => p.filter((x) => x !== a));
  };
  const addMotive = () => {
    const v = newMotiveInput.trim();
    if (v && !motiveItems.includes(v)) setMotiveItems((p) => [...p, v]);
    setNewMotiveInput("");
  };
  const deleteMotive = (m) => {
    setMotiveItems((p) => p.filter((x) => x !== m));
    setMotives((p) => p.filter((x) => x !== m));
  };
  const addRecovery = () => {
    const v = newRecoveryInput.trim();
    if (v && !recoveryItems.includes(v)) setRecoveryItems((p) => [...p, v]);
    setNewRecoveryInput("");
  };

  const deleteLog = async (date) => {
    if (user) {
      const log = logs.find(l => l.date === date);
      if (log?.id) await supabase.from("logs").delete().eq("id", log.id);
      await loadUserData(user.id);
    } else {
      const newLogs = logs.filter(l => l.date !== date);
      saveLogs(newLogs);
    }
    setConfirmDelete(null);
  };

  const deleteRecovery = (r) => {
    setRecoveryItems((p) => p.filter((x) => x !== r));
    setRecovery((p) => p.filter((x) => x !== r));
  };

  const analyzePattern = () => {
    if (logs.length < 3) return `あと${3 - logs.length}日記録するとパターンが見えてきます`;
    const kl = logs.filter((l) => l.kuzure);
    const okl = logs.filter((l) => !l.kuzure);
    if (!kl.length) return "記録した期間では崩れなし。このまま続けましょぁE��E;
    const total = logs.length;
    const lines = [];

    // イベント�E析：崩れた日での出現玁Evs 全体での出現玁E��比輁E
    const allEvents = {};
    logs.forEach((l) => (l.events||[]).forEach((e) => { allEvents[e] = (allEvents[e]||0)+1; }));
    const kuzureEvents = {};
    kl.forEach((l) => (l.events||[]).forEach((e) => { kuzureEvents[e] = (kuzureEvents[e]||0)+1; }));
    
    let topEvent = null, topRatio = 0;
    Object.keys(kuzureEvents).forEach((e) => {
      if (e === "特になぁE) return;
      const overallRate = (allEvents[e]||0) / total;
      const kuzureRate = kuzureEvents[e] / kl.length;
      // 全体�E70%以上で出現する頁E��は除夁E
      if (overallRate >= 0.7) return;
      const ratio = overallRate > 0 ? kuzureRate / overallRate : 0;
      if (ratio > topRatio && kuzureEvents[e] >= 2) { topRatio = ratio; topEvent = e; }
    });
    if (topEvent && topRatio >= 1.3) {
      const pct = Math.round((topRatio - 1) * 100);
      lines.push(`、E{topEvent}」がある日は崩れやすい傾向があります（崩れなぁE��より${pct}%多い�E�。`);
    }

    // 疲労度�E�崩れた日 vs 崩れなかった日の平坁E��比輁E
    if (kl.length >= 2 && okl.length >= 2) {
      const kAvg = kl.reduce((s,l)=>s+l.fatigue,0)/kl.length;
      const okAvg = okl.reduce((s,l)=>s+l.fatigue,0)/okl.length;
      const diff = kAvg - okAvg;
      if (Math.abs(diff) >= 0.8) {
        const kLabel = FATIGUE_LABELS[Math.round(kAvg)];
        const okLabel = FATIGUE_LABELS[Math.round(okAvg)];
        if (diff < 0) {
          lines.push(`崩れた日の朝�E、E{kLabel}」寁E��、崩れなかった日は、E{okLabel}」寁E��。疲れと崩れに関係がありそうです。`);
        } else {
          lines.push(`崩れた日の方が朝の疲労が少なぁE��向があります。疲れてぁE��ぁE��の気�E緩みに注意かも。`);
        }
      }
    }

    // 気持ち刁E���E�崩れた日だけに多く出る気持ち
    if (kl.length >= 2) {
      const mCount = {};
      kl.forEach((l) => (l.motives||[]).forEach((m) => { mCount[m]=(mCount[m]||0)+1; }));
      const topMotive = Object.keys(mCount).sort((a,b)=>mCount[b]-mCount[a])[0];
      if (topMotive && mCount[topMotive] >= 2) {
        lines.push(`崩れた日に、E{topMotive}」とぁE��気持ちになることが多いです。`);
      }
    }

    // 試したこと刁E���E�崩れなかった日に多く出るもの�E��E体�E70%未満のも�Eのみ�E�E
    if (okl.length >= 2) {
      const rCount = {};
      okl.forEach((l) => (l.recovery||[]).forEach((r) => { rCount[r]=(rCount[r]||0)+1; }));
      const allRCount = {};
      logs.forEach((l) => (l.recovery||[]).forEach((r) => { allRCount[r]=(allRCount[r]||0)+1; }));
      
      let topRecovery = null, topRecoveryCount = 0;
      Object.keys(rCount).forEach((r) => {
        const overallRate = (allRCount[r]||0) / total;
        if (overallRate >= 0.7) return;
        if (rCount[r] > topRecoveryCount) { topRecoveryCount = rCount[r]; topRecovery = r; }
      });
      if (topRecovery && topRecoveryCount >= 2) {
        lines.push(`、E{topRecovery}」をした日は崩れにくい傾向があります。`);
      }
    }

    return lines.join("\n") || "まだチE�Eタが少なくてパターンが見えてぁE��せん。もぁE��し続けてみましょぁE��E;
  };

  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  const runAiAnalysis = async () => {
    if (logs.length < 3) return;
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const summary = logs.slice(0, 14).map((l) => ({
        日仁E l.date,
        睡眠満足度: SLEEP_LABELS[l.sleep],
        疲労愁E FATIGUE_LABELS[l.fatigue],
        イベンチE (l.events||[]).join("・"),
        イベントメモ: l.eventMemo || "",
        崩めE l.kuzure ? "あり" : "なぁE,
        崩れ行動: (l.actions||[]).join("・"),
        気持ち: (l.motives||[]).join("・"),
        試したこと: (l.recovery||[]).join("・"),
        メモ: l.memo || "",
      }));

      const res = await fetch("/api/analyze.cjs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `以下�E私�E日、E�E崩れログです、E

重要E��E
- 日付やイベントを使って具体的に書ぁE��ください
- 崩れた日と崩れなかった日の違いに注目してください
- 疲労感�E「�E気�EめE��允E���EふつぁE�EめE��疲れ�E限界」�E頁E��悪化しまぁE
- 睡眠満足度は「最悪→悪ぁE�Eまあまあ�E良ぁE�Eぐっすり」�E頁E��良くなりまぁE
- まず一番重要な気づきを1斁E��書ぁE��ください�E�EUMMARY:から始めて�E�E
- そ�E後、詳細な気づきを3つ箁E��書きで書ぁE��ください�E�EETAIL:から始めて�E�E

チE�Eタ�E�E
${JSON.stringify(summary, null, 2)}`
          }]
        })
      });
      const data = await res.json();
      const text = (data.content||[]).map((c) => c.text||"").join("");
      setAiAnalysis(text);
    } catch (e) {
      setAiAnalysis("刁E��に失敗しました。もぁE��度試してください、E);
    }
    setAiLoading(false);
  };

  const RECOVERY_TYPES = {
    "PESA": { emoji: "🐺", name: "疾走オオカチE, jp: "身体×蓄積×独×動", color: "#5a35c8", desc: "体�E疲れが溜まるほど崩れやすくなる。疲れてぁE��も「まだぁE��る」と思ってしまぁE��ち。崩れたあとはひとりで体を動かすことでリセチE��できる。じっとしてぁE��より動いた方が回復できる、E },
    "PESQ": { emoji: "🐻", name: "爁E��クチE, jp: "身体×蓄積×独×静", color: "#2a7a2a", desc: "体�E疲れが蓁E��するほど崩れやすくなる。崩れたあとはひとりで静かにこもって允E��する。疲れてぁE��ことを悟られたくなぁE��、回復も人に見せなぁE��E },
    "PETA": { emoji: "🐧", name: "ぺたぺた�Eンギン", jp: "身体×蓄積×群×動", color: "#1a6a95", desc: "体�E疲れが溜まるほど崩れやすくなる。崩れたあとはひとりだと沈んでしまぁE��、仲間と一緒に動くと不思議と戻れる。人のエネルギーが回復の鍵、E },
    "PETQ": { emoji: "🦦", name: "手つなぎラチE��", jp: "身体×蓄積×群×静", color: "#905028", desc: "体�E疲れが蓁E��するほど崩れやすくなる。崩れたあとは誰か�Eそ�Eでただ静かにぁE��ことで回復できる。言葉より存在、そばにぁE��もらぁE��けで十�E、E },
    "PRSA": { emoji: "🐆", name: "爁E��チ�Eター", jp: "身体×緊張緩和×独×動", color: "#a07800", desc: "体�Eしんどくても緊張してぁE��間�E保てる。その緊張が解けた瞬間に崩れが表に出る。崩れたあとはひとりで体を動かすことで素早く�Eり替えられる、E },
    "PRSQ": { emoji: "🐌", name: "籠城カタチE��リ", jp: "身体×緊張緩和×独×静", color: "#2a7040", desc: "体�Eしんどくても緊張で保ってぁE��。帰宁E��たり一段落した瞬間に崩れが表に出る。崩れたあとはひとりで静かにこもることで少しずつ戻ってぁE��る、E },
    "PRTA": { emoji: "🐬", name: "大放出イルカ", jp: "身体×緊張緩和×群×動", color: "#0070a0", desc: "体�Eしんどくても場の空気や緊張で乗り刁E��てしまぁE��緊張が解けた瞬間に崩れが表に出る。崩れたあとは仲間と一緒に動いて発散することで一気に回復できる、E },
    "PRTQ": { emoji: "🐰", name: "よりそいウサギ", jp: "身体×緊張緩和×群×静", color: "#b04080", desc: "体�Eしんどくても緊張で保ってぁE��。帰宁E��たり一段落すると崩れが表に出る。崩れたあとは誰かとめE��くり過ごすことで安忁E��が戻ってくる、E },
    "MESA": { emoji: "🐦‍⬁E, name: "暗躍カラス", jp: "精神×蓄積×独×動", color: "#4040b0", desc: "気持ちの疲れが溜まるほど崩れやすくなる。崩れたあとはひとりで体を動かして頭を空っぽにする。老E��すぎを動きで強制皁E��断ち刁E��タイプ、E },
    "MESQ": { emoji: "🦁E, name: "夜�Eけ征E��フクロウ", jp: "精神×蓄積×独×静", color: "#3030a0", desc: "気持ちの疲れが蓁E��するほど崩れやすくなる。崩れたあとはひとりで静かにぁE��ことで回復できる。�E刁E�Eペ�Eスで感情を整琁E��る時間が忁E��なタイプ、E },
    "META": { emoji: "🐋", name: "爁E��シャチE, jp: "精神×蓄積×群×動", color: "#0090a0", desc: "気持ちの疲れが溜まるほど崩れやすくなる。崩れたあとは仲間と一緒に動いて感情を発散する。体を使って外に出すことで気持ちが軽くなる、E },
    "METQ": { emoji: "🐼", name: "寁E��パンダ", jp: "精神×蓄積×群×静", color: "#555555", desc: "気持ちの疲れが蓁E��するほど崩れやすくなる。崩れたあとは誰かにそ�EにぁE��もらぁE��とで回復できる。言葉より存在、安忁E��きる人がいるだけで十�E、E },
    "MRSA": { emoji: "🦦", name: "気まぐれカワウソ", jp: "精神×緊張緩和×独×動", color: "#906020", desc: "気持ちはしんどくても緊張してぁE��間�E保てる。気が緩んだ瞬間に崩れが表に出る。崩れても�Eとりで体を動かすことですぐ刁E��替えられる。立ち直りが早ぁE��だと思う、E },
    "MRSQ": { emoji: "🦥", name: "脱力ナマケモチE, jp: "精神×緊張緩和×独×静", color: "#408040", desc: "気持ちはしんどくても緊張で保ってぁE��。気が緩んだ瞬間にずるずる沈んでぁE��。�Eとりで静かにぁE��ことで少しずつ戻ってぁE��る。時間をかけてじわじわ回復するタイプ、E },
    "MRTA": { emoji: "🦩", name: "急上�Eフラミンゴ", jp: "精神×緊張緩和×群×動", color: "#c02080", desc: "気持ちはしんどくても緊張で保ってぁE��。気が緩んだ瞬間に崩れが表に出る。崩れても仲間と一緒に動くことで一気にチE��ションが戻る。人のエネルギーに引っ張られて回復できる、E },
    "MRTQ": { emoji: "🦫", name: "ぽかぽかカピバラ", jp: "精神×緊張緩和×群×静", color: "#907020", desc: "気持ちはしんどくても緊張で保ってぁE��。気が緩んだ瞬間にのん�Eりモードに入って崩れが表に出る。誰かとめE��たり過ごすことが一番の回復になる、E },
  };

  const [recoveryTypeFull, setRecoveryTypeFull] = useState(null);
  const [diagnosedAt, setDiagnosedAt] = useState(null);
  const [typeLoading, setTypeLoading] = useState(false);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [tagPopup, setTagPopup] = useState(null);

  const TAG_EXPLANATIONS = {
    "身佁E: { title: "崩れ�E原因�E�身佁Eor 精神！E, items: [["P", "Physical�E�身体！E, "身体が原因で崩れる。肉体的な疲れや不調が引き金になる、E], ["M", "Mental�E�精神！E, "精神が原因で崩れる。気持ちの疲れやストレスが引き金になる、E]] },
    "精祁E: { title: "崩れ�E原因�E�身佁Eor 精神！E, items: [["P", "Physical�E�身体！E, "身体が原因で崩れる。肉体的な疲れや不調が引き金になる、E], ["M", "Mental�E�精神！E, "精神が原因で崩れる。気持ちの疲れやストレスが引き金になる、E]] },
    "蓁E��E: { title: "崩れ�Eタイミング�E�蓄穁Eor 緊張緩和！E, items: [["E", "Exhaustion�E�蓄積疲弊！E, "疲れが蓁E��して崩れる。限界まで溜め込んでから崩れるタイプ、E], ["R", "Release�E�緊張緩和！E, "緊張が解けたときに崩れる。気が緩んだ瞬間に崩れるタイプ、E]] },
    "緊張緩咁E: { title: "崩れ�Eタイミング�E�蓄穁Eor 緊張緩和！E, items: [["E", "Exhaustion�E�蓄積疲弊！E, "疲れが蓁E��して崩れる。限界まで溜め込んでから崩れるタイプ、E], ["R", "Release�E�緊張緩和！E, "緊張が解けたときに崩れる。気が緩んだ瞬間に崩れるタイプ、E]] },
    "独": { title: "回復スタイル�E�独 or 群�E�E, items: [["S", "Solo�E�独�E�E, "ひとりで回復する。人とぁE��と疲れが取れなぁE��E], ["T", "Together�E�群�E�E, "人と一緒に回復する。�EとりでぁE��と送E��沈んでしまぁE��E]] },
    "群": { title: "回復スタイル�E�独 or 群�E�E, items: [["S", "Solo�E�独�E�E, "ひとりで回復する。人とぁE��と疲れが取れなぁE��E], ["T", "Together�E�群�E�E, "人と一緒に回復する。�EとりでぁE��と送E��沈んでしまぁE��E]] },
    "勁E: { title: "回復の手段�E�動 or 静！E, items: [["A", "Active�E�動�E�E, "動いて回復する。体を使ぁE��が気持ちがリセチE��される、E], ["Q", "Quiet�E�静�E�E, "静かに回復する。じっとしてぁE��方が回復できる、E]] },
    "靁E: { title: "回復の手段�E�動 or 静！E, items: [["A", "Active�E�動�E�E, "動いて回復する。体を使ぁE��が気持ちがリセチE��される、E], ["Q", "Quiet�E�静�E�E, "静かに回復する。じっとしてぁE��方が回復できる、E]] },
  };

  const getRecoveryType = () => {
    if (logs.length < 7) return null;
    return recoveryTypeFull;
  };

  const runTypeAnalysis = async () => {
    if (logs.length < 7) return;
    setTypeLoading(true);
    try {
      const summary = logs.slice(0, 14).map((l) => ({
        崩めE l.kuzure ? "あり" : "なぁE,
        疲労: FATIGUE_LABELS[l.fatigue],
        イベンチE (l.events||[]).join("・"),
        気持ち: (l.motives||[]).join("・"),
        試したこと: (l.recovery||[]).join("・"),
        生理中: l.isPeriod ? "あり" : "なぁE,
      }));

      const res = await fetch("/api/analyze.cjs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 100,
          temperature: 0,
          messages: [{
            role: "user",
            content: `以下�EログチE�Eタから、この人の回復タイプコードを1つだけ選んでください、E

コード一覧�E�E
PESA: 身体×蓄積×独×動
PESQ: 身体×蓄積×独×静
PETA: 身体×蓄積×群×動
PETQ: 身体×蓄積×群×静
PRSA: 身体×緊張緩和×独×動
PRSQ: 身体×緊張緩和×独×静
PRTA: 身体×緊張緩和×群×動
PRTQ: 身体×緊張緩和×群×静
MESA: 精神×蓄積×独×動
MESQ: 精神×蓄積×独×静
META: 精神×蓄積×群×動
METQ: 精神×蓄積×群×静
MRSA: 精神×緊張緩和×独×動
MRSQ: 精神×緊張緩和×独×静
MRTA: 精神×緊張緩和×群×動
MRTQ: 精神×緊張緩和×群×静

ログ�E�E{JSON.stringify(summary)}

コードだけ返してください�E�例：PE-SQ�E�`
          }]
        })
      });
      const data = await res.json();
      const code = (data.content||[]).map((c) => c.text||"").join("").trim().toUpperCase();
      const matched = Object.keys(RECOVERY_TYPES).find(k => code.includes(k));
      if (matched) {
        setRecoveryTypeFull(RECOVERY_TYPES[matched]);
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()}`;
        setDiagnosedAt(dateStr);
        try { 
          localStorage.setItem("kuzure_recovery_type", matched);
          localStorage.setItem("kuzure_recovery_type_date", dateStr);
        } catch(e) {}
      }
    } catch (e) {
      console.error(e);
    }
    setTypeLoading(false);
  };

  const renderMarkdown = (text) => {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i} style={{ margin: "4px 0", fontSize: 13, color: "#4a3a9a", lineHeight: 1.7 }}>
          {parts.map((part, j) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      );
    });
  };

  // Import existing localStorage data to Supabase
  const handleImport = async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { alert("インポ�Eトするデータがありません"); return; }
      const localLogs = JSON.parse(raw);
      if (!localLogs.length) { alert("インポ�Eトするデータがありません"); return; }
      
      for (const l of localLogs) {
        const dbEntry = {
          user_id: user.id, date: l.date, sleep: l.sleep, fatigue: l.fatigue,
          events: l.events || [], kuzure: l.kuzure, actions: l.actions || [],
          motives: l.motives || [], memo: l.memo || "", recovery: l.recovery || [],
          is_period: l.isPeriod || null, event_memo: l.eventMemo || "",
        };
        await supabase.from("logs").upsert(dbEntry, { onConflict: "user_id,date" });
      }
      await loadUserData(user.id);
      setShowImport(false);
      alert(`${localLogs.length}件のチE�Eタを引き継ぎました�E�`);
    } catch (e) {
      alert("引き継ぎに失敗しました");
    }
  };

  // Auth handlers
  const handleReset = async () => {
    setAuthError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://kuzure-log.vercel.app",
    });
    if (error) setAuthError(error.message);
    else setResetSent(true);
  };

  const handleAuth = async () => {
    setAuthError("");
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError("メールアドレスかパスワードが違いまぁE);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setLogs([]);
    setAlreadyLogged(false);
  };

  if (authLoading) return (
    <div style={{ ...S.wrap, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <p style={{ color: "#aaa", fontSize: 14 }}>読み込み中...</p>
    </div>
  );



  return (
    <div style={S.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
        <p style={S.heading}>崩れログ</p>
        {user ? (
          <button onClick={handleLogout} style={{ fontSize: 11, color: "#aaa", background: "none", border: "1px solid #e4e0d8", borderRadius: 99, padding: "4px 12px", cursor: "pointer", marginTop: 4 }}>ログアウチE/button>
        ) : (
          <button onClick={() => setShowAuthModal(true)} style={{ fontSize: 11, color: "#5a35c8", background: "none", border: "1px solid #d6ccf5", borderRadius: 99, padding: "4px 12px", cursor: "pointer", marginTop: 4 }}>ログイン</button>
        )}
      </div>
      <p style={S.sub}>朝起きためE刁E��け、昨日を振り返る</p>

      <div style={S.tabs}>
        {[["record","今朝の記録"],["history","ログを見る"],["settings","設宁E]].map(([t,label]) => (
          <button key={t} onClick={() => setTab(t)} style={S.tab(tab===t)}>{label}</button>
        ))}
      </div>

      {tab === "record" && (
        <div>
          {editingLog && (
            <div style={{ background: "#fff4e6", border: "1.5px solid #f5c4a8", borderRadius: 14, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#b85c00", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>✏︁E{editingLog.date} の記録を編雁E��</span>
              <button onClick={() => { setEditingLog(null); setSleep(null); setFatigue(null); setEvents([]); setKuzure(null); setActions([]); setMotives([]); setMemo(""); setOtherEvent(""); setRecovery([]); setSelectedDate(""); }} style={{ fontSize: 12, color: "#b85c00", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>キャンセル</button>
            </div>
          )}
          {alreadyLogged && !saved && !editingLog && <div style={S.alreadyBox}>今日はもう記録済みです。別の日の刁E��記録することもできます、E/div>}

          <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 14, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>記録する日</span>
            <input
              type="date"
              value={selectedDate ? selectedDate.replace(/\//g, "-") : new Date().toISOString().split("T")[0]}
              onChange={(e) => {
                const d = e.target.value;
                setSelectedDate(d.replace(/-/g, "/"));
                const today = todayStr();
                const chosen = d.replace(/-/g, "/");
                const exists = logs.some(l => l.date === chosen);
                setAlreadyLogged(chosen === today && exists);
              }}
              style={{ flex: 1, padding: "8px 10px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 10, background: "#faf9f7", color: "#1a1a1a", outline: "none" }}
            />
          </div>

          {/* 睡眠 */}
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#5a35c8")}/><span style={S.secLabel}>昨夜�E睡眠満足度<span style={{color:"#c02020",marginLeft:6,fontSize:9,fontWeight:700,letterSpacing:"0.05em"}}>忁E��E/span></span></div>
            <div style={S.faceGrid}>
              {[1,2,3,4,5].map((v) => (
                <button key={v} onClick={() => setSleep(v)} style={S.faceBtn(sleep===v, "#5a35c8")}>
                  <SleepFace level={v} color={sleep===v ? "#5a35c8" : "#ccc"} />
                  <span style={S.faceLbl(sleep===v, "#5a35c8")}>{SLEEP_LABELS[v]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 疲労 */}
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#c04820")}/><span style={S.secLabel}>今�E体�E疲労愁Espan style={{color:"#c02020",marginLeft:6,fontSize:9,fontWeight:700,letterSpacing:"0.05em"}}>忁E��E/span></span></div>
            <div style={S.faceGrid}>
              {[1,2,3,4,5].map((v) => (
                <button key={v} onClick={() => setFatigue(v)} style={S.faceBtn(fatigue===v, "#c04820")}>
                  <FatigueFace level={v} color={fatigue===v ? "#c04820" : "#ccc"} />
                  <span style={S.faceLbl(fatigue===v, "#c04820")}>{FATIGUE_LABELS[v]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* イベンチE*/}
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#1a7ac0")}/><span style={S.secLabel}>昨日のイベント（褁E��OK�E�Espan style={{color:"#c02020",marginLeft:6,fontSize:9,fontWeight:700,letterSpacing:"0.05em"}}>忁E��E/span></span></div>
            <p style={{ fontSize: 11, color: "#b0a898", margin: "0 0 10px" }}>ドラチE��で並び替え、E�で削除できまぁE/p>
            <RecoveryManager
              items={eventItems}
              setItems={setEventItems}
              selected={events}
              onToggle={toggleEvent}
              onDelete={deleteEvent}
              activeColor="#1a7ac0"
            />
            <textarea value={eventMemo} onChange={(e) => setEventMemo(e.target.value)} placeholder="一言メモ�E�任意！E rows={2} style={{ ...S.textarea, marginTop: 10 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input value={newEventInput} onChange={(e) => setNewEventInput(e.target.value)} onKeyDown={(e) => { if (e.key==="Enter") addEvent(); }} placeholder="追加する�E�Enterで確定！E style={{ flex: 1, padding: "10px 12px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#faf9f7", color: "#1a1a1a", outline: "none" }} />
              <button onClick={addEvent} style={{ padding: "10px 14px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>追加</button>
            </div>
          </div>

          <div style={S.divider}/>

          {/* 崩めE*/}
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#c02020")}/><span style={S.secLabel}>昨日、崩れた�E�Espan style={{color:"#c02020",marginLeft:6,fontSize:9,fontWeight:700,letterSpacing:"0.05em"}}>忁E��E/span></span></div>
            <div style={S.ynGrid}>
              <button onClick={() => setKuzure(true)} style={S.ynBtn(kuzure===true, "#c02020")}>した</button>
              <button onClick={() => setKuzure(false)} style={S.ynBtn(kuzure===false, "#5a35c8")}>してなぁE/button>
            </div>
            {/* Preview of actions when nothing selected */}
            {kuzure !== true && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ACTIONS_DEFAULT.map((a) => (
                  <span key={a} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 10, background: "#ebebeb", color: "#888", border: "1px solid #ddd" }}>{a}</span>
                ))}
              </div>
            )}

            {kuzure === true && (
              <div style={{ marginTop: 16 }}>
                <p style={{ ...S.secLabel, marginBottom: 6 }}>何をした�E�（褁E��OK�E�E/p>
                <p style={{ fontSize: 11, color: "#b0a898", margin: "0 0 10px" }}>ドラチE��で並び替え、E�で削除できまぁE/p>
                <RecoveryManager items={actionItems} setItems={setActionItems} selected={actions} onToggle={(a) => toggleMulti(actions, setActions, a)} onDelete={deleteAction} activeColor="#c02020" />
                <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 16 }}>
                  <input value={newActionInput} onChange={(e) => setNewActionInput(e.target.value)} onKeyDown={(e) => { if (e.key==="Enter") addAction(); }} placeholder="追加する�E�Enterで確定！E style={{ flex: 1, padding: "10px 12px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#faf9f7", color: "#1a1a1a", outline: "none" }} />
                  <button onClick={addAction} style={{ padding: "10px 14px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>追加</button>
                </div>
                <p style={{ ...S.secLabel, marginBottom: 6 }}>そ�Eとき、どんな気持ちだった？（褁E��OK�E�E/p>
                <p style={{ fontSize: 11, color: "#b0a898", margin: "0 0 10px" }}>ドラチE��で並び替え、E�で削除できまぁE/p>
                <RecoveryManager items={motiveItems} setItems={setMotiveItems} selected={motives} onToggle={(m) => toggleMulti(motives, setMotives, m)} onDelete={deleteMotive} activeColor="#c02020" />
                <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 16 }}>
                  <input value={newMotiveInput} onChange={(e) => setNewMotiveInput(e.target.value)} onKeyDown={(e) => { if (e.key==="Enter") addMotive(); }} placeholder="追加する�E�Enterで確定！E style={{ flex: 1, padding: "10px 12px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#faf9f7", color: "#1a1a1a", outline: "none" }} />
                  <button onClick={addMotive} style={{ padding: "10px 14px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>追加</button>
                </div>
                <p style={{ ...S.secLabel, marginBottom: 6 }}>一言メモ�E�任意！E/p>
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="どんな感じだったか、�E由に" rows={2} style={S.textarea} />
              </div>
            )}
          </div>

          <div style={S.divider}/>

          <button
            onClick={() => setShowOptional((p) => !p)}
            style={{ width: "100%", padding: "12px 16px", marginBottom: 12, fontSize: 13, fontWeight: 500, border: "1.5px dashed #c8c0b0", borderRadius: 14, background: "transparent", color: "#888", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>任意頁E��を{showOptional ? "閉じめE : "開く"}</span>
            <span style={{ fontSize: 12, transform: showOptional ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
          </button>

          {showOptional && (
            <>
              {trackPeriod && (
                <div style={S.secWrap}>
                  <div style={S.secHead}><div style={S.secBar("#e06b8e")}/><span style={S.secLabel}>昨日、生琁E��だった！E/span></div>
                  <div style={S.ynGrid}>
                    <button onClick={() => setIsPeriod(true)} style={S.ynBtn(isPeriod === true, "#e06b8e")}>生理中</button>
                    <button onClick={() => setIsPeriod(false)} style={S.ynBtn(isPeriod === false, "#888")}>違う</button>
                  </div>
                </div>
              )}
              <div style={S.secWrap}>
                <div style={S.secHead}><div style={S.secBar("#1a6030")}/><span style={S.secLabel}>昨日試したこと</span></div>
                <p style={{ fontSize: 11, color: "#b0a898", margin: "0 0 10px" }}>ドラチE��で並び替え、E�で削除できまぁE/p>
                <RecoveryManager items={recoveryItems} setItems={setRecoveryItems} selected={recovery} onToggle={(r) => toggleMulti(recovery, setRecovery, r)} onDelete={deleteRecovery} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input value={newRecoveryInput} onChange={(e) => setNewRecoveryInput(e.target.value)} onKeyDown={(e) => { if (e.key==="Enter") addRecovery(); }} placeholder="追加する�E�Enterで確定！E style={{ flex: 1, padding: "10px 12px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#faf9f7", color: "#1a1a1a", outline: "none" }} />
                  <button onClick={addRecovery} style={{ padding: "10px 14px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>追加</button>
                </div>
              </div>
            </>
          )}

          <button onClick={handleSave} style={S.saveBtn}>{editingLog ? "編雁E��保存すめE : "記録する"}</button>
          {saved && (
            <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, pointerEvents: "none" }}>
              <div style={{ background: "#1a1a1a", color: "#fff", borderRadius: 16, padding: "16px 28px", fontSize: 15, fontWeight: 700, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", textAlign: "center" }}>
                <p style={{ margin: "0 0 4px" }}>記録しました ✁E/p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 400, color: "#aaa" }}>明日の朝また来てね</p>
              </div>
            </div>
          )}
        </div>
      )}

      {showAllTypes && (
        <div style={{ position: "fixed", inset: 0, background: "#f5f3ef", zIndex: 200, overflow: "auto", padding: "24px 16px 48px" }}>
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>全16タイチE/h2>
                <button onClick={() => setShowLegend(true)} style={{ width: 22, height: 22, borderRadius: "50%", border: "1.5px solid #555", background: "none", color: "#555", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>?</button>
              </div>
              <button onClick={() => setShowAllTypes(false)} style={{ fontSize: 13, color: "#555", background: "none", border: "1px solid #333", borderRadius: 99, padding: "6px 16px", cursor: "pointer" }}>閉じめE/button>
            </div>
            {showLegend && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }} onClick={() => setShowLegend(false)}>
                <div style={{ background: "#ffffff", border: "1px solid #e0ddd8", borderRadius: 18, padding: "24px 20px", maxWidth: 300, width: "100%" }} onClick={(e) => e.stopPropagation()}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "0 0 16px" }}>コード�E読み方</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#a0a0d0", margin: "0 0 12px" }}>1・2斁E��目�E�崩れタイチE/p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    {[["P","身体が原因で崩れる"],["M","精神が原因で崩れる"],["E","疲れが蓁E��して崩れる"],["R","緊張が解けたときに崩れる"]].map(([code, desc]) => (
                      <div key={code} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "#5a35c8", fontFamily: "monospace", flexShrink: 0, width: 20 }}>{code}</span>
                        <span style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#a0a0d0", margin: "0 0 12px" }}>3・4斁E��目�E�回復タイチE/p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                    {[["S","ひとりで回復する"],["T","人と一緒に回復する"],["A","動いて回復する"],["Q","静かに回復する"]].map(([code, desc]) => (
                      <div key={code} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "#c04820", fontFamily: "monospace", flexShrink: 0, width: 20 }}>{code}</span>
                        <span style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowLegend(false)} style={{ width: "100%", padding: "10px", fontSize: 13, border: "none", borderRadius: 12, background: "#333", color: "#fff", cursor: "pointer" }}>閉じめE/button>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.entries(RECOVERY_TYPES).map(([code, t]) => (
                <TypeCard key={code} code={code} t={t} onSelect={(c, type) => setSelectedType({code: c, ...type})} />
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedType && (
        <div style={{ position: "fixed", inset: 0, background: "#f5f3ef", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", overflowY: "auto" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${selectedType.color}30 0%, transparent 65%)`, pointerEvents: "none" }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: selectedType.color, letterSpacing: "0.14em", margin: "0 0 8px" }}>RECOVERY TYPE</p>
          <p style={{ fontSize: 48, margin: "0 0 10px" }}>{selectedType.emoji}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: selectedType.color, margin: 0, fontFamily: "monospace", letterSpacing: "0.1em" }}>{selectedType.code || Object.keys(RECOVERY_TYPES).find(k => RECOVERY_TYPES[k].name === selectedType.name)}</p>
            <button onClick={() => setTagPopup("code")} style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${selectedType.color}88`, background: "none", color: selectedType.color, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>?</button>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: "0 0 12px", letterSpacing: "-0.3px" }}>{selectedType.name}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 20 }}>
            {selectedType.jp.split("ÁE).map((tag, i) => (
              <button key={i} onClick={() => setTagPopup(tag)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, border: `1px solid ${selectedType.color}55`, color: selectedType.color, background: selectedType.color + "15", cursor: "pointer" }}>{tag}</button>
            ))}
          </div>
          <div style={{ width: 32, height: 1.5, background: selectedType.color, borderRadius: 2, marginBottom: 20, opacity: 0.5 }} />
          <p style={{ fontSize: 14, color: "#333", lineHeight: 1.8, textAlign: "center", maxWidth: 300, margin: "0 0 32px" }}>{selectedType.desc}</p>
          <button onClick={() => setSelectedType(null)} style={{ fontSize: 13, color: "#555", background: "none", border: "1px solid #333", borderRadius: 99, padding: "8px 24px", cursor: "pointer" }}>閉じめE/button>

          {tagPopup && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400, padding: "0 0 0 0" }} onClick={() => setTagPopup(null)}>
              <div style={{ background: "#ffffff", border: "1px solid #e0ddd8", borderRadius: "18px 18px 0 0", padding: "24px 20px 32px", maxWidth: 420, width: "100%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                {tagPopup === "code" ? (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "0 0 16px" }}>コード�E読み方</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#4a28b0", margin: "0 0 10px" }}>1斁E��目�E�崩れ�E原因</p>
                    {[["P","Physical�E�身体！E,"身体が原因で崩れる"],["M","Mental�E�精神！E,"精神が原因で崩れる"]].map(([c,en,d]) => (
                      <div key={c} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#4a28b0", fontFamily: "monospace", width: 20 }}>{c}</span>
                          <span style={{ fontSize: 12, color: "#4a28b0", fontFamily: "monospace", fontWeight: 600 }}>{en}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#444", margin: "0 0 0 28px", lineHeight: 1.5 }}>{d}</p>
                      </div>
                    ))}
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#4a28b0", margin: "14px 0 10px" }}>2斁E��目�E�崩れ�Eタイミング</p>
                    {[["E","Exhaustion�E�蓄積疲弊！E,"疲れが蓁E��して崩れる"],["R","Release�E�緊張緩和！E,"緊張が解けたときに崩れる"]].map(([c,en,d]) => (
                      <div key={c} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#4a28b0", fontFamily: "monospace", width: 20 }}>{c}</span>
                          <span style={{ fontSize: 12, color: "#4a28b0", fontFamily: "monospace", fontWeight: 600 }}>{en}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#444", margin: "0 0 0 28px", lineHeight: 1.5 }}>{d}</p>
                      </div>
                    ))}
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#a03010", margin: "14px 0 10px" }}>3斁E��目�E�回復スタイル</p>
                    {[["S","Solo�E�独�E�E,"ひとりで回復する"],["T","Together�E�群�E�E,"人と一緒に回復する"]].map(([c,en,d]) => (
                      <div key={c} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#a03010", fontFamily: "monospace", width: 20 }}>{c}</span>
                          <span style={{ fontSize: 12, color: "#a03010", fontFamily: "monospace", fontWeight: 600 }}>{en}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#444", margin: "0 0 0 28px", lineHeight: 1.5 }}>{d}</p>
                      </div>
                    ))}
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#a03010", margin: "14px 0 10px" }}>4斁E��目�E�回復の手段</p>
                    {[["A","Active�E�動�E�E,"動いて回復する"],["Q","Quiet�E�静�E�E,"静かに回復する"]].map(([c,en,d]) => (
                      <div key={c} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#a03010", fontFamily: "monospace", width: 20 }}>{c}</span>
                          <span style={{ fontSize: 12, color: "#a03010", fontFamily: "monospace", fontWeight: 600 }}>{en}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#444", margin: "0 0 0 28px", lineHeight: 1.5 }}>{d}</p>
                      </div>
                    ))}
                  </>
                ) : TAG_EXPLANATIONS[tagPopup] ? (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "0 0 16px" }}>{TAG_EXPLANATIONS[tagPopup].title}</p>
                    {TAG_EXPLANATIONS[tagPopup].items.map(([c, en, d]) => (
                      <div key={c} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#4a28b0", fontFamily: "monospace", flexShrink: 0, width: 24 }}>{c}</span>
                          <span style={{ fontSize: 12, color: "#4a28b0", fontFamily: "monospace", fontWeight: 600 }}>{en}</span>
                        </div>
                        <span style={{ fontSize: 13, color: "#333", lineHeight: 1.6, marginLeft: 32, display: "block" }}>{d}</span>
                      </div>
                    ))}
                  </>
                ) : null}
                <button onClick={() => setTagPopup(null)} style={{ width: "100%", padding: "13px", fontSize: 15, fontWeight: 700, border: "none", borderRadius: 12, background: "#fff", color: "#1a1a1a", cursor: "pointer", marginTop: 16 }}>閉じめE/button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div>
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#1a7ac0")}/><span style={S.secLabel}>チE�Eタの引き継ぎ</span></div>
            <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 14, padding: "14px 16px" }}>
              <p style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 600, margin: "0 0 4px" }}>ログイン前�EチE�Eタを引き継ぐ</p>
              <p style={{ fontSize: 12, color: "#b0a898", margin: "0 0 12px" }}>こ�Eブラウザに保存されてぁE��チE�Eタをアカウントに移行しまぁE/p>
              <button onClick={() => setShowImport(true)} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 12, background: "#1a7ac0", color: "#fff", cursor: "pointer" }}>チE�Eタを引き継ぐ</button>
            </div>
          </div>
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#e06b8e")}/><span style={S.secLabel}>生理周期�E記録</span></div>
            <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>生理中を記録する</p>
                  <p style={{ fontSize: 12, color: "#b0a898", margin: 0 }}>オンにすると記録画面に生理中の頁E��が追加されまぁE/p>
                </div>
                <button
                  onClick={() => setTrackPeriod((p) => !p)}
                  style={{ width: 48, height: 28, borderRadius: 99, border: "none", background: trackPeriod ? "#e06b8e" : "#ddd", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: trackPeriod ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div>
          {logs.length === 0 ? (
            <p style={{ textAlign: "center", color: "#aaa", fontSize: 14, paddingTop: 40 }}>まだ記録がありません</p>
          ) : (
            <>
              <div style={S.patternBox}>
                <div style={{ ...S.secHead, marginBottom: 10 }}><div style={S.secBar("#5a35c8")}/><span style={{ ...S.secLabel, color: "#5a35c8" }}>パターン刁E��</span></div>
                {!aiAnalysis && !aiLoading && logs.length >= 3 && (
                  <button
                    onClick={runAiAnalysis}
                    style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 12, background: "#5a35c8", color: "#fff", cursor: "pointer" }}
                  >
                    AIで刁E��する
                  </button>
                )}
                {!aiAnalysis && !aiLoading && logs.length < 3 && (
                  <p style={{ fontSize: 13, color: "#b0a898", margin: 0, textAlign: "center" }}>あと{3 - logs.length}日記録するとAI刁E��できまぁE/p>
                )}
                {aiLoading && (
                  <p style={{ fontSize: 13, color: "#9a80d0", textAlign: "center", margin: 0 }}>刁E��中...</p>
                )}
                {aiAnalysis && (
                  <>
                    {(() => {
                      const summaryMatch = aiAnalysis.match(/SUMMARY:(.*?)(?=DETAIL:|$)/s);
                      const detailMatch = aiAnalysis.match(/DETAIL:(.*)/s);
                      const summary = summaryMatch ? summaryMatch[1].trim() : aiAnalysis.split("\n")[0];
                      const detail = detailMatch ? detailMatch[1].trim() : "";
                      return (
                        <>
                          <p style={{ fontSize: 13, color: "#4a3a9a", lineHeight: 1.7, margin: "0 0 10px", fontWeight: 600 }}>{summary}</p>
                          {detail && !showFullAnalysis && (
                            <button onClick={() => setShowFullAnalysis(true)} style={{ fontSize: 12, color: "#9a80d0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                              もっと読む ▼
                            </button>
                          )}
                          {detail && showFullAnalysis && (
                            <>
                              <div style={{ margin: "8px 0 10px" }}>{renderMarkdown(detail)}</div>
                              <button onClick={() => setShowFullAnalysis(false)} style={{ fontSize: 12, color: "#9a80d0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                                閉じめE▲
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                    <div style={{ marginTop: 10 }}>
                      <button onClick={() => { runAiAnalysis(); setShowFullAnalysis(false); }} style={{ fontSize: 12, color: "#9a80d0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                        もう一度刁E��する
                      </button>
                    </div>
                  </>
                )}
              </div>
              {logs.length < 7 ? (
                <div style={{ background: "#faf7ff", border: "1.5px dashed #d6ccf5", borderRadius: 16, padding: "16px", marginTop: 10, textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "#b0a898", margin: 0 }}>7日間記録すると</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#5a35c8", margin: "4px 0 0" }}>回復タイプが診断されまぁE/p>
                  <p style={{ fontSize: 11, color: "#c0b8d0", margin: "6px 0 0" }}>あと{Math.max(0, 7-logs.length)}日</p>
                </div>
              ) : recoveryTypeFull ? (
                <div
                  onClick={() => setSelectedType({code: Object.keys(RECOVERY_TYPES).find(k => RECOVERY_TYPES[k] === recoveryTypeFull), ...recoveryTypeFull})}
                  style={{ background: recoveryTypeFull.color + "15", border: `1.5px solid ${recoveryTypeFull.color}55`, borderRadius: 16, padding: "16px", marginTop: 10, cursor: "pointer" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: recoveryTypeFull.color, letterSpacing: "0.12em", margin: "0 0 8px" }}>あなた�E回復タイプ　ↁEタチE�Eで詳細</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 40 }}>{recoveryTypeFull.emoji}</span>
                    <div>
                      <p style={{ fontSize: 20, fontWeight: 900, color: recoveryTypeFull.color, margin: "0 0 2px", fontFamily: "monospace", letterSpacing: "0.1em" }}>{Object.keys(RECOVERY_TYPES).find(k => RECOVERY_TYPES[k] === recoveryTypeFull)}</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", margin: "0 0 4px" }}>{recoveryTypeFull.name}</p>
                      <p style={{ fontSize: 10, color: "#999", margin: 0 }}>{recoveryTypeFull.jp}</p>
                      {diagnosedAt && <p style={{ fontSize: 10, color: "#bbb", margin: "2px 0 0" }}>{diagnosedAt}時点�E�Elogs.length}日刁E��E/p>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <button onClick={(e) => { e.stopPropagation(); runTypeAnalysis(); }} style={{ fontSize: 11, color: typeLoading ? "#ccc" : "#999", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                      {typeLoading ? "診断中..." : "再診断する"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setShowAllTypes(true); }} style={{ fontSize: 11, color: "#999", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>全タイプを見る</button>
                  </div>
                </div>
              ) : (
                <div style={{ background: "#faf7ff", border: "1.5px dashed #d6ccf5", borderRadius: 16, padding: "16px", marginTop: 10, textAlign: "center" }}>
                  {typeLoading ? (
                    <p style={{ fontSize: 13, color: "#9a80d0", margin: 0 }}>診断中...</p>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, color: "#b0a898", margin: "0 0 10px" }}>7日刁E�EチE�Eタが揃ぁE��した</p>
                      <button onClick={runTypeAnalysis} style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 12, background: "#5a35c8", color: "#fff", cursor: "pointer", marginBottom: 8 }}>回復タイプを診断する</button>
                      <br/>
                      <button onClick={() => setShowAllTypes(true)} style={{ fontSize: 11, color: "#9a80d0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>全タイプを先に見る</button>
                    </>
                  )}
                </div>
              )}
              {logs.slice(0,20).map((e,i) => (
                <div key={i} style={S.logCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{e.date}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#b0a898" }}>{(e.events||[]).join(" / ")}</span>
                      <button onClick={() => openEdit(e)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, border: "1px solid #e4e0d8", background: "#fff", color: "#888", cursor: "pointer" }}>編雁E/button>
                      <button onClick={() => setConfirmDelete({ label: e.date, onConfirm: () => deleteLog(e.date) })} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, border: "1px solid #ffd0d0", background: "#fff", color: "#c02020", cursor: "pointer" }}>削除</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#aaa", marginBottom: 8 }}>
                    <span>睡眠 <b style={{ color: "#5a35c8" }}>{e.sleep}/5</b></span>
                    <span>疲労 <b style={{ color: "#c04820" }}>{FATIGUE_LABELS[e.fatigue]}</b></span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap" }}>
                    {e.kuzure
                      ? <><span style={S.tag("#fff0ee","#c02020")}>崩れあめE/span>{(e.actions||[]).map((a)=><span key={a} style={S.tag("#fff0ee","#c02020")}>{a}</span>)}</>
                      : <span style={S.tag("#f0ecff","#5a35c8")}>崩れなぁE/span>
                    }
                  </div>
                  {(e.recovery||[]).length>0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", marginTop: 4 }}>
                      {(e.recovery||[]).map((r)=><span key={r} style={S.tag("#edfaf2","#1a6030")}>{r}</span>)}
                    </div>
                  )}
                  {e.eventMemo && <p style={{ fontSize: 12, color: "#aaa", margin: "6px 0 0", lineHeight: 1.5 }}>{e.eventMemo}</p>}
                  {e.memo && <p style={{ fontSize: 12, color: "#888", margin: "6px 0 0", lineHeight: 1.5 }}>{e.memo}</p>}
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {showAuthModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "24px 20px", maxWidth: 320, width: "100%" }}>
            <div style={{ display: "flex", background: "#e8e4dc", borderRadius: 12, padding: 3, marginBottom: 16 }}>
              <button onClick={() => setAuthMode("login")} style={{ flex: 1, padding: "8px 0", fontSize: 13, fontWeight: authMode === "login" ? 700 : 400, border: "none", borderRadius: 9, background: authMode === "login" ? "#fff" : "transparent", color: authMode === "login" ? "#1a1a1a" : "#9a9080", cursor: "pointer" }}>ログイン</button>
              <button onClick={() => setAuthMode("signup")} style={{ flex: 1, padding: "8px 0", fontSize: 13, fontWeight: authMode === "signup" ? 700 : 400, border: "none", borderRadius: 9, background: authMode === "signup" ? "#fff" : "transparent", color: authMode === "signup" ? "#1a1a1a" : "#9a9080", cursor: "pointer" }}>新規登録</button>
            </div>
            <input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 14, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#1a1a1a", outline: "none", marginBottom: 10 }} />
            <input type="password" placeholder="パスワード！E斁E��以上！E value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAuth(); }}
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 14, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#1a1a1a", outline: "none", marginBottom: 10 }} />
            {authError && <p style={{ fontSize: 12, color: "#c02020", margin: "0 0 10px" }}>{authError}</p>}
            <button onClick={async () => { await handleAuth(); if (!authError) setShowAuthModal(false); }} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12, background: "#1a1a1a", color: "#fff", cursor: "pointer", marginBottom: 8 }}>
              {authMode === "login" ? "ログイン" : "アカウントを作�E"}
            </button>
            {authMode === "login" && (
              <button onClick={() => { setShowAuthModal(false); setResetMode(true); }} style={{ width: "100%", fontSize: 12, color: "#aaa", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginBottom: 8 }}>パスワードを忘れぁE/button>
            )}
            <button onClick={() => setShowAuthModal(false)} style={{ width: "100%", padding: "10px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>キャンセル</button>
          </div>
        </div>
      )}

      {resetMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "24px 20px", maxWidth: 320, width: "100%" }}>
            {resetSent ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>メールを送りました</p>
                <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>メールのリンクからパスワードを再設定してください</p>
                <button onClick={() => { setResetMode(false); setResetSent(false); }} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12, background: "#1a1a1a", color: "#fff", cursor: "pointer" }}>閉じめE/button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>パスワード�E設宁E/p>
                <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>登録したメールアドレスを�E力してください</p>
                <input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 14, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#1a1a1a", outline: "none", marginBottom: 10 }} />
                {authError && <p style={{ fontSize: 12, color: "#c02020", margin: "0 0 10px" }}>{authError}</p>}
                <button onClick={handleReset} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12, background: "#1a1a1a", color: "#fff", cursor: "pointer", marginBottom: 8 }}>送信する</button>
                <button onClick={() => setResetMode(false)} style={{ width: "100%", padding: "12px", fontSize: 14, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>キャンセル</button>
              </>
            )}
          </div>
        </div>
      )}

      {showImport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "24px 20px", maxWidth: 320, width: "100%", textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>チE�Eタを引き継ぎますか�E�E/p>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>こ�Eブラウザに保存されてぁE��ログチE�Eタをアカウントに移行します、E/p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => setShowImport(false)} style={{ padding: "12px", fontSize: 14, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>キャンセル</button>
              <button onClick={handleImport} style={{ padding: "12px", fontSize: 14, border: "none", borderRadius: 12, background: "#1a7ac0", color: "#fff", fontWeight: 700, cursor: "pointer" }}>引き継ぐ</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "24px 20px", maxWidth: 320, width: "100%", textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>削除しますか�E�E/p>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>「{confirmDelete.label}」を削除します、E/p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "12px", fontSize: 14, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>キャンセル</button>
              <button onClick={confirmDelete.onConfirm} style={{ padding: "12px", fontSize: 14, border: "none", borderRadius: 12, background: "#c02020", color: "#fff", fontWeight: 700, cursor: "pointer" }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
