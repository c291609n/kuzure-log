import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const STORAGE_KEY = "kuzure_logs_v5";
const RECOVERY_ORDER_KEY = "kuzure_recovery_order";
const PERIOD_KEY = "kuzure_period_tracking";
const ACTIONS_ORDER_KEY = "kuzure_actions_order";
const MOTIVES_ORDER_KEY = "kuzure_motives_order_v2";
const EVENTS_ORDER_KEY = "kuzure_events_order";

const SLEEP_LABELS = ["", "最悪", "悪い", "まあまあ", "良い", "ぐっすり"];
const FATIGUE_LABELS = ["", "限界", "やや疲れ", "ふつう", "やや元気", "元気"];
const KUZURE_LABELS = ["崩れてない", "ほんの少し", "少し", "そこそこ", "しっかり", "がっつり"];
const EVENTS_DEFAULT = ["バイト", "授業", "友達", "勉強", "運動", "特になし"];
const ACTIONS_DEFAULT = ["爆食い", "スマホ延々", "そのまま寝落ち"];
const MOTIVES_DEFAULT = ["だるい", "そわそわ", "しんどい", "何もしたくない", "めんどくさい", "わかんない"];
const RECOVERY_DEFAULT = ["入浴", "運動", "音楽を聴く", "友達と話す", "外出"];

// History dashboard sections (user-reorderable)
const SECTION_ORDER_KEY = "kuzure_section_order_v1";
const SECTION_DEFAULT_ORDER = ["summary", "streak", "pattern", "type", "report", "heatmap", "logs", "badges"];
// Delivery tone for AI text (content stays objective; only wording changes)
const TONES = {
  gentle: { label: "やさしい", desc: "寄り添うあたたかい言葉", inst: "仲のいい友達みたいに、やさしく寄り添うあたたかい話し言葉で" },
  normal: { label: "ふつう", desc: "落ち着いた客観的な口調", inst: "落ち着いた客観的な分析口調で" },
  straight: { label: "ストレート", desc: "率直ではっきり", inst: "率直で簡潔に、はっきり言い切る口調で" },
  cheer: { label: "はげまし", desc: "前向きに背中を押す", inst: "前向きで明るく、背中を押すように" },
};

const SECTION_META = {
  summary: { label: "今月のふりかえり", emoji: "📊" },
  streak: { label: "連続記録", emoji: "🔥" },
  pattern: { label: "パターン分析", emoji: "🔮" },
  type: { label: "回復タイプ", emoji: "🧭" },
  report: { label: "月次レポート", emoji: "📖" },
  heatmap: { label: "崩れの推移", emoji: "📈" },
  logs: { label: "ログ", emoji: "📝" },
  badges: { label: "実績", emoji: "🏅" },
};

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
            <span onClick={(e) => { e.stopPropagation(); setPendingDelete(r); }} style={{ position: "absolute", top: 4, right: 7, fontSize: 14, color: "#ccc", cursor: "pointer", fontWeight: 700 }}>×</span>
          </div>
        ))}
      </div>
      {pendingDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "24px 20px", maxWidth: 300, width: "100%", textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>削除しますか？</p>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>「{pendingDelete}」を削除します</p>
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

// Smooth slider with a live value display (used for sleep / fatigue / kuzure degree).
function Slider({ value, min, max, color, onChange, children }) {
  const v = value == null ? (min + max) / 2 : value;
  const pct = ((v - min) / (max - min)) * 100;
  const dim = value == null;
  return (
    <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ textAlign: "center", minHeight: 40, marginBottom: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {value == null
          ? <span style={{ fontSize: 13, color: "#c0b8a8" }}>スライドして選んでね</span>
          : children}
      </div>
      <input
        type="range" className="kz-slider" min={min} max={max} step={1} value={v}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{ color, background: dim ? "#e4e0d8" : `linear-gradient(to right, ${color} ${pct}%, #e4e0d8 ${pct}%)` }}
      />
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
  const [kuzureLevel, setKuzureLevel] = useState(null);
  const [actions, setActions] = useState([]);
  const [motives, setMotives] = useState([]);
  const [memo, setMemo] = useState("");
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
  const [signupDone, setSignupDone] = useState(false);
  const [browserOnly, setBrowserOnly] = useState(false);
  const [tone, setTone] = useState("normal");

  useEffect(() => {
    loadLocalSettings(); // logged-out + fallback
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) { applySettings(session.user.user_metadata?.settings); loadUserData(session.user.id); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) { applySettings(session.user.user_metadata?.settings); loadUserData(session.user.id); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Prompt login on load when not logged in (unless user chose browser-only this session)
  useEffect(() => {
    if (!authLoading && !user && !browserOnly) setShowAuthModal(true);
  }, [authLoading, user, browserOnly]);

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
          kuzureLevel: l.kuzure_level != null ? l.kuzure_level : (l.kuzure ? 3 : 0),
          actions: l.actions || [], motives: l.motives || [],
          memo: l.memo || "", recovery: l.recovery || [],
          isPeriod: l.is_period, eventMemo: l.event_memo || "",
          id: l.id,
        }));
        setLogs(mapped);
        if (mapped.length > 0 && mapped[0].date === todayStr()) setAlreadyLogged(true);
      }
    } catch (e) { console.error(e); }
  };

  // Load settings from localStorage (logged-out, and as fallback before DB settings arrive).
  const loadLocalSettings = () => {
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
      const savedAxes = localStorage.getItem("kuzure_recovery_axes");
      if (savedAxes) setRecoveryAxes(JSON.parse(savedAxes));
      const savedTypeDate = localStorage.getItem("kuzure_recovery_type_date");
      if (savedTypeDate) setDiagnosedAt(savedTypeDate);
      const periodRaw = localStorage.getItem(PERIOD_KEY);
      if (periodRaw) {
        const pd = JSON.parse(periodRaw);
        setTrackPeriod(pd.track || false);
        setPeriodDates(pd.dates || []);
      }
      const savedTone = localStorage.getItem("kuzure_tone");
      if (savedTone && TONES[savedTone]) setTone(savedTone);
      const aiHintRaw = localStorage.getItem("kuzure_ai_hint");
      if (aiHintRaw) { const h = JSON.parse(aiHintRaw); if (h && h.date === todayStr()) setAiHint(h); }
    } catch {}
  };

  // Build the settings object that gets synced to the account (DB).
  const buildSettings = () => ({
    recoveryItems, eventItems, actionItems, motiveItems,
    periodTrack: trackPeriod, periodDates,
    recoveryType: recoveryTypeFull ? Object.keys(RECOVERY_TYPES).find((k) => RECOVERY_TYPES[k] === recoveryTypeFull) || null : null,
    recoveryAxes: recoveryAxes || null,
    diagnosedAt: diagnosedAt || null,
    sectionOrder,
    tone,
  });

  // Apply settings loaded from the account, overriding local defaults.
  const applySettings = (s) => {
    if (!s) return;
    if (Array.isArray(s.recoveryItems)) setRecoveryItems(s.recoveryItems);
    if (Array.isArray(s.eventItems)) setEventItems(s.eventItems);
    if (Array.isArray(s.actionItems)) setActionItems(s.actionItems);
    if (Array.isArray(s.motiveItems)) setMotiveItems(s.motiveItems);
    if (typeof s.periodTrack === "boolean") setTrackPeriod(s.periodTrack);
    if (Array.isArray(s.periodDates)) setPeriodDates(s.periodDates);
    if (s.recoveryType && RECOVERY_TYPES[s.recoveryType]) setRecoveryTypeFull(RECOVERY_TYPES[s.recoveryType]);
    if (s.recoveryAxes && typeof s.recoveryAxes === "object") setRecoveryAxes(s.recoveryAxes);
    if (s.diagnosedAt) setDiagnosedAt(s.diagnosedAt);
    if (Array.isArray(s.sectionOrder)) {
      const merged = [...s.sectionOrder.filter((k) => SECTION_DEFAULT_ORDER.includes(k)), ...SECTION_DEFAULT_ORDER.filter((k) => !s.sectionOrder.includes(k))];
      setSectionOrder(merged);
    }
    if (s.tone && TONES[s.tone]) setTone(s.tone);
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
  const prevDay = (dateStr) => {
    const d = new Date(dateStr.replace(/\//g, "-"));
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  };
  const saveLogs = async (nl) => {
    setLogs(nl);
    // Also save to localStorage as backup
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(nl)); } catch {}
  };
  const toggleEvent = (ev) => {
    if (ev === "特になし") { setEvents(["特になし"]); return; }
    setEvents((p) => { const w = p.filter((e) => e !== "特になし"); return w.includes(ev) ? w.filter((e) => e !== ev) : [...w, ev]; });
  };

  const openEdit = (entry) => {
    setSleep(entry.sleep);
    setFatigue(entry.fatigue);
    setEvents(entry.events || []);
    setKuzureLevel(entry.kuzureLevel != null ? entry.kuzureLevel : (entry.kuzure ? 3 : 0));
    setActions(entry.actions || []);
    setMotives(entry.motives || []);
    setMemo(entry.memo || "");
    setEventMemo(entry.eventMemo || "");
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
    if (!sleep || !fatigue || events.length === 0 || kuzureLevel === null) { alert("全項目を選んでください"); return; }
    const kuzure = kuzureLevel > 0;
    const dateToSave = selectedDate || todayStr();
    const entry = { date: dateToSave, sleep, fatigue, events, kuzure, kuzureLevel, actions, motives, memo, recovery, isPeriod: trackPeriod ? isPeriod : null, eventMemo };
    if (trackPeriod && isPeriod) setPeriodDates((p) => p.includes(dateToSave) ? p : [...p, dateToSave]);

    // Save to Supabase if logged in
    if (user) {
      const dbEntry = {
        user_id: user.id, date: dateToSave, sleep, fatigue,
        events, kuzure, kuzure_level: kuzureLevel, actions, motives, memo,
        recovery, is_period: trackPeriod ? isPeriod : null, event_memo: eventMemo,
      };
      const existingLog = logs.find(l => l.date === dateToSave);
      const { error } = existingLog?.id
        ? await supabase.from("logs").update(dbEntry).eq("id", existingLog.id)
        : await supabase.from("logs").insert(dbEntry);
      if (error) {
        alert("記録に失敗しました。通信環境を確認して、もう一度試してください。");
        return; // keep the form filled so nothing is lost
      }
      // Reload logs from Supabase only
      await loadUserData(user.id);
    } else {
      const newLogs = [entry, ...logs.filter(l => l.date !== dateToSave)];
      newLogs.sort((a, b) => new Date(b.date.replace(/\//g,"-")) - new Date(a.date.replace(/\//g,"-")));
      saveLogs(newLogs);
    }
    setSleep(null); setFatigue(null); setEvents([]); setKuzureLevel(null);
    setActions([]); setMotives([]); setMemo(""); setRecovery([]); setIsPeriod(false); setEventMemo("");
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
    if (!kl.length) return "記録した期間では崩れなし。このまま続けましょう。";
    const total = logs.length;
    const lines = [];

    // イベント分析：崩れた日での出現率 vs 全体での出現率を比較
    const allEvents = {};
    logs.forEach((l) => (l.events||[]).forEach((e) => { allEvents[e] = (allEvents[e]||0)+1; }));
    const kuzureEvents = {};
    kl.forEach((l) => (l.events||[]).forEach((e) => { kuzureEvents[e] = (kuzureEvents[e]||0)+1; }));
    
    let topEvent = null, topRatio = 0;
    Object.keys(kuzureEvents).forEach((e) => {
      if (e === "特になし") return;
      const overallRate = (allEvents[e]||0) / total;
      const kuzureRate = kuzureEvents[e] / kl.length;
      // 全体の70%以上で出現する項目は除外
      if (overallRate >= 0.7) return;
      const ratio = overallRate > 0 ? kuzureRate / overallRate : 0;
      if (ratio > topRatio && kuzureEvents[e] >= 2) { topRatio = ratio; topEvent = e; }
    });
    if (topEvent && topRatio >= 1.3) {
      const pct = Math.round((topRatio - 1) * 100);
      lines.push(`「${topEvent}」がある日は崩れやすい傾向があります（崩れない日より${pct}%多い）。`);
    }

    // 疲労度：崩れた日 vs 崩れなかった日の平均を比較
    if (kl.length >= 2 && okl.length >= 2) {
      const kAvg = kl.reduce((s,l)=>s+l.fatigue,0)/kl.length;
      const okAvg = okl.reduce((s,l)=>s+l.fatigue,0)/okl.length;
      const diff = kAvg - okAvg;
      if (Math.abs(diff) >= 0.8) {
        const kLabel = FATIGUE_LABELS[Math.round(kAvg)];
        const okLabel = FATIGUE_LABELS[Math.round(okAvg)];
        if (diff < 0) {
          lines.push(`崩れた日の朝は「${kLabel}」寄り、崩れなかった日は「${okLabel}」寄り。疲れと崩れに関係がありそうです。`);
        } else {
          lines.push(`崩れた日の方が朝の疲労が少ない傾向があります。疲れていない日の気の緩みに注意かも。`);
        }
      }
    }

    // 気持ち分析：崩れた日だけに多く出る気持ち
    if (kl.length >= 2) {
      const mCount = {};
      kl.forEach((l) => (l.motives||[]).forEach((m) => { mCount[m]=(mCount[m]||0)+1; }));
      const topMotive = Object.keys(mCount).sort((a,b)=>mCount[b]-mCount[a])[0];
      if (topMotive && mCount[topMotive] >= 2) {
        lines.push(`崩れた日に「${topMotive}」という気持ちになることが多いです。`);
      }
    }

    // 試したこと分析：崩れなかった日に多く出るもの（全体の70%未満のもののみ）
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
        lines.push(`「${topRecovery}」をした日は崩れにくい傾向があります。`);
      }
    }

    return lines.join("\n") || "まだデータが少なくてパターンが見えていません。もう少し続けてみましょう。";
  };

  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [openLogKey, setOpenLogKey] = useState(null);
  const [closedMonths, setClosedMonths] = useState({});
  const [logsView, setLogsView] = useState("list");
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [reorderMode, setReorderMode] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [showHintWhy, setShowHintWhy] = useState(false);
  const [aiHint, setAiHint] = useState(null); // { date, text } cached per day
  const [aiHintLoading, setAiHintLoading] = useState(false);
  const [sectionOrder, setSectionOrder] = useState(SECTION_DEFAULT_ORDER);
  const dragSec = useRef(null);
  const [dragSecOver, setDragSecOver] = useState(null);

  // Load / persist the user's dashboard section order. (Declared after the state above to avoid TDZ.)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SECTION_ORDER_KEY);
      if (raw) {
        const saved = JSON.parse(raw).filter((k) => SECTION_DEFAULT_ORDER.includes(k));
        const merged = [...saved, ...SECTION_DEFAULT_ORDER.filter((k) => !saved.includes(k))];
        setSectionOrder(merged);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(sectionOrder)); } catch {}
  }, [sectionOrder]);

  const onSecDragEnd = () => {
    if (dragSec.current !== null && dragSecOver !== null && dragSec.current !== dragSecOver) {
      setSectionOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragSec.current, 1);
        next.splice(dragSecOver, 0, moved);
        return next;
      });
    }
    dragSec.current = null; setDragSecOver(null);
  };
  const [reportMonth, setReportMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [reports, setReports] = useState({});
  const [reportLoading, setReportLoading] = useState(false);

  // Delivery-style instruction for AI text — wording adapts, content stays objective.
  const toneInstruction = () =>
    `${(TONES[tone] || TONES.normal).inst}書いてください。ただし内容（分析）はデータに基づき客観的で正直に。事実を曲げたり、聞こえのいいことだけを言ったりしないこと。`;

  // AI analysis is a login-only feature — attach the user's token so the API can verify it.
  const callAnalyze = async (payload) => {
    const { data: { session } } = await supabase.auth.getSession();
    return fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  };

  const runAiAnalysis = async () => {
    if (logs.length < 3) return;
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const summary = logs.slice(0, 14).map((l) => ({
        日付: l.date,
        睡眠満足度: SLEEP_LABELS[l.sleep],
        疲労感: FATIGUE_LABELS[l.fatigue],
        イベント: (l.events||[]).join("・"),
        イベントメモ: l.eventMemo || "",
        崩れ: l.kuzure ? "あり" : "なし",
        崩れ行動: (l.actions||[]).join("・"),
        気持ち: (l.motives||[]).join("・"),
        試したこと: (l.recovery||[]).join("・"),
        メモ: l.memo || "",
      }));

      const res = await callAnalyze({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `以下は私の日々の崩れログのデータです。このデータを分析して、${toneInstruction()}

書き方のルール：
- 具体的な日付やイベントを根拠として挙げ、データに基づいて述べること
- 崩れた日と崩れなかった日の違いに注目
- 疲労感は「元気→やや元気→ふつう→やや疲れ→限界」の順で悪化、睡眠満足度は「最悪→悪い→まあまあ→良い→ぐっすり」の順で良くなる
- 記号（アスタリスク*、シャープ#、中黒・、番号）は一切使わないこと。装飾なしの普通の文章で

出力フォーマット（このラベルは必ず使う）：
SUMMARY: 最も重要な気づきを1文で
DETAIL:
詳細な気づきを2〜3個。各行は「見出し｜本文」の形式で書くこと。
見出しは12文字以内で、思わず読みたくなるキャッチーな小見出し（例：週明けの落とし穴、睡眠が崩れの引き金）。
本文はその見出しの内容を、データを根拠に1〜2文で。
区切りは全角の縦棒「｜」を必ず使い、行間は空けない。
NEXT: 今日から試せる具体的なおすすめ行動を1〜2文で。データ上、崩れにくかった行動を根拠に。

データ：
${JSON.stringify(summary, null, 2)}`
          }]
        });
      if (res.status === 401) { setAiAnalysis("AI分析はログインすると使えます。"); setAiLoading(false); return; }
      const data = await res.json();
      const text = (data.content||[]).map((c) => c.text||"").join("");
      if (text) { try { localStorage.setItem("kuzure_used_ai", "1"); } catch {} }
      if (!text) {
        const err = data?.error?.message || (typeof data?.error === "string" ? data.error : "") || JSON.stringify(data).slice(0, 300);
        console.error("AI analysis failed:", err);
        setAiAnalysis("うまく分析できませんでした。少し時間をおいて、もう一度お試しください。");
      } else {
        setAiAnalysis(text);
      }
    } catch (e) {
      console.error("AI analysis error:", e);
      setAiAnalysis("うまく分析できませんでした。少し時間をおいて、もう一度お試しください。");
    }
    setAiLoading(false);
  };

  const RECOVERY_TYPES = {
    "PESA": { emoji: "🐺", name: "疾走オオカミ", jp: "身体×蓄積×独×動", color: "#5a35c8", desc: "体の疲れが溜まるほど崩れやすくなる。疲れていても「まだいける」と思ってしまいがち。崩れたあとはひとりで体を動かすことでリセットできる。じっとしているより動いた方が回復できる。" },
    "PESQ": { emoji: "🐻", name: "爆睡クマ", jp: "身体×蓄積×独×静", color: "#2a7a2a", desc: "体の疲れが蓄積するほど崩れやすくなる。崩れたあとはひとりで静かにこもって充電する。疲れていることを悟られたくないし、回復も人に見せない。" },
    "PETA": { emoji: "🐧", name: "ぺたぺたペンギン", jp: "身体×蓄積×群×動", color: "#1a6a95", desc: "体の疲れが溜まるほど崩れやすくなる。崩れたあとはひとりだと沈んでしまうが、仲間と一緒に動くと不思議と戻れる。人のエネルギーが回復の鍵。" },
    "PETQ": { emoji: "🦦", name: "手つなぎラッコ", jp: "身体×蓄積×群×静", color: "#905028", desc: "体の疲れが蓄積するほど崩れやすくなる。崩れたあとは誰かのそばでただ静かにいることで回復できる。言葉より存在、そばにいてもらうだけで十分。" },
    "PRSA": { emoji: "🐆", name: "爆走チーター", jp: "身体×緊張緩和×独×動", color: "#a07800", desc: "体はしんどくても緊張している間は保てる。その緊張が解けた瞬間に崩れが表に出る。崩れたあとはひとりで体を動かすことで素早く切り替えられる。" },
    "PRSQ": { emoji: "🐌", name: "籠城カタツムリ", jp: "身体×緊張緩和×独×静", color: "#2a7040", desc: "体はしんどくても緊張で保っている。帰宅したり一段落した瞬間に崩れが表に出る。崩れたあとはひとりで静かにこもることで少しずつ戻っていける。" },
    "PRTA": { emoji: "🐬", name: "大放出イルカ", jp: "身体×緊張緩和×群×動", color: "#0070a0", desc: "体はしんどくても場の空気や緊張で乗り切れてしまう。緊張が解けた瞬間に崩れが表に出る。崩れたあとは仲間と一緒に動いて発散することで一気に回復できる。" },
    "PRTQ": { emoji: "🐰", name: "よりそいウサギ", jp: "身体×緊張緩和×群×静", color: "#b04080", desc: "体はしんどくても緊張で保っている。帰宅したり一段落すると崩れが表に出る。崩れたあとは誰かとゆっくり過ごすことで安心感が戻ってくる。" },
    "MESA": { emoji: "🐦‍⬛", name: "暗躍カラス", jp: "精神×蓄積×独×動", color: "#4040b0", desc: "気持ちの疲れが溜まるほど崩れやすくなる。崩れたあとはひとりで体を動かして頭を空っぽにする。考えすぎを動きで強制的に断ち切るタイプ。" },
    "MESQ": { emoji: "🦉", name: "夜明け待ちフクロウ", jp: "精神×蓄積×独×静", color: "#3030a0", desc: "気持ちの疲れが蓄積するほど崩れやすくなる。崩れたあとはひとりで静かにいることで回復できる。自分のペースで感情を整理する時間が必要なタイプ。" },
    "META": { emoji: "🐋", name: "爆発シャチ", jp: "精神×蓄積×群×動", color: "#0090a0", desc: "気持ちの疲れが溜まるほど崩れやすくなる。崩れたあとは仲間と一緒に動いて感情を発散する。体を使って外に出すことで気持ちが軽くなる。" },
    "METQ": { emoji: "🐼", name: "密着パンダ", jp: "精神×蓄積×群×静", color: "#555555", desc: "気持ちの疲れが蓄積するほど崩れやすくなる。崩れたあとは誰かにそばにいてもらうことで回復できる。言葉より存在、安心できる人がいるだけで十分。" },
    "MRSA": { emoji: "🦦", name: "気まぐれカワウソ", jp: "精神×緊張緩和×独×動", color: "#906020", desc: "気持ちはしんどくても緊張している間は保てる。気が緩んだ瞬間に崩れが表に出る。崩れてもひとりで体を動かすことですぐ切り替えられる。立ち直りが早い方だと思う。" },
    "MRSQ": { emoji: "🦥", name: "脱力ナマケモノ", jp: "精神×緊張緩和×独×静", color: "#408040", desc: "気持ちはしんどくても緊張で保っている。気が緩んだ瞬間にずるずる沈んでいく。ひとりで静かにいることで少しずつ戻っていける。時間をかけてじわじわ回復するタイプ。" },
    "MRTA": { emoji: "🦩", name: "急上昇フラミンゴ", jp: "精神×緊張緩和×群×動", color: "#c02080", desc: "気持ちはしんどくても緊張で保っている。気が緩んだ瞬間に崩れが表に出る。崩れても仲間と一緒に動くことで一気にテンションが戻る。人のエネルギーに引っ張られて回復できる。" },
    "MRTQ": { emoji: "🦫", name: "ぽかぽかカピバラ", jp: "精神×緊張緩和×群×静", color: "#907020", desc: "気持ちはしんどくても緊張で保っている。気が緩んだ瞬間にのんびりモードに入って崩れが表に出る。誰かとゆったり過ごすことが一番の回復になる。" },
  };

  const [recoveryTypeFull, setRecoveryTypeFull] = useState(null);
  const [recoveryAxes, setRecoveryAxes] = useState(null); // { cause, timing, style, means } 0..100 toward first pole
  const [diagnosedAt, setDiagnosedAt] = useState(null);
  const [typeLoading, setTypeLoading] = useState(false);

  // Sync settings to the account (debounced) so they follow the user across devices.
  // Placed here (after all referenced state is declared) to avoid a TDZ in the dependency array.
  useEffect(() => {
    if (!user) return;
    const next = buildSettings();
    const current = user.user_metadata?.settings || null;
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    const t = setTimeout(() => { supabase.auth.updateUser({ data: { settings: next } }); }, 1500);
    return () => clearTimeout(t);
  }, [user, recoveryItems, eventItems, actionItems, motiveItems, trackPeriod, periodDates, recoveryTypeFull, recoveryAxes, diagnosedAt, sectionOrder, tone]);

  useEffect(() => { try { localStorage.setItem("kuzure_tone", tone); } catch {} }, [tone]);
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [tagPopup, setTagPopup] = useState(null);

  const TAG_EXPLANATIONS = {
    "身体": { title: "崩れの原因（身体 or 精神）", items: [["P", "Physical（身体）", "身体が原因で崩れる。肉体的な疲れや不調が引き金になる。"], ["M", "Mental（精神）", "精神が原因で崩れる。気持ちの疲れやストレスが引き金になる。"]] },
    "精神": { title: "崩れの原因（身体 or 精神）", items: [["P", "Physical（身体）", "身体が原因で崩れる。肉体的な疲れや不調が引き金になる。"], ["M", "Mental（精神）", "精神が原因で崩れる。気持ちの疲れやストレスが引き金になる。"]] },
    "蓄積": { title: "崩れのタイミング（蓄積 or 緊張緩和）", items: [["E", "Exhaustion（蓄積疲弊）", "疲れが蓄積して崩れる。限界まで溜め込んでから崩れるタイプ。"], ["R", "Release（緊張緩和）", "緊張が解けたときに崩れる。気が緩んだ瞬間に崩れるタイプ。"]] },
    "緊張緩和": { title: "崩れのタイミング（蓄積 or 緊張緩和）", items: [["E", "Exhaustion（蓄積疲弊）", "疲れが蓄積して崩れる。限界まで溜め込んでから崩れるタイプ。"], ["R", "Release（緊張緩和）", "緊張が解けたときに崩れる。気が緩んだ瞬間に崩れるタイプ。"]] },
    "独": { title: "回復スタイル（独 or 群）", items: [["S", "Solo（独）", "ひとりで回復する。人といると疲れが取れない。"], ["T", "Together（群）", "人と一緒に回復する。ひとりでいると逆に沈んでしまう。"]] },
    "群": { title: "回復スタイル（独 or 群）", items: [["S", "Solo（独）", "ひとりで回復する。人といると疲れが取れない。"], ["T", "Together（群）", "人と一緒に回復する。ひとりでいると逆に沈んでしまう。"]] },
    "動": { title: "回復の手段（動 or 静）", items: [["A", "Active（動）", "動いて回復する。体を使う方が気持ちがリセットされる。"], ["Q", "Quiet（静）", "静かに回復する。じっとしている方が回復できる。"]] },
    "静": { title: "回復の手段（動 or 静）", items: [["A", "Active（動）", "動いて回復する。体を使う方が気持ちがリセットされる。"], ["Q", "Quiet（静）", "静かに回復する。じっとしている方が回復できる。"]] },
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
        崩れ: l.kuzure ? "あり" : "なし",
        疲労: FATIGUE_LABELS[l.fatigue],
        イベント: (l.events||[]).join("・"),
        気持ち: (l.motives||[]).join("・"),
        試したこと: (l.recovery||[]).join("・"),
        生理中: l.isPeriod ? "あり" : "なし",
      }));

      const res = await callAnalyze({
          model: "claude-sonnet-4-6",
          max_tokens: 80,
          temperature: 0,
          messages: [{
            role: "user",
            content: `以下のログデータから、この人の回復傾向を4つの軸で0〜100のスコアで判定してください。各軸、左の特性に近いほど100、右に近いほど0、50は中間です。

軸1 身体(100)←→精神(0)：崩れの原因が身体的か精神的か
軸2 蓄積(100)←→緊張緩和(0)：疲れを溜め込んで崩れるか、緊張が解けた瞬間に崩れるか
軸3 独(100)←→群(0)：ひとりで回復するか、人と一緒に回復するか
軸4 動(100)←→静(0)：体を動かして回復するか、静かにして回復するか

次の形式で数字だけ返してください（他の文章は不要）：
身体=62
蓄積=38
独=71
動=45

ログ：${JSON.stringify(summary)}`
          }]
        });
      if (res.status === 401) { setTypeLoading(false); return; }
      const data = await res.json();
      const text = (data.content||[]).map((c) => c.text||"").join("");
      const num = (label) => { const m = text.match(new RegExp(label + "\\s*[=＝:：]\\s*(\\d+)")); return m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : null; };
      const cause = num("身体"), timing = num("蓄積"), style = num("独"), means = num("動");
      if ([cause, timing, style, means].every((v) => v !== null)) {
        const code = (cause >= 50 ? "P" : "M") + (timing >= 50 ? "E" : "R") + (style >= 50 ? "S" : "T") + (means >= 50 ? "A" : "Q");
        const axes = { cause, timing, style, means };
        if (RECOVERY_TYPES[code]) {
          setRecoveryTypeFull(RECOVERY_TYPES[code]);
          setRecoveryAxes(axes);
          const now = new Date();
          const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()}`;
          setDiagnosedAt(dateStr);
          try {
            localStorage.setItem("kuzure_recovery_type", code);
            localStorage.setItem("kuzure_recovery_axes", JSON.stringify(axes));
            localStorage.setItem("kuzure_recovery_type_date", dateStr);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error(e);
    }
    setTypeLoading(false);
  };

  // Renders the 4 MBTI-style axis bars for the recovery type.
  const renderAxisBars = (axes, color) => {
    if (!axes) return null;
    const rows = [
      ["原因", "身体", "精神", axes.cause],
      ["タイミング", "蓄積", "緊張緩和", axes.timing],
      ["スタイル", "ひとり", "みんな", axes.style],
      ["手段", "動く", "静か", axes.means],
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {rows.map(([axis, left, right, score]) => {
          const mid = Math.abs(score - 50) <= 8;
          const leftWins = score >= 50;
          return (
            <div key={axis}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: leftWins ? 700 : 400, color: leftWins ? color : "#aaa" }}>{left}</span>
                <span style={{ fontSize: 10, color: "#bbb" }}>{mid ? "ほぼ中間" : (leftWins ? `${left} ${score}%` : `${right} ${100 - score}%`)}</span>
                <span style={{ fontSize: 11, fontWeight: !leftWins ? 700 : 400, color: !leftWins ? color : "#aaa" }}>{right}</span>
              </div>
              <div style={{ position: "relative", height: 8, borderRadius: 99, background: "#ece8e0" }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${score}%`, background: color, borderRadius: 99, opacity: 0.85 }} />
                <div style={{ position: "absolute", left: `calc(${score}% - 1px)`, top: -2, width: 2, height: 12, background: "#1a1a1a", opacity: 0.25 }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Strip markdown artifacts (asterisks, bullets, leading numbers) the model may emit.
  const cleanLine = (t) => (t || "")
    .replace(/\*\*/g, "")
    .replace(/^\s*([-*•・►▶◦]|\d+[.)、）])\s*/, "")
    .replace(/[*#`>]/g, "")
    .replace(/^(SUMMARY|DETAIL)[:：]?\s*/i, "")
    .trim();

  // Split the AI response into a one-line summary + a few clean detail points.
  const parseAnalysis = (raw) => {
    const sm = raw.match(/SUMMARY[:：]?\s*([\s\S]*?)(?=DETAIL|NEXT|$)/i);
    const dm = raw.match(/DETAIL[:：]?\s*([\s\S]*?)(?=NEXT|$)/i);
    const nm = raw.match(/NEXT[:：]?\s*([\s\S]*)/i);
    const summary = cleanLine((sm ? sm[1] : (raw.split("\n")[0] || "")).trim());
    const detailRaw = (dm ? dm[1] : "").trim();
    const points = detailRaw.split("\n").map(cleanLine).filter((l) => l.length > 1).map((l) => {
      const parts = l.split(/[｜|]/);
      return parts.length >= 2
        ? { title: parts[0].trim(), body: parts.slice(1).join("").trim() }
        : { title: "", body: l };
    });
    const next = (nm ? nm[1] : "").trim().split("\n").map(cleanLine).filter(Boolean).join(" ");
    return { summary, points, next };
  };

  // Monthly report: summary + insight cards + a hint for next month.
  const parseReport = (raw) => {
    const sm = raw.match(/SUMMARY[:：]?\s*([\s\S]*?)(?=DETAIL|NEXT|$)/i);
    const dm = raw.match(/DETAIL[:：]?\s*([\s\S]*?)(?=NEXT|$)/i);
    const nm = raw.match(/NEXT[:：]?\s*([\s\S]*)/i);
    const summary = cleanLine((sm ? sm[1] : "").trim());
    const points = (dm ? dm[1] : "").trim().split("\n").map(cleanLine).filter((l) => l.length > 1).map((l) => {
      const p = l.split(/[｜|]/);
      return p.length >= 2 ? { title: p[0].trim(), body: p.slice(1).join("").trim() } : { title: "", body: l };
    });
    const next = (nm ? nm[1] : "").trim().split("\n").map(cleanLine).filter(Boolean).join(" ");
    return { summary, points, next };
  };

  const runMonthlyReport = async () => {
    const y = reportMonth.getFullYear(), m = reportMonth.getMonth();
    const mk = `${y}/${m + 1}`;
    const monthLogs = logs.filter((l) => monthKeyOf(l.date) === mk);
    if (monthLogs.length < 3) return;
    setReportLoading(true);
    try {
      const data = monthLogs.map((l) => ({
        日付: l.date, 睡眠満足度: SLEEP_LABELS[l.sleep], 疲労感: FATIGUE_LABELS[l.fatigue],
        イベント: (l.events || []).join("・"), 崩れ: l.kuzure ? "あり" : "なし",
        崩れ行動: (l.actions || []).join("・"), 気持ち: (l.motives || []).join("・"),
        試したこと: (l.recovery || []).join("・"), メモ: l.memo || "",
      }));
      const res = await callAnalyze({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `以下は私の${m + 1}月の崩れログのデータです。1ヶ月分のふりかえりレポートを、${toneInstruction()}

ルール：
- 具体的な日付やイベントを根拠に述べること
- 良かった点と、気をつけたい点の両方に触れること
- 記号（アスタリスク*、シャープ#、中黒・、番号）は一切使わない
- 最後に来月へ向けた前向きで具体的な一言を添える

出力フォーマット（このラベルは必ず使う）：
SUMMARY: 今月を総括する1文
DETAIL:
気づきを2〜3個、各行「見出し｜本文」の形式で（見出しは12文字以内）。区切りは全角の縦棒「｜」。行間は空けない
NEXT: 来月に向けたヒントを1〜2文で

データ：
${JSON.stringify(data, null, 2)}`
        }]
      });
      if (res.status === 401) { setReports((p) => ({ ...p, [mk]: "__LOGIN__" })); setReportLoading(false); return; }
      const j = await res.json();
      const text = (j.content || []).map((c) => c.text || "").join("");
      if (text) { try { localStorage.setItem("kuzure_used_ai", "1"); } catch {} }
      setReports((p) => ({ ...p, [mk]: text || "__FAIL__" }));
    } catch {
      setReports((p) => ({ ...p, [reportMonth.getFullYear() + "/" + (reportMonth.getMonth() + 1)]: "__FAIL__" }));
    }
    setReportLoading(false);
  };

  // ── history helpers ──────────────────────────────────────
  const shortDate = (d) => { const p = d.split("/"); return `${+p[1]}/${+p[2]}`; };
  const monthLabel = (d) => { const p = d.split("/"); return `${p[0]}年${+p[1]}月`; };
  const monthKeyOf = (d) => { const p = d.split("/"); return `${+p[0]}/${+p[1]}`; };

  // This month vs last month: kuzure count, days recorded, avg fatigue.
  const computeSummary = () => {
    const now = new Date();
    const curKey = `${now.getFullYear()}/${now.getMonth() + 1}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prev.getFullYear()}/${prev.getMonth() + 1}`;
    const cur = logs.filter((l) => monthKeyOf(l.date) === curKey);
    const pre = logs.filter((l) => monthKeyOf(l.date) === prevKey);
    const kuzureCount = (arr) => arr.filter((l) => l.kuzure).length;
    const avg = (arr) => (arr.length ? arr.reduce((s, l) => s + (l.fatigue || 0), 0) / arr.length : 0);
    return { month: now.getMonth() + 1, days: cur.length, kuzure: kuzureCount(cur), prevKuzure: kuzureCount(pre), hasPrev: pre.length > 0, avgFatigue: avg(cur) };
  };

  // Normalize a stored date ("2026/06/08" or "2026/6/8") to a numeric key "2026/6/8".
  const dayKey = (d) => d.split("/").map(Number).join("/");
  const keyOfDate = (dt) => `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}`;

  // Current run of consecutive recorded days, ending today or yesterday.
  const computeStreak = () => {
    const set = new Set(logs.map((l) => dayKey(l.date)));
    const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
    if (!set.has(keyOfDate(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!set.has(keyOfDate(cursor))) return 0;
    }
    let streak = 0;
    while (set.has(keyOfDate(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
    return streak;
  };

  // Stats used to decide which badges are unlocked.
  const computeBadgeStats = () => {
    const byKey = {};
    logs.forEach((l) => { byKey[dayKey(l.date)] = l; });
    const toDate = (k) => { const [y, m, d] = k.split("/").map(Number); return new Date(y, m - 1, d); };
    const sortedKeys = Object.keys(byKey).sort((a, b) => toDate(a) - toDate(b));
    const DAY = 86400000;

    let maxStreak = 0, run = 0, maxCleanRun = 0, cleanRun = 0, prev = null;
    sortedKeys.forEach((k) => {
      const dt = toDate(k);
      run = prev && (dt - prev) === DAY ? run + 1 : 1;
      maxStreak = Math.max(maxStreak, run);
      const clean = !byKey[k].kuzure;
      cleanRun = run === 1 ? (clean ? 1 : 0) : (clean ? cleanRun + 1 : 0);
      maxCleanRun = Math.max(maxCleanRun, cleanRun);
      prev = dt;
    });

    let recovered = false;
    for (let i = 0; i < sortedKeys.length - 1; i++) {
      const a = toDate(sortedKeys[i]), b = toDate(sortedKeys[i + 1]);
      if ((b - a) === DAY && byKey[sortedKeys[i]].kuzure && (byKey[sortedKeys[i + 1]].recovery || []).length > 0) { recovered = true; break; }
    }

    const memoCount = logs.filter((l) => (l.memo && l.memo.trim()) || (l.eventMemo && l.eventMemo.trim())).length;
    let usedAi = false; try { usedAi = localStorage.getItem("kuzure_used_ai") === "1"; } catch {}
    return { total: logs.length, maxStreak, maxCleanRun, recovered, memoCount, usedAi };
  };

  const BADGES = [
    { emoji: "🌱", title: "はじめの一歩", desc: "はじめて記録した", earned: (s) => s.total >= 1 },
    { emoji: "🔥", title: "3日連続", desc: "3日続けて記録した", earned: (s) => s.maxStreak >= 3 },
    { emoji: "📅", title: "記録7日", desc: "通算7日記録した", earned: (s) => s.total >= 7 },
    { emoji: "🔥", title: "7日連続", desc: "7日続けて記録した", earned: (s) => s.maxStreak >= 7 },
    { emoji: "🛡️", title: "崩れゼロ週間", desc: "7日連続で崩れなし", earned: (s) => s.maxCleanRun >= 7 },
    { emoji: "🔁", title: "立て直し上手", desc: "崩れた翌日に回復行動を記録した", earned: (s) => s.recovered },
    { emoji: "📝", title: "記録魔", desc: "メモを10回書いた", earned: (s) => s.memoCount >= 10 },
    { emoji: "🧭", title: "自己分析家", desc: "AI分析を使った", earned: (s) => s.usedAi },
    { emoji: "📅", title: "記録30日", desc: "通算30日記録した", earned: (s) => s.total >= 30 },
    { emoji: "🔥", title: "30日連続", desc: "30日続けて記録した", earned: (s) => s.maxStreak >= 30 },
    { emoji: "📅", title: "記録100日", desc: "通算100日記録した", earned: (s) => s.total >= 100 },
  ];

  // Group logs (already sorted desc) into months, preserving order.
  const groupByMonth = () => {
    const groups = [];
    const idx = {};
    logs.forEach((l) => {
      const mk = monthLabel(l.date);
      if (idx[mk] === undefined) { idx[mk] = groups.length; groups.push({ key: mk, items: [] }); }
      groups[idx[mk]].items.push(l);
    });
    return groups;
  };

  const logByDay = () => { const m = {}; logs.forEach((l) => { m[dayKey(l.date)] = l; }); return m; };

  // Weekly trend: number of 崩れ per week as a simple bar chart (lower = better).
  const renderTrend = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const curWeekStart = new Date(today); curWeekStart.setDate(today.getDate() - today.getDay());
    const MAX_WEEKS = 8;
    // Start from the first record's week, but show at most MAX_WEEKS.
    let count = MAX_WEEKS;
    if (logs.length) {
      const [oy, om, od] = dayKey(logs[logs.length - 1].date).split("/").map(Number);
      const oldest = new Date(oy, om - 1, od);
      const oldestWeek = new Date(oldest); oldestWeek.setDate(oldest.getDate() - oldest.getDay());
      const weeksSpan = Math.round((curWeekStart - oldestWeek) / (7 * 86400000)) + 1;
      count = Math.min(MAX_WEEKS, Math.max(1, weeksSpan));
    }
    const weeks = [];
    for (let w = count - 1; w >= 0; w--) {
      const ws = new Date(curWeekStart); ws.setDate(curWeekStart.getDate() - w * 7);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      weeks.push({ start: ws, end: we, kuzure: 0, total: 0 });
    }
    logs.forEach((l) => {
      const [y, m, d] = dayKey(l.date).split("/").map(Number);
      const dt = new Date(y, m - 1, d);
      const wk = weeks.find((w) => dt >= w.start && dt <= w.end);
      if (wk) { wk.total++; if (l.kuzure) wk.kuzure++; }
    });
    const maxK = Math.max(1, ...weeks.map((w) => w.kuzure));
    return (
      <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 16, padding: "14px 16px", marginTop: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.08em", margin: "0 0 4px" }}>崩れの推移（週ごと）</p>
        <p style={{ fontSize: 11, color: "#b0a898", margin: "0 0 14px" }}>棒が低い週ほど崩れが少なめです</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
          {weeks.map((wk, i) => {
            const h = wk.total === 0 ? 0 : Math.round((wk.kuzure / maxK) * 64) + (wk.kuzure > 0 ? 6 : 3);
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: wk.total === 0 ? "#ddd" : "#e0503a", marginBottom: 3 }}>{wk.total === 0 ? "–" : wk.kuzure}</span>
                <div style={{ width: "72%", height: h, minHeight: wk.total === 0 ? 0 : 3, background: wk.kuzure > 0 ? "#e0503a" : "#d9e8d9", borderRadius: "4px 4px 0 0" }} />
                <span style={{ fontSize: 9, color: "#aaa", marginTop: 5 }}>{wk.start.getMonth() + 1}/{wk.start.getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Month calendar: tap a recorded day to view/edit it below the grid.
  const renderCalendar = () => {
    const byKey = logByDay();
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const startPad = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let dd = 1; dd <= daysInMonth; dd++) cells.push(dd);
    const now = new Date();
    const atCurrent = y === now.getFullYear() && m === now.getMonth();
    const sel = logs.find((l) => (l.id || l.date) === openLogKey);
    const WD = ["日", "月", "火", "水", "木", "金", "土"];
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0 10px" }}>
          <button onClick={() => setCalMonth(new Date(y, m - 1, 1))} style={{ fontSize: 18, width: 32, height: 32, border: "1.5px solid #e4e0d8", borderRadius: 10, background: "#fff", color: "#888", cursor: "pointer" }}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{y}年{m + 1}月</span>
          <button onClick={() => !atCurrent && setCalMonth(new Date(y, m + 1, 1))} disabled={atCurrent} style={{ fontSize: 18, width: 32, height: 32, border: "1.5px solid #e4e0d8", borderRadius: 10, background: "#fff", color: atCurrent ? "#ddd" : "#888", cursor: atCurrent ? "default" : "pointer" }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {WD.map((w, i) => (
            <div key={w} style={{ textAlign: "center", fontSize: 10, color: i === 0 ? "#d0604a" : i === 6 ? "#5a7ac0" : "#aaa" }}>{w}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((dd, i) => {
            if (!dd) return <div key={i} />;
            const log = byKey[`${y}/${m + 1}/${dd}`];
            const bg = log ? (log.kuzure ? "#fdecea" : "#eaf6ea") : "#faf9f7";
            const dot = log ? (log.kuzure ? "#e0503a" : "#7bc47f") : null;
            const selected = log && (log.id || log.date) === openLogKey;
            return (
              <div key={i} onClick={() => log && setOpenLogKey(selected ? null : (log.id || log.date))}
                style={{ aspectRatio: "1", borderRadius: 9, background: bg, border: selected ? "1.5px solid #5a35c8" : "1.5px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: log ? "pointer" : "default", gap: 3 }}>
                <span style={{ fontSize: 12, color: log ? "#444" : "#ccc", fontWeight: log ? 600 : 400 }}>{dd}</span>
                {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />}
              </div>
            );
          })}
        </div>
        {sel && (
          <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 14, padding: "2px 14px", marginTop: 12 }}>
            <LogRow e={sel} />
          </div>
        )}
      </div>
    );
  };

  // Compact one-line log row that expands to full detail on tap.
  const LogRow = ({ e }) => {
    const open = openLogKey === (e.id || e.date);
    const btn = { fontSize: 11, padding: "3px 10px", borderRadius: 99, background: "#fff", cursor: "pointer" };
    return (
      <div style={{ borderBottom: "1px solid #f0ece4" }}>
        <div onClick={() => setOpenLogKey(open ? null : (e.id || e.date))}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 2px", cursor: "pointer" }}>
          <span style={{ fontSize: 12, color: "#999", width: 38, flexShrink: 0 }}>{shortDate(e.date)}</span>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: e.kuzure ? "#e0503a" : "#cfc8bc", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#666", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(e.events || []).join("・") || "—"}</span>
          <span style={{ fontSize: 15, color: "#ccc", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
        </div>
        {open && (
          <div style={{ padding: "2px 2px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "#bbb" }}>{prevDay(e.date)}のできごと・{e.date}記録</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEdit(e)} style={{ ...btn, border: "1px solid #e4e0d8", color: "#888" }}>編集</button>
                <button onClick={() => setConfirmDelete({ label: e.date, onConfirm: () => deleteLog(e.date) })} style={{ ...btn, border: "1px solid #ffd0d0", color: "#c02020" }}>削除</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#aaa", marginBottom: 8 }}>
              <span>睡眠 <b style={{ color: "#5a35c8" }}>{e.sleep}/5</b></span>
              <span>疲労 <b style={{ color: "#c04820" }}>{FATIGUE_LABELS[e.fatigue]}</b></span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {e.kuzure
                ? <><span style={S.tag("#fff0ee", "#c02020")}>崩れあり</span>{(e.actions || []).map((a) => <span key={a} style={S.tag("#fff0ee", "#c02020")}>{a}</span>)}</>
                : <span style={S.tag("#f0ecff", "#5a35c8")}>崩れなし</span>}
            </div>
            {(e.recovery || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: 4 }}>
                {(e.recovery || []).map((r) => <span key={r} style={S.tag("#edfaf2", "#1a6030")}>{r}</span>)}
              </div>
            )}
            {e.eventMemo && <p style={{ fontSize: 12, color: "#aaa", margin: "6px 0 0", lineHeight: 1.5 }}>{e.eventMemo}</p>}
            {e.memo && <p style={{ fontSize: 12, color: "#888", margin: "6px 0 0", lineHeight: 1.5 }}>{e.memo}</p>}
          </div>
        )}
      </div>
    );
  };

  // Compact locked row shown for AI sections when logged out.
  const aiLockRow = (label) => (
    <div onClick={() => setShowAuthModal(true)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f3effb", border: "1.5px solid #e0d8f5", borderRadius: 12, padding: "11px 14px", marginBottom: 12, cursor: "pointer" }}>
      <span style={{ fontSize: 15 }}>🔒</span>
      <span style={{ fontSize: 12.5, color: "#7a5fd0", fontWeight: 600, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, color: "#9a8fc0", textDecoration: "underline" }}>ログイン</span>
    </div>
  );

  // "今日のひとこと": state + best recovery action from the user's own data, phrased by tone.
  const hintText = (state, action) => {
    const t = TONES[tone] ? tone : "normal";
    if (state === "fewdata") {
      return { gentle: "「試したこと」も記録すると、あなたに効くケアを提案できるよ", normal: "「試したこと」の記録が増えると、データに基づいた提案ができるようになります", straight: "「試したこと」を記録して。提案はそれから。", cheer: "いいスタート！「試したこと」も記録すれば、ピッタリの提案ができるよ🌱" }[t];
    }
    if (state === "good") {
      return { gentle: `いい調子！「${action}」みたいな自分に合うこと、この調子で続けてこ`, normal: `直近は崩れが見られません。「${action}」など効果的な習慣を継続できています`, straight: `崩れなし。「${action}」継続でOK。`, cheer: `絶好調！「${action}」が効いてるね、その調子！` }[t];
    }
    const head = state === "rough"
      ? { gentle: "最近ちょっとお疲れ気味かも。", normal: "直近で崩れが続いています。", straight: "最近崩れ気味。", cheer: "最近ちょっとお疲れ？でも大丈夫、" }[t]
      : { gentle: "ちょっと崩れた日があったね。", normal: "直近で崩れが見られます。", straight: "崩れあり。", cheer: "崩れた日もあったけど、" }[t];
    const tail = { gentle: `立て直すなら「${action}」が効いてるみたい。無理せずいこ`, normal: `「${action}」をした日は崩れにくい傾向です`, straight: `「${action}」が効く。やろう。`, cheer: `「${action}」でいつも立て直せてるよ、やってみよ！` }[t];
    return head + tail;
  };

  // Login-only: let AI rewrite today's hint in the chosen tone (cached per day).
  const runDailyHint = async (state, action, reason) => {
    if (!action) return;
    setAiHintLoading(true);
    try {
      const stateLabel = { rough: "最近、崩れが続いている", mild: "直近で崩れた日があった", good: "最近は崩れていない" }[state] || "ふつう";
      const res = await callAnalyze({
        model: "claude-sonnet-4-6", max_tokens: 150,
        messages: [{ role: "user", content: `あなたは私の崩れログを見守るパートナーです。今日の「ひとこと」を1〜2文で書いてください。
${toneInstruction()}
今の状況: ${stateLabel}
さりげなく勧めたい回復行動: 「${action}」
根拠データ: ${reason}
ルール: 記号（*#・番号）は使わない。短く。説教くさくしない。「${action}」を自然に織り込む。ひとことだけ返す。` }],
      });
      if (res.status === 401) { setAiHintLoading(false); return; }
      const data = await res.json();
      const text = (data.content || []).map((c) => c.text || "").join("").split("\n").map(cleanLine).filter(Boolean).join(" ");
      if (text) {
        const h = { date: todayStr(), text };
        setAiHint(h);
        try { localStorage.setItem("kuzure_ai_hint", JSON.stringify(h)); localStorage.setItem("kuzure_used_ai", "1"); } catch {}
      }
    } catch {}
    setAiHintLoading(false);
  };

  const renderHint = () => {
    if (!logs.length) return null;
    const recentK = logs.slice(0, 3).filter((l) => l.kuzure).length;
    const rStats = {};
    logs.forEach((l) => (l.recovery || []).forEach((r) => { (rStats[r] = rStats[r] || { no: 0, tot: 0 }); rStats[r].tot++; if (!l.kuzure) rStats[r].no++; }));
    let action = null, best = null;
    Object.entries(rStats).forEach(([r, s]) => { if (s.no >= 1 && s.no > (best?.no || 0)) { best = s; action = r; } });
    let state;
    if (logs.length < 3 || !action) state = "fewdata";
    else if (recentK >= 2) state = "rough";
    else if (recentK === 1) state = "mild";
    else state = "good";
    const reason = action ? `「${action}」をした${best.tot}日のうち${best.no}日は崩れずに済んでいます${recoveryTypeFull ? `。回復タイプ「${recoveryTypeFull.name}」のあなたにも合っています` : ""}` : "";
    const aiActive = aiHint && aiHint.date === todayStr();
    const displayMsg = aiActive ? aiHint.text : hintText(state, action);
    return (
      <div style={{ background: "linear-gradient(135deg,#fffaf0,#fff3e0)", border: "1.5px solid #f3d9a8", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#c08a30", letterSpacing: "0.04em", margin: "0 0 8px" }}>💬 今日のひとこと{aiActive && <span style={{ fontSize: 10, fontWeight: 600, color: "#b08020", marginLeft: 6 }}>✨AI</span>}</p>
        <p style={{ fontSize: 14, color: "#5a4a2a", lineHeight: 1.7, margin: 0, fontWeight: 600 }}>{displayMsg}</p>
        {reason && (
          <>
            <button onClick={() => setShowHintWhy((v) => !v)} style={{ fontSize: 11, color: "#c0a060", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 8 }}>{showHintWhy ? "とじる ▲" : "なんで？ ▼"}</button>
            {showHintWhy && <p style={{ fontSize: 12, color: "#8a7a5a", lineHeight: 1.7, margin: "6px 0 0" }}>{reason}</p>}
          </>
        )}
        {user && action && !aiActive && (
          <div style={{ marginTop: 10 }}>
            {aiHintLoading ? (
              <span style={{ fontSize: 12, color: "#c0a060" }}>考え中...</span>
            ) : (
              <button onClick={() => runDailyHint(state, action, reason)} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#d9a441", border: "none", borderRadius: 99, padding: "6px 14px", cursor: "pointer" }}>AIに書いてもらう ✨</button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Renders one dashboard section by key (used by the reorderable history tab).
  const renderSection = (key) => {
    if (key === "summary") {
      const s = computeSummary();
      const diff = s.kuzure - s.prevKuzure;
      const diffLabel = diff === 0 ? "±0" : diff < 0 ? `↓${-diff}` : `↑${diff}`;
      const diffColor = diff < 0 ? "#1a8a4a" : diff > 0 ? "#c02020" : "#aaa";
      return (
        <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.08em", margin: "0 0 12px" }}>{s.month}月のふりかえり</p>
          <div style={{ display: "flex" }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: 24, fontWeight: 800, color: "#e0503a", margin: 0, lineHeight: 1 }}>{s.kuzure}<span style={{ fontSize: 12, fontWeight: 400, color: "#aaa" }}>回</span></p>
              <p style={{ fontSize: 10, color: "#999", margin: "5px 0 0" }}>崩れ</p>
              {s.hasPrev && <p style={{ fontSize: 10, color: diffColor, margin: "2px 0 0", fontWeight: 700 }}>先月{s.prevKuzure}回 {diffLabel}</p>}
            </div>
            <div style={{ flex: 1, textAlign: "center", borderLeft: "1px solid #eee" }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#c04820", margin: 0, lineHeight: 1.5 }}>{s.days ? FATIGUE_LABELS[Math.round(s.avgFatigue)] : "—"}</p>
              <p style={{ fontSize: 10, color: "#999", margin: "5px 0 0" }}>平均疲労</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", borderLeft: "1px solid #eee" }}>
              <p style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a", margin: 0, lineHeight: 1 }}>{s.days}<span style={{ fontSize: 12, fontWeight: 400, color: "#aaa" }}>日</span></p>
              <p style={{ fontSize: 10, color: "#999", margin: "5px 0 0" }}>記録</p>
            </div>
          </div>
        </div>
      );
    }
    if (key === "streak") {
      const streak = computeStreak();
      if (streak < 2) return null;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#fff3e0,#ffe2c4)", border: "1.5px solid #f5c98a", borderRadius: 14, padding: "12px 16px", marginBottom: 12 }}>
          <span style={{ fontSize: 26 }}>🔥</span>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#c05a00", margin: 0 }}>{streak}日連続で記録中！</p>
            <p style={{ fontSize: 11, color: "#c08a50", margin: "2px 0 0" }}>この調子で続けよう</p>
          </div>
        </div>
      );
    }
    if (key === "pattern") {
      if (!user) return aiLockRow("AIパターン分析（ログインで解放）");
      return (
        <div style={{ ...S.patternBox, marginTop: 0, marginBottom: 12 }}>
          <div style={{ ...S.secHead, marginBottom: 10 }}><div style={S.secBar("#5a35c8")}/><span style={{ ...S.secLabel, color: "#5a35c8" }}>パターン分析</span></div>
          {!aiAnalysis && !aiLoading && logs.length >= 3 && (
            <button onClick={runAiAnalysis} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, border: "none", borderRadius: 12, background: "#5a35c8", color: "#fff", cursor: "pointer" }}>AIで分析する</button>
          )}
          {!aiAnalysis && !aiLoading && logs.length < 3 && (
            <p style={{ fontSize: 13, color: "#b0a898", margin: 0, textAlign: "center" }}>あと{3 - logs.length}日記録するとAI分析できます</p>
          )}
          {aiLoading && <p style={{ fontSize: 13, color: "#9a80d0", textAlign: "center", margin: 0 }}>分析中...</p>}
          {aiAnalysis && (
            <>
              {(() => {
                const { summary, points, next } = parseAnalysis(aiAnalysis);
                return (
                  <>
                    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "#fff", border: "1.5px solid #d6ccf5", borderRadius: 14, padding: "13px 15px", marginBottom: points.length ? 10 : 0 }}>
                      <span style={{ fontSize: 18, lineHeight: 1.5, flexShrink: 0 }}>💡</span>
                      <p style={{ fontSize: 14.5, color: "#3a2a7a", lineHeight: 1.75, margin: 0, fontWeight: 700 }}>{summary}</p>
                    </div>
                    {points.length > 0 && !showFullAnalysis && (
                      <button onClick={() => setShowFullAnalysis(true)} style={{ fontSize: 12, color: "#9a80d0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>くわしく見る ▼</button>
                    )}
                    {points.length > 0 && showFullAnalysis && (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: 9, margin: "4px 0 10px" }}>
                          {points.map((p, i) => (
                            <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", border: "1px solid #ece6f8", borderLeft: "3px solid #5a35c8" }}>
                              {p.title && <p style={{ fontSize: 13.5, fontWeight: 800, color: "#5a35c8", margin: "0 0 5px", letterSpacing: "-0.2px" }}>{p.title}</p>}
                              <p style={{ fontSize: 13, color: "#4a3a6a", lineHeight: 1.8, margin: 0 }}>{p.body}</p>
                            </div>
                          ))}
                        </div>
                        {next && (
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#eaf6ea", border: "1.5px solid #bfe3bf", borderRadius: 12, padding: "11px 13px", marginBottom: 10 }}>
                            <span style={{ fontSize: 16 }}>🌱</span>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#3a8a4a", margin: "0 0 3px" }}>次の一手</p>
                              <p style={{ fontSize: 13, color: "#3a6a3a", lineHeight: 1.7, margin: 0 }}>{next}</p>
                            </div>
                          </div>
                        )}
                        <button onClick={() => setShowFullAnalysis(false)} style={{ fontSize: 12, color: "#9a80d0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>閉じる ▲</button>
                      </>
                    )}
                  </>
                );
              })()}
              <div style={{ marginTop: 12 }}>
                <button onClick={() => { runAiAnalysis(); setShowFullAnalysis(false); }} style={{ fontSize: 12, color: "#9a80d0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>もう一度分析する</button>
              </div>
            </>
          )}
        </div>
      );
    }
    if (key === "type") {
      if (!user) return aiLockRow("回復タイプ診断（ログインで解放）");
      return (
        <div style={{ marginBottom: 12 }}>
          {logs.length < 7 ? (
            <div style={{ background: "#faf7ff", border: "1.5px dashed #d6ccf5", borderRadius: 16, padding: "16px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#b0a898", margin: 0 }}>7日間記録すると</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#5a35c8", margin: "4px 0 0" }}>回復タイプが診断されます</p>
              <p style={{ fontSize: 11, color: "#c0b8d0", margin: "6px 0 0" }}>あと{Math.max(0, 7 - logs.length)}日</p>
            </div>
          ) : recoveryTypeFull ? (
            <div onClick={() => setSelectedType({ code: Object.keys(RECOVERY_TYPES).find(k => RECOVERY_TYPES[k] === recoveryTypeFull), ...recoveryTypeFull })}
              style={{ background: recoveryTypeFull.color + "15", border: `1.5px solid ${recoveryTypeFull.color}55`, borderRadius: 16, padding: "16px", cursor: "pointer" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: recoveryTypeFull.color, letterSpacing: "0.12em", margin: "0 0 8px" }}>あなたの回復タイプ　→ タップで詳細</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 40 }}>{recoveryTypeFull.emoji}</span>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 900, color: recoveryTypeFull.color, margin: "0 0 2px", fontFamily: "monospace", letterSpacing: "0.1em" }}>{Object.keys(RECOVERY_TYPES).find(k => RECOVERY_TYPES[k] === recoveryTypeFull)}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", margin: "0 0 4px" }}>{recoveryTypeFull.name}</p>
                  <p style={{ fontSize: 10, color: "#999", margin: 0 }}>{recoveryTypeFull.jp}</p>
                  {diagnosedAt && <p style={{ fontSize: 10, color: "#bbb", margin: "2px 0 0" }}>{diagnosedAt}時点（{logs.length}日分）</p>}
                </div>
              </div>
              {renderAxisBars(recoveryAxes, recoveryTypeFull.color)}
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button onClick={(e) => { e.stopPropagation(); runTypeAnalysis(); }} style={{ fontSize: 11, color: typeLoading ? "#ccc" : "#999", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>{typeLoading ? "診断中..." : "再診断する"}</button>
                <button onClick={(e) => { e.stopPropagation(); setShowAllTypes(true); }} style={{ fontSize: 11, color: "#999", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>全タイプを見る</button>
              </div>
            </div>
          ) : (
            <div style={{ background: "#faf7ff", border: "1.5px dashed #d6ccf5", borderRadius: 16, padding: "16px", textAlign: "center" }}>
              {typeLoading ? (
                <p style={{ fontSize: 13, color: "#9a80d0", margin: 0 }}>診断中...</p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "#b0a898", margin: "0 0 10px" }}>7日分のデータが揃いました</p>
                  <button onClick={runTypeAnalysis} style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 12, background: "#5a35c8", color: "#fff", cursor: "pointer", marginBottom: 8 }}>回復タイプを診断する</button>
                  <br/>
                  <button onClick={() => setShowAllTypes(true)} style={{ fontSize: 11, color: "#9a80d0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>全タイプを先に見る</button>
                </>
              )}
            </div>
          )}
        </div>
      );
    }
    if (key === "report") {
      if (!user) return aiLockRow("月次レポート（ログインで解放）");
      const y = reportMonth.getFullYear(), m = reportMonth.getMonth();
      const mk = `${y}/${m + 1}`;
      const monthLogs = logs.filter((l) => monthKeyOf(l.date) === mk);
      const now = new Date();
      const atCurrent = y === now.getFullYear() && m === now.getMonth();
      const report = reports[mk];
      const navBtn = (dir) => () => { setReportMonth(new Date(y, m + dir, 1)); };
      return (
        <div style={{ background: "linear-gradient(135deg,#f3effb,#efe9fb)", border: "1.5px solid #d6ccf5", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#5a35c8", letterSpacing: "0.04em" }}>📖 月次レポート</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={navBtn(-1)} style={{ fontSize: 13, width: 24, height: 24, border: "1px solid #d6ccf5", borderRadius: 8, background: "#fff", color: "#7a5fd0", cursor: "pointer" }}>‹</button>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#5a35c8", minWidth: 38, textAlign: "center" }}>{y}/{m + 1}</span>
              <button onClick={navBtn(1)} disabled={atCurrent} style={{ fontSize: 13, width: 24, height: 24, border: "1px solid #d6ccf5", borderRadius: 8, background: "#fff", color: atCurrent ? "#ccc" : "#7a5fd0", cursor: atCurrent ? "default" : "pointer" }}>›</button>
            </div>
          </div>
          {report && report !== "__LOGIN__" && report !== "__FAIL__" ? (() => {
            const { summary, points, next } = parseReport(report);
            return (
              <>
                <div style={{ background: "#fff", border: "1.5px solid #d6ccf5", borderRadius: 14, padding: "13px 15px", marginBottom: points.length ? 9 : 0 }}>
                  <p style={{ fontSize: 14.5, color: "#3a2a7a", lineHeight: 1.75, margin: 0, fontWeight: 700 }}>{summary}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {points.map((p, i) => (
                    <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", border: "1px solid #ece6f8", borderLeft: "3px solid #5a35c8" }}>
                      {p.title && <p style={{ fontSize: 13.5, fontWeight: 800, color: "#5a35c8", margin: "0 0 5px" }}>{p.title}</p>}
                      <p style={{ fontSize: 13, color: "#4a3a6a", lineHeight: 1.8, margin: 0 }}>{p.body}</p>
                    </div>
                  ))}
                </div>
                {next && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#eaf6ea", border: "1.5px solid #bfe3bf", borderRadius: 12, padding: "11px 13px", marginTop: 9 }}>
                    <span style={{ fontSize: 16 }}>🌱</span>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#3a8a4a", margin: "0 0 3px" }}>来月へのヒント</p>
                      <p style={{ fontSize: 13, color: "#3a6a3a", lineHeight: 1.7, margin: 0 }}>{next}</p>
                    </div>
                  </div>
                )}
                <button onClick={runMonthlyReport} style={{ fontSize: 12, color: "#9a80d0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 10 }}>もう一度作る</button>
              </>
            );
          })() : reportLoading ? (
            <p style={{ fontSize: 13, color: "#9a80d0", textAlign: "center", margin: "6px 0" }}>作成中...</p>
          ) : monthLogs.length < 3 ? (
            <p style={{ fontSize: 13, color: "#9a8fc0", textAlign: "center", margin: "6px 0" }}>{y}/{m + 1}の記録が3日分たまるとレポートが作れます（今{monthLogs.length}日）</p>
          ) : (
            <>
              <button onClick={runMonthlyReport} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12, background: "#5a35c8", color: "#fff", cursor: "pointer" }}>{m + 1}月のレポートを作る（{monthLogs.length}日分）</button>
              {report === "__FAIL__" && <p style={{ fontSize: 12, color: "#c02020", textAlign: "center", margin: "8px 0 0" }}>作成に失敗しました。もう一度お試しください。</p>}
            </>
          )}
        </div>
      );
    }
    if (key === "heatmap") return <div style={{ marginBottom: 12 }}>{renderTrend()}</div>;
    if (key === "logs") {
      return (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 8px" }}>
            <div style={{ ...S.secHead, marginBottom: 0 }}><div style={S.secBar("#1a1a1a")}/><span style={S.secLabel}>{logsView === "calendar" ? "カレンダー" : showAllLogs ? "すべてのログ" : "最近のログ"}</span></div>
            <div style={{ display: "flex", background: "#e8e4dc", borderRadius: 10, padding: 2 }}>
              {[["list", "リスト"], ["calendar", "カレンダー"]].map(([v, label]) => (
                <button key={v} onClick={() => { setLogsView(v); setOpenLogKey(null); }} style={{ padding: "5px 12px", fontSize: 12, fontWeight: logsView === v ? 700 : 400, border: "none", borderRadius: 8, background: logsView === v ? "#fff" : "transparent", color: logsView === v ? "#1a1a1a" : "#9a9080", cursor: "pointer" }}>{label}</button>
              ))}
            </div>
          </div>
          {logsView === "calendar" ? (
            <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 16, padding: "14px 16px" }}>{renderCalendar()}</div>
          ) : !showAllLogs ? (
            <>
              <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 16, padding: "2px 14px" }}>
                {logs.slice(0, 5).map((e) => <LogRow key={e.id || e.date} e={e} />)}
              </div>
              {logs.length > 5 && (
                <button onClick={() => { setShowAllLogs(true); setOpenLogKey(null); }} style={{ width: "100%", padding: "12px", marginTop: 10, fontSize: 13, fontWeight: 600, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>すべて見る（{logs.length}件）▾</button>
              )}
            </>
          ) : (
            <>
              {groupByMonth().map((g) => {
                const openM = !closedMonths[g.key];
                return (
                  <div key={g.key} style={{ marginBottom: 8 }}>
                    <div onClick={() => setClosedMonths((p) => ({ ...p, [g.key]: !p[g.key] }))} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 2px", cursor: "pointer", borderBottom: "1.5px solid #e8e2d8" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{g.key}</span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>{g.items.length}件　{openM ? "▾" : "▸"}</span>
                    </div>
                    {openM && (
                      <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "2px 14px" }}>
                        {g.items.map((e) => <LogRow key={e.id || e.date} e={e} />)}
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={() => { setShowAllLogs(false); setOpenLogKey(null); }} style={{ width: "100%", padding: "12px", marginTop: 4, fontSize: 13, fontWeight: 600, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>折りたたむ ▲</button>
            </>
          )}
        </div>
      );
    }
    if (key === "badges") {
      const stats = computeBadgeStats();
      const earnedCount = BADGES.filter((b) => b.earned(stats)).length;
      return (
        <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.08em" }}>実績</span>
            <span style={{ fontSize: 11, color: "#bba", fontWeight: 700 }}>{earnedCount}/{BADGES.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {BADGES.map((b) => {
              const got = b.earned(stats);
              return (
                <div key={b.title} onClick={() => setSelectedBadge({ ...b, got })} style={{ textAlign: "center", opacity: got ? 1 : 0.4, cursor: "pointer" }}>
                  <div style={{ fontSize: 26, filter: got ? "none" : "grayscale(1)", lineHeight: 1.2 }}>{got ? b.emoji : "🔒"}</div>
                  <p style={{ fontSize: 9, color: got ? "#7a6a4a" : "#bbb", margin: "3px 0 0", fontWeight: got ? 700 : 400, lineHeight: 1.3 }}>{b.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Import existing localStorage data to Supabase
  const handleImport = async () => {
    if (!user) { alert("先にログインしてください"); return; }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { alert("インポートするデータがありません"); return; }
      const localLogs = JSON.parse(raw);
      if (!localLogs.length) { alert("インポートするデータがありません"); return; }

      // Fetch existing logs to decide insert vs update (avoids relying on a unique constraint)
      const { data: existing } = await supabase
        .from("logs").select("id,date").eq("user_id", user.id);
      const byDate = {};
      (existing || []).forEach((e) => { byDate[e.date] = e.id; });

      let ok = 0;
      let skipped = 0;
      const errors = [];
      for (const l of localLogs) {
        // Same date already in the cloud → keep the cloud version, skip (never overwrite newer data)
        if (byDate[l.date]) { skipped++; continue; }
        const dbEntry = {
          user_id: user.id, date: l.date, sleep: l.sleep, fatigue: l.fatigue,
          events: l.events || [], kuzure: l.kuzure, actions: l.actions || [],
          motives: l.motives || [], memo: l.memo || "", recovery: l.recovery || [],
          is_period: l.isPeriod || null, event_memo: l.eventMemo || "",
        };
        const { error } = await supabase.from("logs").insert(dbEntry);
        if (error) errors.push(error.message); else ok++;
      }
      await loadUserData(user.id);
      setShowImport(false);
      const skipMsg = skipped ? `（同じ日付の${skipped}件は既にあるのでそのまま残しました）` : "";
      if (errors.length) {
        alert(`${ok}件引き継ぎ、${errors.length}件失敗しました。${skipMsg}\n${errors[0]}`);
      } else {
        alert(`${ok}件のデータを引き継ぎました！${skipMsg}`);
      }
    } catch (e) {
      alert("引き継ぎに失敗しました: " + (e?.message || ""));
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

  const [resendMsg, setResendMsg] = useState("");

  const isUnconfirmedError = (error) =>
    error?.code === "email_not_confirmed" || /not confirmed/i.test(error?.message || "");

  const handleResendConfirm = async () => {
    setResendMsg("");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResendMsg(error ? "再送に失敗しました" : "確認メールを再送しました");
  };

  const handleAuth = async () => {
    setAuthError("");
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setAuthError(error.message); return; }
      if (data.session) {
        // Logged in immediately (email confirmation off)
        setShowAuthModal(false);
      } else {
        // Email confirmation required — still "仮登録", make it clearly visible
        setSignupDone(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) { setShowAuthModal(false); return; }
      // Unconfirmed account tried to log in → guide to complete 本登録, not "wrong password"
      if (isUnconfirmedError(error)) setSignupDone(true);
      else setAuthError("メールアドレスかパスワードが違います");
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
          <button onClick={handleLogout} style={{ fontSize: 11, color: "#aaa", background: "none", border: "1px solid #e4e0d8", borderRadius: 99, padding: "4px 12px", cursor: "pointer", marginTop: 4 }}>ログアウト</button>
        ) : (
          <button onClick={() => setShowAuthModal(true)} style={{ fontSize: 11, color: "#5a35c8", background: "none", border: "1px solid #d6ccf5", borderRadius: 99, padding: "4px 12px", cursor: "pointer", marginTop: 4 }}>ログイン</button>
        )}
      </div>
      <p style={S.sub}>朝起きたら1分だけ、昨日を振り返る</p>

      <div style={S.tabs}>
        {[["record","今朝の記録"],["history","ログを見る"],["settings","設定"]].map(([t,label]) => (
          <button key={t} onClick={() => setTab(t)} style={S.tab(tab===t)}>{label}</button>
        ))}
      </div>

      {tab === "record" && (
        <div>
          {editingLog && (
            <div style={{ background: "#fff4e6", border: "1.5px solid #f5c4a8", borderRadius: 14, padding: "10px 16px", marginBottom: 12, fontSize: 13, color: "#b85c00", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>✏️ {editingLog.date} の記録を編集中</span>
              <button onClick={() => { setEditingLog(null); setSleep(null); setFatigue(null); setEvents([]); setKuzureLevel(null); setActions([]); setMotives([]); setMemo(""); setEventMemo(""); setRecovery([]); setSelectedDate(""); }} style={{ fontSize: 12, color: "#b85c00", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>キャンセル</button>
            </div>
          )}
          {alreadyLogged && !saved && !editingLog && <div style={S.alreadyBox}>今日はもう記録済みです。別の日の分を記録することもできます。</div>}

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
            <div style={S.secHead}><div style={S.secBar("#5a35c8")}/><span style={S.secLabel}>昨夜（{prevDay(selectedDate || todayStr())}の夜）の睡眠満足度<span style={{color:"#c02020",marginLeft:6,fontSize:9,fontWeight:700,letterSpacing:"0.05em"}}>必須</span></span></div>
            <Slider value={sleep} min={1} max={5} color="#5a35c8" onChange={setSleep}>
              <SleepFace level={sleep} color="#5a35c8" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5a35c8", marginTop: 2 }}>{SLEEP_LABELS[sleep]}</span>
            </Slider>
          </div>

          {/* 疲労 */}
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#c04820")}/><span style={S.secLabel}>今の体の疲労感<span style={{color:"#c02020",marginLeft:6,fontSize:9,fontWeight:700,letterSpacing:"0.05em"}}>必須</span></span></div>
            <Slider value={fatigue} min={1} max={5} color="#c04820" onChange={setFatigue}>
              <FatigueFace level={fatigue} color="#c04820" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#c04820", marginTop: 2 }}>{FATIGUE_LABELS[fatigue]}</span>
            </Slider>
          </div>

          {/* イベント */}
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#1a7ac0")}/><span style={S.secLabel}>昨日のイベント（複数OK）<span style={{color:"#c02020",marginLeft:6,fontSize:9,fontWeight:700,letterSpacing:"0.05em"}}>必須</span></span></div>
            <p style={{ fontSize: 11, color: "#b0a898", margin: "0 0 10px" }}>ドラッグで並び替え、×で削除できます</p>
            <RecoveryManager
              items={eventItems}
              setItems={setEventItems}
              selected={events}
              onToggle={toggleEvent}
              onDelete={deleteEvent}
              activeColor="#1a7ac0"
            />
            <textarea value={eventMemo} onChange={(e) => setEventMemo(e.target.value)} placeholder="一言メモ（任意）" rows={2} style={{ ...S.textarea, marginTop: 10 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <input value={newEventInput} onChange={(e) => setNewEventInput(e.target.value)} onKeyDown={(e) => { if (e.key==="Enter") addEvent(); }} placeholder="追加する（Enterで確定）" style={{ flex: 1, padding: "10px 12px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#faf9f7", color: "#1a1a1a", outline: "none" }} />
              <button onClick={addEvent} style={{ padding: "10px 14px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>追加</button>
            </div>
          </div>

          <div style={S.divider}/>

          {/* 崩れ */}
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#c02020")}/><span style={S.secLabel}>昨日、どのくらい崩れた？<span style={{color:"#c02020",marginLeft:6,fontSize:9,fontWeight:700,letterSpacing:"0.05em"}}>必須</span></span></div>
            <Slider value={kuzureLevel} min={0} max={5} color="#c02020" onChange={setKuzureLevel}>
              <span style={{ fontSize: 16, fontWeight: 800, color: kuzureLevel === 0 ? "#5a35c8" : "#c02020" }}>{KUZURE_LABELS[kuzureLevel]}</span>
            </Slider>
            {/* Preview of actions when not 崩れ */}
            {(kuzureLevel === 0 || kuzureLevel === null) && (
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ACTIONS_DEFAULT.map((a) => (
                  <span key={a} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 10, background: "#ebebeb", color: "#888", border: "1px solid #ddd" }}>{a}</span>
                ))}
              </div>
            )}

            {kuzureLevel > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ ...S.secLabel, marginBottom: 6 }}>何をした？（複数OK）</p>
                <p style={{ fontSize: 11, color: "#b0a898", margin: "0 0 10px" }}>ドラッグで並び替え、×で削除できます</p>
                <RecoveryManager items={actionItems} setItems={setActionItems} selected={actions} onToggle={(a) => toggleMulti(actions, setActions, a)} onDelete={deleteAction} activeColor="#c02020" />
                <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 16 }}>
                  <input value={newActionInput} onChange={(e) => setNewActionInput(e.target.value)} onKeyDown={(e) => { if (e.key==="Enter") addAction(); }} placeholder="追加する（Enterで確定）" style={{ flex: 1, padding: "10px 12px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#faf9f7", color: "#1a1a1a", outline: "none" }} />
                  <button onClick={addAction} style={{ padding: "10px 14px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>追加</button>
                </div>
                <p style={{ ...S.secLabel, marginBottom: 6 }}>そのとき、どんな気持ちだった？（複数OK）</p>
                <p style={{ fontSize: 11, color: "#b0a898", margin: "0 0 10px" }}>ドラッグで並び替え、×で削除できます</p>
                <RecoveryManager items={motiveItems} setItems={setMotiveItems} selected={motives} onToggle={(m) => toggleMulti(motives, setMotives, m)} onDelete={deleteMotive} activeColor="#c02020" />
                <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 16 }}>
                  <input value={newMotiveInput} onChange={(e) => setNewMotiveInput(e.target.value)} onKeyDown={(e) => { if (e.key==="Enter") addMotive(); }} placeholder="追加する（Enterで確定）" style={{ flex: 1, padding: "10px 12px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#faf9f7", color: "#1a1a1a", outline: "none" }} />
                  <button onClick={addMotive} style={{ padding: "10px 14px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>追加</button>
                </div>
                <p style={{ ...S.secLabel, marginBottom: 6 }}>一言メモ（任意）</p>
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="どんな感じだったか、自由に" rows={2} style={S.textarea} />
              </div>
            )}
          </div>

          <div style={S.divider}/>

          <button
            onClick={() => setShowOptional((p) => !p)}
            style={{ width: "100%", padding: "12px 16px", marginBottom: 12, fontSize: 13, fontWeight: 500, border: "1.5px dashed #c8c0b0", borderRadius: 14, background: "transparent", color: "#888", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>任意項目を{showOptional ? "閉じる" : "開く"}</span>
            <span style={{ fontSize: 12, transform: showOptional ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
          </button>

          {showOptional && (
            <>
              {trackPeriod && (
                <div style={S.secWrap}>
                  <div style={S.secHead}><div style={S.secBar("#e06b8e")}/><span style={S.secLabel}>昨日、生理中だった？</span></div>
                  <div style={S.ynGrid}>
                    <button onClick={() => setIsPeriod(true)} style={S.ynBtn(isPeriod === true, "#e06b8e")}>生理中</button>
                    <button onClick={() => setIsPeriod(false)} style={S.ynBtn(isPeriod === false, "#888")}>違う</button>
                  </div>
                </div>
              )}
              <div style={S.secWrap}>
                <div style={S.secHead}><div style={S.secBar("#1a6030")}/><span style={S.secLabel}>昨日試したこと</span></div>
                <p style={{ fontSize: 11, color: "#b0a898", margin: "0 0 10px" }}>ドラッグで並び替え、×で削除できます</p>
                <RecoveryManager items={recoveryItems} setItems={setRecoveryItems} selected={recovery} onToggle={(r) => toggleMulti(recovery, setRecovery, r)} onDelete={deleteRecovery} />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input value={newRecoveryInput} onChange={(e) => setNewRecoveryInput(e.target.value)} onKeyDown={(e) => { if (e.key==="Enter") addRecovery(); }} placeholder="追加する（Enterで確定）" style={{ flex: 1, padding: "10px 12px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#faf9f7", color: "#1a1a1a", outline: "none" }} />
                  <button onClick={addRecovery} style={{ padding: "10px 14px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>追加</button>
                </div>
              </div>
            </>
          )}

          <button onClick={handleSave} style={S.saveBtn}>{editingLog ? "編集を保存する" : "記録する"}</button>
          {saved && (
            <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, pointerEvents: "none" }}>
              <div style={{ background: "#1a1a1a", color: "#fff", borderRadius: 16, padding: "16px 28px", fontSize: 15, fontWeight: 700, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", textAlign: "center" }}>
                <p style={{ margin: "0 0 4px" }}>記録しました ✓</p>
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
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>全16タイプ</h2>
                <button onClick={() => setShowLegend(true)} style={{ width: 22, height: 22, borderRadius: "50%", border: "1.5px solid #555", background: "none", color: "#555", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>?</button>
              </div>
              <button onClick={() => setShowAllTypes(false)} style={{ fontSize: 13, color: "#555", background: "none", border: "1px solid #333", borderRadius: 99, padding: "6px 16px", cursor: "pointer" }}>閉じる</button>
            </div>
            {showLegend && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }} onClick={() => setShowLegend(false)}>
                <div style={{ background: "#ffffff", border: "1px solid #e0ddd8", borderRadius: 18, padding: "24px 20px", maxWidth: 300, width: "100%" }} onClick={(e) => e.stopPropagation()}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "0 0 16px" }}>コードの読み方</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#a0a0d0", margin: "0 0 12px" }}>1・2文字目：崩れタイプ</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    {[["P","身体が原因で崩れる"],["M","精神が原因で崩れる"],["E","疲れが蓄積して崩れる"],["R","緊張が解けたときに崩れる"]].map(([code, desc]) => (
                      <div key={code} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "#5a35c8", fontFamily: "monospace", flexShrink: 0, width: 20 }}>{code}</span>
                        <span style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#a0a0d0", margin: "0 0 12px" }}>3・4文字目：回復タイプ</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                    {[["S","ひとりで回復する"],["T","人と一緒に回復する"],["A","動いて回復する"],["Q","静かに回復する"]].map(([code, desc]) => (
                      <div key={code} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: "#c04820", fontFamily: "monospace", flexShrink: 0, width: 20 }}>{code}</span>
                        <span style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{desc}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowLegend(false)} style={{ width: "100%", padding: "10px", fontSize: 13, border: "none", borderRadius: 12, background: "#333", color: "#fff", cursor: "pointer" }}>閉じる</button>
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
            {selectedType.jp.split("×").map((tag, i) => (
              <button key={i} onClick={() => setTagPopup(tag)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, border: `1px solid ${selectedType.color}55`, color: selectedType.color, background: selectedType.color + "15", cursor: "pointer" }}>{tag}</button>
            ))}
          </div>
          <div style={{ width: 32, height: 1.5, background: selectedType.color, borderRadius: 2, marginBottom: 20, opacity: 0.5 }} />
          <p style={{ fontSize: 14, color: "#333", lineHeight: 1.8, textAlign: "center", maxWidth: 300, margin: "0 0 32px" }}>{selectedType.desc}</p>
          <button onClick={() => setSelectedType(null)} style={{ fontSize: 13, color: "#555", background: "none", border: "1px solid #333", borderRadius: 99, padding: "8px 24px", cursor: "pointer" }}>閉じる</button>

          {tagPopup && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400, padding: "0 0 0 0" }} onClick={() => setTagPopup(null)}>
              <div style={{ background: "#ffffff", border: "1px solid #e0ddd8", borderRadius: "18px 18px 0 0", padding: "24px 20px 32px", maxWidth: 420, width: "100%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
                {tagPopup === "code" ? (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "0 0 16px" }}>コードの読み方</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#4a28b0", margin: "0 0 10px" }}>1文字目：崩れの原因</p>
                    {[["P","Physical（身体）","身体が原因で崩れる"],["M","Mental（精神）","精神が原因で崩れる"]].map(([c,en,d]) => (
                      <div key={c} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#4a28b0", fontFamily: "monospace", width: 20 }}>{c}</span>
                          <span style={{ fontSize: 12, color: "#4a28b0", fontFamily: "monospace", fontWeight: 600 }}>{en}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#444", margin: "0 0 0 28px", lineHeight: 1.5 }}>{d}</p>
                      </div>
                    ))}
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#4a28b0", margin: "14px 0 10px" }}>2文字目：崩れのタイミング</p>
                    {[["E","Exhaustion（蓄積疲弊）","疲れが蓄積して崩れる"],["R","Release（緊張緩和）","緊張が解けたときに崩れる"]].map(([c,en,d]) => (
                      <div key={c} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#4a28b0", fontFamily: "monospace", width: 20 }}>{c}</span>
                          <span style={{ fontSize: 12, color: "#4a28b0", fontFamily: "monospace", fontWeight: 600 }}>{en}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#444", margin: "0 0 0 28px", lineHeight: 1.5 }}>{d}</p>
                      </div>
                    ))}
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#a03010", margin: "14px 0 10px" }}>3文字目：回復スタイル</p>
                    {[["S","Solo（独）","ひとりで回復する"],["T","Together（群）","人と一緒に回復する"]].map(([c,en,d]) => (
                      <div key={c} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: "#a03010", fontFamily: "monospace", width: 20 }}>{c}</span>
                          <span style={{ fontSize: 12, color: "#a03010", fontFamily: "monospace", fontWeight: 600 }}>{en}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#444", margin: "0 0 0 28px", lineHeight: 1.5 }}>{d}</p>
                      </div>
                    ))}
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#a03010", margin: "14px 0 10px" }}>4文字目：回復の手段</p>
                    {[["A","Active（動）","動いて回復する"],["Q","Quiet（静）","静かに回復する"]].map(([c,en,d]) => (
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
                <button onClick={() => setTagPopup(null)} style={{ width: "100%", padding: "13px", fontSize: 15, fontWeight: 700, border: "none", borderRadius: 12, background: "#fff", color: "#1a1a1a", cursor: "pointer", marginTop: 16 }}>閉じる</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div>
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#1a7ac0")}/><span style={S.secLabel}>データの引き継ぎ</span></div>
            <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 14, padding: "14px 16px" }}>
              <p style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 600, margin: "0 0 4px" }}>ログイン前のデータを引き継ぐ</p>
              <p style={{ fontSize: 12, color: "#b0a898", margin: "0 0 12px" }}>このブラウザに保存されているデータをアカウントに移行します</p>
              {user ? (
                <button onClick={() => setShowImport(true)} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 12, background: "#1a7ac0", color: "#fff", cursor: "pointer" }}>データを引き継ぐ</button>
              ) : (
                <>
                  <button disabled style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 12, background: "#ccc", color: "#fff", cursor: "not-allowed" }}>データを引き継ぐ</button>
                  <p style={{ fontSize: 12, color: "#c08", margin: "8px 0 0" }}>引き継ぎには<button onClick={() => setShowAuthModal(true)} style={{ color: "#1a7ac0", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>ログイン</button>が必要です</p>
                </>
              )}
            </div>
          </div>
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#e06b8e")}/><span style={S.secLabel}>生理周期の記録</span></div>
            <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>生理中を記録する</p>
                  <p style={{ fontSize: 12, color: "#b0a898", margin: 0 }}>オンにすると記録画面に生理中の項目が追加されます</p>
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
          <div style={S.secWrap}>
            <div style={S.secHead}><div style={S.secBar("#5a35c8")}/><span style={S.secLabel}>AIのトーン</span></div>
            <div style={{ background: "#fff", border: "1.5px solid #ebe7df", borderRadius: 14, padding: "14px 16px" }}>
              <p style={{ fontSize: 12, color: "#b0a898", margin: "0 0 12px" }}>AI分析やレポートの言い回しを選べます（分析の中身は変わりません）</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(TONES).map(([key, t]) => {
                  const active = tone === key;
                  return (
                    <button key={key} onClick={() => { setTone(key); setAiHint(null); try { localStorage.removeItem("kuzure_ai_hint"); } catch {} }} style={{ padding: "10px 8px", border: active ? "1.5px solid #5a35c8" : "1.5px solid #e4e0d8", borderRadius: 12, background: active ? "#5a35c815" : "#fff", cursor: "pointer", textAlign: "left" }}>
                      <p style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: active ? "#5a35c8" : "#1a1a1a", margin: "0 0 2px" }}>{t.label}</p>
                      <p style={{ fontSize: 10, color: "#aaa", margin: 0 }}>{t.desc}</p>
                    </button>
                  );
                })}
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
              {!reorderMode && renderHint()}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button onClick={() => setReorderMode((v) => !v)} style={{ fontSize: 12, color: reorderMode ? "#fff" : "#888", background: reorderMode ? "#5a35c8" : "#fff", border: "1.5px solid #e4e0d8", borderRadius: 99, padding: "5px 14px", cursor: "pointer", fontWeight: 600 }}>{reorderMode ? "完了 ✓" : "並び替え ⇅"}</button>
              </div>
              {reorderMode ? (
                <div>
                  <p style={{ fontSize: 12, color: "#9a9080", textAlign: "center", margin: "0 0 12px" }}>ドラッグして表示順を入れ替えできます</p>
                  {sectionOrder.map((k, i) => (
                    <div key={k} draggable onDragStart={() => { dragSec.current = i; }} onDragEnter={() => setDragSecOver(i)} onDragEnd={onSecDragEnd} onDragOver={(e) => e.preventDefault()}
                      style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1.5px solid #e4e0d8", borderRadius: 12, padding: "14px 16px", marginBottom: 8, cursor: "grab", opacity: dragSecOver === i ? 0.5 : 1 }}>
                      <span style={{ fontSize: 18 }}>{SECTION_META[k].emoji}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", flex: 1 }}>{SECTION_META[k].label}</span>
                      <span style={{ fontSize: 18, color: "#ccc" }}>⇅</span>
                    </div>
                  ))}
                  <button onClick={() => setSectionOrder(SECTION_DEFAULT_ORDER)} style={{ width: "100%", padding: "10px", marginTop: 6, fontSize: 12, color: "#999", border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", cursor: "pointer" }}>初期の並びに戻す</button>
                </div>
              ) : (
                sectionOrder.map((k) => <div key={k}>{renderSection(k)}</div>)
              )}
            </>
          )}
        </div>
      )}
      {selectedBadge && (
        <div onClick={() => setSelectedBadge(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, padding: "24px 20px", maxWidth: 280, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 48, filter: selectedBadge.got ? "none" : "grayscale(1)", opacity: selectedBadge.got ? 1 : 0.5, lineHeight: 1.2 }}>{selectedBadge.got ? selectedBadge.emoji : "🔒"}</div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", margin: "8px 0 4px" }}>{selectedBadge.title}</p>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 12px", lineHeight: 1.6 }}>{selectedBadge.desc}</p>
            <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "4px 14px", borderRadius: 99, background: selectedBadge.got ? "#eaf6ea" : "#f0ece4", color: selectedBadge.got ? "#1a8a4a" : "#aaa" }}>{selectedBadge.got ? "獲得済み ✓" : "未獲得"}</span>
            <button onClick={() => setSelectedBadge(null)} style={{ width: "100%", padding: "11px", marginTop: 16, fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12, background: "#1a1a1a", color: "#fff", cursor: "pointer" }}>閉じる</button>
          </div>
        </div>
      )}
      {showAuthModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "24px 20px", maxWidth: 320, width: "100%" }}>
            {signupDone ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 40, margin: "0 0 8px" }}>📩</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", margin: "0 0 8px" }}>あと一歩！まだ「仮登録」です</p>
                <p style={{ fontSize: 13, color: "#888", margin: "0 0 8px", lineHeight: 1.6 }}>{email} に確認メールを送りました。メール内のリンクを開くと<b style={{color:"#1a1a1a"}}>本登録が完了</b>します。そのあとログインしてください。</p>
                <p style={{ fontSize: 12, color: "#c08", margin: "0 0 18px", lineHeight: 1.5 }}>※リンクを開くまではログインできません</p>
                <button onClick={() => { setSignupDone(false); setResendMsg(""); setAuthMode("login"); setPassword(""); }} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12, background: "#1a1a1a", color: "#fff", cursor: "pointer", marginBottom: 8 }}>ログイン画面へ</button>
                <button onClick={handleResendConfirm} style={{ width: "100%", padding: "10px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer", marginBottom: 8 }}>確認メールを再送する</button>
                {resendMsg && <p style={{ fontSize: 12, color: "#5a35c8", margin: "0 0 8px" }}>{resendMsg}</p>}
                <button onClick={() => { setSignupDone(false); setResendMsg(""); setShowAuthModal(false); setBrowserOnly(true); }} style={{ width: "100%", padding: "10px", fontSize: 13, border: "none", background: "none", color: "#bbb", cursor: "pointer" }}>閉じる</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "#888", textAlign: "center", margin: "0 0 16px", lineHeight: 1.6 }}>ログインすると、機種変更やキャッシュ削除でもデータが消えません。</p>
                <div style={{ display: "flex", background: "#e8e4dc", borderRadius: 12, padding: 3, marginBottom: 16 }}>
                  <button onClick={() => { setAuthMode("login"); setAuthError(""); }} style={{ flex: 1, padding: "8px 0", fontSize: 13, fontWeight: authMode === "login" ? 700 : 400, border: "none", borderRadius: 9, background: authMode === "login" ? "#fff" : "transparent", color: authMode === "login" ? "#1a1a1a" : "#9a9080", cursor: "pointer" }}>ログイン</button>
                  <button onClick={() => { setAuthMode("signup"); setAuthError(""); }} style={{ flex: 1, padding: "8px 0", fontSize: 13, fontWeight: authMode === "signup" ? 700 : 400, border: "none", borderRadius: 9, background: authMode === "signup" ? "#fff" : "transparent", color: authMode === "signup" ? "#1a1a1a" : "#9a9080", cursor: "pointer" }}>新規登録</button>
                </div>
                <input type="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 14, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#1a1a1a", outline: "none", marginBottom: 10 }} />
                <input type="password" placeholder="パスワード（6文字以上）" value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAuth(); }}
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", fontSize: 14, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#1a1a1a", outline: "none", marginBottom: 10 }} />
                {authError && <p style={{ fontSize: 12, color: "#c02020", margin: "0 0 10px" }}>{authError}</p>}
                <button onClick={handleAuth} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12, background: "#1a1a1a", color: "#fff", cursor: "pointer", marginBottom: 8 }}>
                  {authMode === "login" ? "ログイン" : "アカウントを作成"}
                </button>
                {authMode === "login" && (
                  <button onClick={() => { setShowAuthModal(false); setResetMode(true); }} style={{ width: "100%", fontSize: 12, color: "#aaa", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginBottom: 8 }}>パスワードを忘れた</button>
                )}
                <button onClick={() => { setShowAuthModal(false); setBrowserOnly(true); }} style={{ width: "100%", padding: "10px", fontSize: 13, border: "1.5px solid #e4e0d8", borderRadius: 12, background: "#fff", color: "#888", cursor: "pointer" }}>ログインせずにブラウザで使う</button>
                <p style={{ fontSize: 11, color: "#c0b8a8", textAlign: "center", margin: "8px 0 0", lineHeight: 1.5 }}>※ログインなしだと、キャッシュ削除でデータが消えることがあります</p>
              </>
            )}
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
                <button onClick={() => { setResetMode(false); setResetSent(false); }} style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12, background: "#1a1a1a", color: "#fff", cursor: "pointer" }}>閉じる</button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>パスワード再設定</p>
                <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>登録したメールアドレスを入力してください</p>
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
            <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>データを引き継ぎますか？</p>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>このブラウザに保存されているログデータをアカウントに移行します。</p>
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
            <p style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>削除しますか？</p>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>「{confirmDelete.label}」を削除します。</p>
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
