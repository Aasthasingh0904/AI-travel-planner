import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Compass, MapPin, UtensilsCrossed, Calendar, Wallet, Plane,
  Loader2, Save, BookMarked, Trash2, ChevronLeft, Sparkles,
  Sun, Sunset, Moon, Clock, Star, AlertTriangle, Heart,
  RefreshCw, Copy, Check, Search, Backpack, PieChart, ChevronDown,
} from "lucide-react";

const GLOBAL_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes popIn { 0% { opacity: 0; transform: scale(0.6) rotate(-6deg); } 70% { transform: scale(1.08) rotate(-6deg); } 100% { opacity: 1; transform: scale(1) rotate(-6deg); } }
@keyframes heartPop { 0% { transform: scale(1); } 40% { transform: scale(1.4); } 100% { transform: scale(1); } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes flyPath { 0% { offset-distance: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { offset-distance: 100%; opacity: 0; } }
@keyframes barGrow { from { width: 0%; } }
@keyframes toastIn { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

.wp-view { animation: fadeInUp 0.35s ease both; }
.wp-card { transition: transform 0.18s ease, box-shadow 0.18s ease; animation: fadeInUp 0.4s ease both; }
.wp-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(23,41,58,0.1); }
.wp-btn { transition: transform 0.12s ease, filter 0.12s ease; }
.wp-btn:hover { filter: brightness(1.06); }
.wp-btn:active { transform: scale(0.96); }
.wp-choice { transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease; }
.wp-choice:hover { transform: translateY(-2px); }
.wp-stamp { animation: popIn 0.5s cubic-bezier(.34,1.56,.64,1) both; }
.wp-heart-pop { animation: heartPop 0.35s ease; }
.wp-bar-fill { animation: barGrow 0.8s cubic-bezier(.2,.8,.3,1) both; }
.wp-toast { animation: toastIn 0.25s ease both; }
.wp-day-body { animation: slideDown 0.25s ease both; }
.wp-fly { offset-path: path("M10,10 C 60,60 140,-20 190,40"); animation: flyPath 2.6s ease-in-out infinite; }
.wp-tag { transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
.wp-tag:hover { transform: translateY(-1px); }
`;

const INTERESTS = [
  "Food & drink", "Art & museums", "Nature & outdoors", "History",
  "Nightlife", "Shopping", "Relaxation", "Adventure", "Local culture", "Architecture",
];

const BUDGET_LEVELS = [
  { id: "shoestring", label: "Shoestring", sub: "Hostels, street food, free sights" },
  { id: "midrange", label: "Mid-range", sub: "3-star hotels, sit-down meals" },
  { id: "comfort", label: "Comfort", sub: "4-star hotels, nicer restaurants" },
  { id: "luxury", label: "Luxury", sub: "Top hotels, fine dining, no limits" },
];

const LOADING_MESSAGES = [
  "Charting a course to {dest}…",
  "Scouting the best local spots…",
  "Lining up restaurants worth the trip…",
  "Sketching your day-by-day plan…",
  "Packing the final details…",
];

const BAR_COLORS = ["#B7472A", "#C89B3C", "#2F6E6E", "#5B7C99", "#8A8577"];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function stripFences(text) {
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) throw new Error("Request failed");
  const data = await response.json();
  const textBlock = data.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No response text");
  return JSON.parse(stripFences(textBlock.text));
}

function buildPrompt({ destination, budgetLevel, days, interests }) {
  const budgetLabel = BUDGET_LEVELS.find((b) => b.id === budgetLevel)?.label || "Mid-range";
  const interestsStr = interests.length ? interests.join(", ") : "a balanced mix of everything";
  return `You are a travel planner. Create a complete trip plan for a trip to ${destination}, for ${days} day(s), at a "${budgetLabel}" budget level, focused on these interests: ${interestsStr}.

Respond with ONLY raw JSON (no markdown fences, no preamble, no commentary) matching exactly this schema:

{
  "destination": "City, Country",
  "budgetLevel": "${budgetLabel}",
  "estimatedTotalCost": "short string like $600-900 per person",
  "tripLength": ${days},
  "bestTimeToVisit": "short string",
  "summary": "2-3 sentence overview of the trip and its vibe",
  "placesToVisit": [
    { "name": "...", "category": "e.g. Landmark, Museum, Park, Viewpoint", "description": "1-2 sentences", "estimatedTime": "e.g. 2 hours" }
  ],
  "restaurants": [
    { "name": "...", "cuisine": "...", "priceRange": "$ | $$ | $$$ | $$$$", "mustTry": "a specific dish or drink to order" }
  ],
  "itinerary": [
    { "day": 1, "title": "short theme for the day", "morning": "...", "afternoon": "...", "evening": "...", "tip": "one practical local tip for the day" }
  ],
  "budgetBreakdown": [
    { "category": "Accommodation", "percentage": 35 },
    { "category": "Food & drink", "percentage": 25 },
    { "category": "Activities", "percentage": 20 },
    { "category": "Transport", "percentage": 12 },
    { "category": "Shopping & extras", "percentage": 8 }
  ],
  "packingList": [
    { "category": "Clothing", "items": ["...", "..."] },
    { "category": "Essentials", "items": ["...", "..."] },
    { "category": "Weather & climate", "items": ["...", "..."] }
  ]
}

Include 6-8 placesToVisit, 6 restaurants, and exactly ${days} itinerary entries (one per day, days numbered 1 to ${days}). budgetBreakdown percentages must sum to 100. packingList should have 3-4 categories with 3-6 items each, tailored to the destination's climate and the planned activities. Be specific and realistic to ${destination} — use real neighborhoods and real-sounding venue names appropriate to the destination and budget level. Return ONLY the JSON object.`;
}

function buildDayPrompt({ destination, budgetLevel, day, oldTitle }) {
  const budgetLabel = BUDGET_LEVELS.find((b) => b.id === budgetLevel)?.label || "Mid-range";
  return `You are a travel planner. Rewrite a SINGLE day of a trip to ${destination} at a "${budgetLabel}" budget level. This is day ${day}. The previous version of this day was themed "${oldTitle}" — write a genuinely different day with a different theme and different activities.

Respond with ONLY raw JSON (no markdown fences, no preamble) matching exactly:
{ "day": ${day}, "title": "short theme for the day", "morning": "...", "afternoon": "...", "evening": "...", "tip": "one practical local tip" }`;
}

function tripToText(trip) {
  const lines = [];
  lines.push(`${trip.destination} — ${trip.tripLength} day${trip.tripLength > 1 ? "s" : ""} (${trip.budgetLevel})`);
  lines.push(`Estimated cost: ${trip.estimatedTotalCost} · Best time: ${trip.bestTimeToVisit}`);
  lines.push("");
  lines.push(trip.summary || "");
  lines.push("");
  lines.push("PLACES TO VISIT");
  (trip.placesToVisit || []).forEach((p) => lines.push(`- ${p.name} (${p.category}): ${p.description}`));
  lines.push("");
  lines.push("RESTAURANTS");
  (trip.restaurants || []).forEach((r) => lines.push(`- ${r.name} [${r.priceRange}] ${r.cuisine} — try the ${r.mustTry}`));
  lines.push("");
  lines.push("ITINERARY");
  (trip.itinerary || []).forEach((d) => {
    lines.push(`Day ${d.day}: ${d.title}`);
    lines.push(`  Morning: ${d.morning}`);
    lines.push(`  Afternoon: ${d.afternoon}`);
    lines.push(`  Evening: ${d.evening}`);
    if (d.tip) lines.push(`  Tip: ${d.tip}`);
  });
  return lines.join("\n");
}

function Stamp({ day, delay = 0 }) {
  return (
    <div
      className="wp-stamp"
      style={{
        width: 52, height: 52, borderRadius: "50%",
        border: "2px solid #C89B3C", display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0, background: "#F1ECE0",
        boxShadow: "inset 0 0 0 2px #F1ECE0, inset 0 0 0 3px #C89B3C",
        animationDelay: `${delay}ms`,
      }}
    >
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, fontSize: 18, color: "#B7472A" }}>
        {String(day).padStart(2, "0")}
      </span>
    </div>
  );
}

function SectionLabel({ icon: Icon, children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={20} color="#B7472A" strokeWidth={2} />
        <h2
          style={{
            fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 700,
            fontSize: 26, letterSpacing: 0.3, color: "#17293A", textTransform: "uppercase",
          }}
        >
          {children}
        </h2>
      </div>
      {right}
    </div>
  );
}

export default function TravelPlanner() {
  const [view, setView] = useState("form"); // form | loading | result | saved
  const [error, setError] = useState("");
  const [trip, setTrip] = useState(null);
  const [savedTrips, setSavedTrips] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const [currentTripId, setCurrentTripId] = useState(null);
  const [toast, setToast] = useState("");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [regeneratingDay, setRegeneratingDay] = useState(null);
  const [collapsedDays, setCollapsedDays] = useState({});
  const [savedSearch, setSavedSearch] = useState("");

  const [destination, setDestination] = useState("");
  const [budgetLevel, setBudgetLevel] = useState("midrange");
  const [days, setDays] = useState(4);
  const [interests, setInterests] = useState([]);

  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  const loadSavedTrips = useCallback(async () => {
    try {
      const listResult = await window.storage.list("trip:", false);
      if (!listResult || !listResult.keys || listResult.keys.length === 0) {
        setSavedTrips([]);
        return;
      }
      const trips = [];
      for (const key of listResult.keys) {
        try {
          const res = await window.storage.get(key, false);
          if (res && res.value) trips.push(JSON.parse(res.value));
        } catch (e) {
          // skip unreadable entry
        }
      }
      trips.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      setSavedTrips(trips);
    } catch (e) {
      setSavedTrips([]);
    }
  }, []);

  useEffect(() => {
    loadSavedTrips();
  }, [loadSavedTrips]);

  useEffect(() => {
    if (view !== "loading") return;
    setLoadingMsgIdx(0);
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1700);
    return () => clearInterval(interval);
  }, [view]);

  const toggleInterest = (item) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const generateTrip = async () => {
    if (!destination.trim()) {
      setError("Enter a destination first.");
      return;
    }
    setError("");
    setView("loading");
    try {
      const result = await callClaude(
        buildPrompt({ destination: destination.trim(), budgetLevel, days, interests })
      );
      result.favorites = [];
      setTrip(result);
      setCurrentTripId(null);
      setSavedFlag(false);
      setCollapsedDays({});
      setView("result");
    } catch (e) {
      setError("Couldn't generate that trip. Try again.");
      setView("form");
    }
  };

  const saveTrip = async () => {
    if (!trip) return;
    setSaving(true);
    try {
      const id = currentTripId || uid();
      const record = { ...trip, id, savedAt: Date.now() };
      const result = await window.storage.set(`trip:${id}`, JSON.stringify(record), false);
      if (result) {
        setCurrentTripId(id);
        setSavedFlag(true);
        loadSavedTrips();
        showToast("Trip saved");
      }
    } catch (e) {
      setError("Couldn't save this trip.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTrip = async (id, e) => {
    e.stopPropagation();
    try {
      await window.storage.delete(`trip:${id}`, false);
      loadSavedTrips();
    } catch (err) {
      // ignore
    }
  };

  const openSavedTrip = (t) => {
    setTrip(t);
    setCurrentTripId(t.id);
    setSavedFlag(true);
    setCollapsedDays({});
    setView("result");
  };

  const startNew = () => {
    setTrip(null);
    setCurrentTripId(null);
    setSavedFlag(false);
    setError("");
    setView("form");
  };

  const toggleFavorite = (name) => {
    setTrip((prev) => {
      const favs = prev.favorites || [];
      const next = favs.includes(name) ? favs.filter((f) => f !== name) : [...favs, name];
      return { ...prev, favorites: next };
    });
    setSavedFlag(false);
  };

  const toggleDayCollapsed = (i) => {
    setCollapsedDays((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  const regenerateDay = async (index) => {
    setRegeneratingDay(index);
    try {
      const oldDay = trip.itinerary[index];
      const fresh = await callClaude(
        buildDayPrompt({ destination: trip.destination, budgetLevel: trip.budgetLevel, day: oldDay.day, oldTitle: oldDay.title })
      );
      setTrip((prev) => {
        const nextItinerary = [...prev.itinerary];
        nextItinerary[index] = fresh;
        return { ...prev, itinerary: nextItinerary };
      });
      setSavedFlag(false);
      showToast(`Day ${oldDay.day} refreshed`);
    } catch (e) {
      showToast("Couldn't refresh that day");
    } finally {
      setRegeneratingDay(null);
    }
  };

  const copyTrip = async () => {
    try {
      await navigator.clipboard.writeText(tripToText(trip));
      showToast("Copied to clipboard");
    } catch (e) {
      showToast("Couldn't copy");
    }
  };

  const filteredSavedTrips = savedTrips.filter((t) =>
    (t.destination || "").toLowerCase().includes(savedSearch.toLowerCase())
  );

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "#F1ECE0",
        minHeight: 600,
        padding: "0",
        color: "#23201B",
        position: "relative",
      }}
    >
      <style>{GLOBAL_STYLE}</style>

      {toast && (
        <div
          className="wp-toast"
          style={{
            position: "fixed", bottom: 24, left: "50%", zIndex: 50,
            background: "#17293A", color: "#F1ECE0", padding: "10px 18px",
            borderRadius: 999, fontSize: 13, fontWeight: 600, display: "flex",
            alignItems: "center", gap: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
        >
          <Check size={14} color="#C89B3C" /> {toast}
        </div>
      )}

      {/* Header bar */}
      <div
        style={{
          background: "#17293A", padding: "20px 28px", display: "flex",
          alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={startNew}>
          <Compass size={26} color="#C89B3C" strokeWidth={2} style={{ animation: "spin 8s linear infinite" }} />
          <span
            style={{
              fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 800,
              fontSize: 24, color: "#F1ECE0", letterSpacing: 0.5, textTransform: "uppercase",
            }}
          >
            Waypoint
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="wp-btn"
            onClick={startNew}
            style={{
              background: view === "form" || view === "loading" ? "#C89B3C" : "transparent",
              color: view === "form" || view === "loading" ? "#17293A" : "#F1ECE0",
              border: "1.5px solid #C89B3C", borderRadius: 6, padding: "8px 14px",
              fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex",
              alignItems: "center", gap: 6, fontFamily: "'Inter', sans-serif",
            }}
          >
            <Plane size={15} /> Plan a trip
          </button>
          <button
            className="wp-btn"
            onClick={() => setView("saved")}
            style={{
              background: view === "saved" ? "#C89B3C" : "transparent",
              color: view === "saved" ? "#17293A" : "#F1ECE0",
              border: "1.5px solid #C89B3C", borderRadius: 6, padding: "8px 14px",
              fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex",
              alignItems: "center", gap: 6, fontFamily: "'Inter', sans-serif",
            }}
          >
            <BookMarked size={15} /> My trips ({savedTrips.length})
          </button>
        </div>
      </div>

      <div style={{ padding: "32px 28px 60px", maxWidth: 900, margin: "0 auto" }}>
        {error && (
          <div
            className="wp-view"
            style={{
              background: "#FBE7E2", border: "1px solid #B7472A", borderRadius: 8,
              padding: "10px 14px", marginBottom: 20, display: "flex", alignItems: "center",
              gap: 8, color: "#7A2A18", fontSize: 14,
            }}
          >
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* FORM VIEW */}
        {view === "form" && (
          <div key="form" className="wp-view">
            <p
              style={{
                fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 17,
                color: "#5F5E5A", marginBottom: 4,
              }}
            >
              Tell me where, and I'll draft the whole trip.
            </p>
            <h1
              style={{
                fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 800,
                fontSize: 44, color: "#17293A", marginBottom: 28, lineHeight: 1,
              }}
            >
              Where to?
            </h1>

            <label style={{ fontSize: 13, fontWeight: 600, color: "#5F5E5A", display: "block", marginBottom: 6 }}>
              Destination
            </label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Lisbon, Portugal"
              style={{
                fontFamily: "'Inter', sans-serif", width: "100%", padding: "12px 14px", fontSize: 17,
                border: "2px solid #17293A", borderRadius: 8, marginBottom: 22,
                background: "#fff", boxSizing: "border-box", color: "#17293A", fontWeight: 500,
                transition: "box-shadow 0.15s ease",
              }}
            />

            <label style={{ fontSize: 13, fontWeight: 600, color: "#5F5E5A", display: "block", marginBottom: 8 }}>
              Budget level
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 22 }}>
              {BUDGET_LEVELS.map((b, i) => (
                <div
                  key={b.id}
                  className="wp-choice"
                  onClick={() => setBudgetLevel(b.id)}
                  style={{
                    cursor: "pointer", padding: "12px 14px", borderRadius: 8,
                    border: budgetLevel === b.id ? "2px solid #B7472A" : "1.5px solid #D3D1C7",
                    background: budgetLevel === b.id ? "#FBE7E2" : "#fff",
                    animation: "fadeInUp 0.4s ease both", animationDelay: `${i * 60}ms`,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#17293A", marginBottom: 3 }}>{b.label}</div>
                  <div style={{ fontSize: 12, color: "#5F5E5A" }}>{b.sub}</div>
                </div>
              ))}
            </div>

            <label style={{ fontSize: 13, fontWeight: 600, color: "#5F5E5A", display: "block", marginBottom: 8 }}>
              Trip length: {days} day{days > 1 ? "s" : ""}
            </label>
            <input
              type="range"
              min={1}
              max={14}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 22, accentColor: "#B7472A" }}
            />

            <label style={{ fontSize: 13, fontWeight: 600, color: "#5F5E5A", display: "block", marginBottom: 8 }}>
              Interests (optional)
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 30 }}>
              {INTERESTS.map((item, i) => (
                <button
                  key={item}
                  className="wp-tag"
                  onClick={() => toggleInterest(item)}
                  style={{
                    padding: "7px 13px", borderRadius: 999, fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: "'Inter', sans-serif",
                    border: interests.includes(item) ? "1.5px solid #2F6E6E" : "1.5px solid #D3D1C7",
                    background: interests.includes(item) ? "#2F6E6E" : "#fff",
                    color: interests.includes(item) ? "#fff" : "#5F5E5A",
                    animation: "fadeInUp 0.3s ease both", animationDelay: `${i * 30}ms`,
                  }}
                >
                  {item}
                </button>
              ))}
            </div>

            <button
              className="wp-btn"
              onClick={generateTrip}
              style={{
                width: "100%", padding: "15px", background: "#B7472A", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Sparkles size={18} /> Generate my trip
            </button>
          </div>
        )}

        {/* LOADING VIEW */}
        {view === "loading" && (
          <div key="loading" className="wp-view" style={{ textAlign: "center", padding: "70px 0" }}>
            <svg viewBox="0 0 200 60" width="200" height="60" style={{ display: "block", margin: "0 auto 6px" }}>
              <path d="M10,10 C 60,60 140,-20 190,40" fill="none" stroke="#D3D1C7" strokeWidth="2" strokeDasharray="4 6" />
              <g className="wp-fly" style={{ offsetRotate: "auto" }}>
                <Plane size={20} color="#B7472A" />
              </g>
            </svg>
            <Loader2 size={30} color="#B7472A" style={{ animation: "spin 1s linear infinite" }} />
            <p
              key={loadingMsgIdx}
              style={{
                marginTop: 16, fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: 18,
                color: "#5F5E5A", animation: "fadeIn 0.4s ease both",
              }}
            >
              {LOADING_MESSAGES[loadingMsgIdx].replace("{dest}", destination)}
            </p>
          </div>
        )}

        {/* SAVED TRIPS VIEW */}
        {view === "saved" && (
          <div key="saved" className="wp-view">
            <h1
              style={{
                fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 800,
                fontSize: 40, color: "#17293A", marginBottom: 18,
              }}
            >
              My trips
            </h1>

            {savedTrips.length > 0 && (
              <div style={{ position: "relative", marginBottom: 22, maxWidth: 320 }}>
                <Search size={15} color="#8A8577" style={{ position: "absolute", left: 12, top: 12 }} />
                <input
                  value={savedSearch}
                  onChange={(e) => setSavedSearch(e.target.value)}
                  placeholder="Search saved trips…"
                  style={{
                    fontFamily: "'Inter', sans-serif", width: "100%", padding: "9px 12px 9px 34px",
                    fontSize: 14, border: "1.5px solid #D3D1C7", borderRadius: 8,
                    background: "#fff", boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {savedTrips.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#888780" }}>
                <BookMarked size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>No saved trips yet. Plan one and save it for later.</p>
              </div>
            ) : filteredSavedTrips.length === 0 ? (
              <p style={{ color: "#888780", fontFamily: "'Fraunces', serif", fontStyle: "italic" }}>No trips match "{savedSearch}".</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                {filteredSavedTrips.map((t, i) => (
                  <div
                    key={t.id}
                    className="wp-card"
                    onClick={() => openSavedTrip(t)}
                    style={{
                      background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 10,
                      padding: "16px 18px", cursor: "pointer", position: "relative",
                      animationDelay: `${i * 40}ms`,
                    }}
                  >
                    <button
                      onClick={(e) => deleteTrip(t.id, e)}
                      style={{
                        position: "absolute", top: 10, right: 10, background: "transparent",
                        border: "none", cursor: "pointer", color: "#B4B2A9", padding: 4,
                      }}
                      aria-label="Delete trip"
                    >
                      <Trash2 size={15} />
                    </button>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#2F6E6E", textTransform: "uppercase", marginBottom: 4 }}>
                      {t.budgetLevel} · {t.tripLength} day{t.tripLength > 1 ? "s" : ""}
                    </div>
                    <div style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 700, fontSize: 22, color: "#17293A" }}>
                      {t.destination}
                    </div>
                    <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 6 }}>{t.estimatedTotalCost}</div>
                    {t.favorites && t.favorites.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: "#B7472A" }}>
                        <Heart size={12} fill="#B7472A" /> {t.favorites.length} favorited
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RESULT VIEW */}
        {view === "result" && trip && (
          <div key="result" className="wp-view">
            <button
              className="wp-btn"
              onClick={startNew}
              style={{
                display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
                color: "#2F6E6E", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 18, padding: 0,
              }}
            >
              <ChevronLeft size={16} /> Plan another trip
            </button>

            {/* Postcard header */}
            <div
              style={{
                background: "#17293A", borderRadius: 12, padding: "26px 28px",
                marginBottom: 20, position: "relative", overflow: "hidden",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "#C89B3C", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                {trip.budgetLevel} trip · {trip.tripLength} day{trip.tripLength > 1 ? "s" : ""}
              </div>
              <h1
                style={{
                  fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 800,
                  fontSize: 42, color: "#F1ECE0", marginBottom: 10, lineHeight: 1,
                }}
              >
                {trip.destination}
              </h1>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: "#D3D1C7", maxWidth: 560, lineHeight: 1.5, marginBottom: 16 }}>
                {trip.summary}
              </p>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#F1ECE0", fontSize: 13 }}>
                  <Wallet size={15} color="#C89B3C" /> {trip.estimatedTotalCost}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#F1ECE0", fontSize: 13 }}>
                  <Calendar size={15} color="#C89B3C" /> Best time: {trip.bestTimeToVisit}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 30, flexWrap: "wrap" }}>
              <button
                className="wp-btn"
                onClick={saveTrip}
                disabled={saving}
                style={{
                  padding: "11px 20px", background: savedFlag ? "#2F6E6E" : "#B7472A", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: saving ? "default" : "pointer", display: "flex", alignItems: "center", gap: 7,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={16} />}
                {savedFlag ? "Saved" : "Save this trip"}
              </button>
              <button
                className="wp-btn"
                onClick={copyTrip}
                style={{
                  padding: "11px 20px", background: "#fff", color: "#17293A",
                  border: "1.5px solid #D3D1C7", borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <Copy size={15} /> Copy trip
              </button>
            </div>

            {/* Budget breakdown */}
            {trip.budgetBreakdown && trip.budgetBreakdown.length > 0 && (
              <>
                <SectionLabel icon={PieChart}>Budget breakdown</SectionLabel>
                <div style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 10, padding: "18px 20px", marginBottom: 40 }}>
                  {trip.budgetBreakdown.map((b, i) => (
                    <div key={i} style={{ marginBottom: i === trip.budgetBreakdown.length - 1 ? 0 : 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: "#17293A" }}>{b.category}</span>
                        <span style={{ color: "#5F5E5A", fontFamily: "'IBM Plex Mono', monospace" }}>{b.percentage}%</span>
                      </div>
                      <div style={{ background: "#EFEBE0", borderRadius: 999, height: 8, overflow: "hidden" }}>
                        <div
                          className="wp-bar-fill"
                          style={{
                            width: `${b.percentage}%`, height: "100%", borderRadius: 999,
                            background: BAR_COLORS[i % BAR_COLORS.length], animationDelay: `${i * 80}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Places to visit */}
            <SectionLabel icon={MapPin}>Places to visit</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 40 }}>
              {trip.placesToVisit?.map((p, i) => {
                const isFav = (trip.favorites || []).includes(p.name);
                return (
                  <div key={i} className="wp-card" style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 10, padding: "16px 18px", animationDelay: `${i * 50}ms` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: "#17293A" }}>{p.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#2F6E6E", background: "#E4EEEE", padding: "2px 7px", borderRadius: 999, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                          {p.category}
                        </span>
                        <button
                          onClick={() => toggleFavorite(p.name)}
                          className={isFav ? "wp-heart-pop" : ""}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                          aria-label="Toggle favorite"
                        >
                          <Heart size={16} color="#B7472A" fill={isFav ? "#B7472A" : "none"} />
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: "#5F5E5A", lineHeight: 1.5, marginBottom: 8 }}>{p.description}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#888780" }}>
                      <Clock size={12} /> {p.estimatedTime}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Restaurants */}
            <SectionLabel icon={UtensilsCrossed}>Where to eat</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 40 }}>
              {trip.restaurants?.map((r, i) => (
                <div key={i} className="wp-card" style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 10, padding: "16px 18px", animationDelay: `${i * 50}ms` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: "#17293A" }}>{r.name}</div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#C89B3C", fontWeight: 500 }}>{r.priceRange}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#2F6E6E", fontWeight: 600, marginBottom: 6 }}>{r.cuisine}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#5F5E5A" }}>
                    <Star size={12} color="#C89B3C" /> Try the {r.mustTry}
                  </div>
                </div>
              ))}
            </div>

            {/* Packing list */}
            {trip.packingList && trip.packingList.length > 0 && (
              <>
                <SectionLabel icon={Backpack}>Packing list</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 40 }}>
                  {trip.packingList.map((group, i) => (
                    <div key={i} className="wp-card" style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 10, padding: "16px 18px", animationDelay: `${i * 60}ms` }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#17293A", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.3 }}>
                        {group.category}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {group.items.map((item, j) => (
                          <label key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5F5E5A", cursor: "pointer" }}>
                            <input type="checkbox" style={{ accentColor: "#2F6E6E" }} />
                            {item}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Itinerary */}
            <SectionLabel icon={Calendar}>Day-by-day itinerary</SectionLabel>
            <div style={{ position: "relative", paddingLeft: 8 }}>
              <div style={{ position: "absolute", left: 26, top: 26, bottom: 26, width: 2, background: "repeating-linear-gradient(to bottom, #C89B3C 0, #C89B3C 6px, transparent 6px, transparent 12px)" }} />
              {trip.itinerary?.map((d, i) => {
                const collapsed = !!collapsedDays[i];
                const isRegenerating = regeneratingDay === i;
                return (
                  <div key={i} style={{ display: "flex", gap: 18, marginBottom: 22, position: "relative" }}>
                    <Stamp day={d.day} delay={i * 90} />
                    <div style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 10, padding: "16px 20px", flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: collapsed ? 0 : 10 }}>
                        <button
                          onClick={() => toggleDayCollapsed(i)}
                          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}
                        >
                          <ChevronDown size={16} color="#888780" style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                          <span style={{ fontWeight: 700, fontSize: 16, color: "#17293A" }}>{d.title}</span>
                        </button>
                        <button
                          className="wp-btn"
                          onClick={() => regenerateDay(i)}
                          disabled={isRegenerating}
                          style={{
                            background: "#F1ECE0", border: "1px solid #D3D1C7", borderRadius: 6,
                            padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#5F5E5A",
                            cursor: isRegenerating ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5,
                          }}
                        >
                          <RefreshCw size={12} style={isRegenerating ? { animation: "spin 0.8s linear infinite" } : {}} />
                          {isRegenerating ? "Refreshing…" : "Regenerate"}
                        </button>
                      </div>
                      {!collapsed && (
                        <div className="wp-day-body">
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                            <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#23201B" }}>
                              <Sun size={15} color="#C89B3C" style={{ flexShrink: 0, marginTop: 1 }} />
                              <span>{d.morning}</span>
                            </div>
                            <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#23201B" }}>
                              <Sunset size={15} color="#B7472A" style={{ flexShrink: 0, marginTop: 1 }} />
                              <span>{d.afternoon}</span>
                            </div>
                            <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#23201B" }}>
                              <Moon size={15} color="#2F6E6E" style={{ flexShrink: 0, marginTop: 1 }} />
                              <span>{d.evening}</span>
                            </div>
                          </div>
                          {d.tip && (
                            <div style={{ fontSize: 12, color: "#5F5E5A", fontStyle: "italic", borderTop: "1px dashed #D3D1C7", paddingTop: 8 }}>
                              Tip: {d.tip}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
