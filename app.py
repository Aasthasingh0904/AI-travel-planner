import streamlit as st
import json
import re
import time
import uuid
from pathlib import Path
from google import genai
from google.genai import types

# ---------- CONFIG ----------
st.set_page_config(page_title="Waypoint — AI Travel Planner", page_icon="🧭", layout="centered")

TRIPS_FILE = Path("trips.json")

BUDGET_LEVELS = {
    "shoestring": "Shoestring — hostels, street food, free sights",
    "midrange": "Mid-range — 3-star hotels, sit-down meals",
    "comfort": "Comfort — 4-star hotels, nicer restaurants",
    "luxury": "Luxury — top hotels, fine dining, no limits",
}

INTERESTS = [
    "Food & drink", "Art & museums", "Nature & outdoors", "History",
    "Nightlife", "Shopping", "Relaxation", "Adventure", "Local culture", "Architecture",
]

# If you get a "model not found" error, copy the current Flash model name from Google AI Studio
MODEL = "gemini-flash-latest"


# ---------- STORAGE HELPERS ----------
def load_trips():
    if TRIPS_FILE.exists():
        try:
            return json.loads(TRIPS_FILE.read_text())
        except Exception:
            return []
    return []


def save_trips(trips):
    TRIPS_FILE.write_text(json.dumps(trips, indent=2))


def upsert_trip(trip):
    trips = load_trips()
    trips = [t for t in trips if t["id"] != trip["id"]]
    trips.append(trip)
    save_trips(trips)


def delete_trip(trip_id):
    trips = [t for t in load_trips() if t["id"] != trip_id]
    save_trips(trips)


# ---------- GEMINI CALL ----------
def get_client():
    api_key = st.secrets.get("GEMINI_API_KEY")
    if not api_key:
        st.error("No GEMINI_API_KEY found in Streamlit secrets. Add it under App settings → Secrets.")
        st.stop()
    return genai.Client(api_key=api_key)


def strip_fences(text):
    return re.sub(r"```json\s*|```\s*", "", text).strip()


def call_claude(prompt):
    """Name kept so the rest of the app is unchanged; this now calls Gemini."""
    client = get_client()
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            max_output_tokens=8192,
        ),
    )
    return json.loads(strip_fences(response.text))


def build_prompt(destination, budget_label, days, interests):
    interests_str = ", ".join(interests) if interests else "a balanced mix of everything"
    return f"""You are a travel planner. Create a complete trip plan for a trip to {destination}, for {days} day(s), at a "{budget_label}" budget level, focused on these interests: {interests_str}.

Respond with ONLY raw JSON (no markdown fences, no preamble, no commentary) matching exactly this schema:

{{
  "destination": "City, Country",
  "budgetLevel": "{budget_label}",
  "estimatedTotalCost": "short string like $600-900 per person",
  "tripLength": {days},
  "bestTimeToVisit": "short string",
  "summary": "2-3 sentence overview of the trip and its vibe",
  "placesToVisit": [
    {{ "name": "...", "category": "e.g. Landmark, Museum, Park, Viewpoint", "description": "1-2 sentences", "estimatedTime": "e.g. 2 hours" }}
  ],
  "restaurants": [
    {{ "name": "...", "cuisine": "...", "priceRange": "$ | $$ | $$$ | $$$$", "mustTry": "a specific dish or drink" }}
  ],
  "itinerary": [
    {{ "day": 1, "title": "short theme for the day", "morning": "...", "afternoon": "...", "evening": "...", "tip": "one practical local tip" }}
  ],
  "budgetBreakdown": [
    {{ "category": "Accommodation", "percentage": 35 }},
    {{ "category": "Food & drink", "percentage": 25 }},
    {{ "category": "Activities", "percentage": 20 }},
    {{ "category": "Transport", "percentage": 12 }},
    {{ "category": "Shopping & extras", "percentage": 8 }}
  ],
  "packingList": [
    {{ "category": "Clothing", "items": ["...", "..."] }},
    {{ "category": "Essentials", "items": ["...", "..."] }}
  ]
}}

Include 6-8 placesToVisit, 6 restaurants, and exactly {days} itinerary entries (days numbered 1 to {days}). budgetBreakdown percentages must sum to 100. Be specific and realistic to {destination}. Return ONLY the JSON object."""


def build_day_prompt(destination, budget_label, day_num, old_title):
    return f"""Rewrite a SINGLE day of a trip to {destination} at a "{budget_label}" budget level. This is day {day_num}. The previous theme was "{old_title}" — write a genuinely different day.

Respond with ONLY raw JSON: {{ "day": {day_num}, "title": "...", "morning": "...", "afternoon": "...", "evening": "...", "tip": "..." }}"""


# ---------- SESSION STATE ----------
if "view" not in st.session_state:
    st.session_state.view = "form"
if "trip" not in st.session_state:
    st.session_state.trip = None
if "current_trip_id" not in st.session_state:
    st.session_state.current_trip_id = None

st.title("🧭 Waypoint — AI Travel Planner")

# ---------- SIDEBAR NAV ----------
with st.sidebar:
    st.header("Navigate")
    if st.button("✈️ Plan a trip", use_container_width=True):
        st.session_state.view = "form"
        st.session_state.trip = None
        st.rerun()
    trips = load_trips()
    if st.button(f"📖 My trips ({len(trips)})", use_container_width=True):
        st.session_state.view = "saved"
        st.rerun()

# ---------- FORM VIEW ----------
if st.session_state.view == "form":
    st.subheader("Where to?")
    destination = st.text_input("Destination", placeholder="e.g. Lisbon, Portugal")
    budget_id = st.radio("Budget level", list(BUDGET_LEVELS.keys()), format_func=lambda k: BUDGET_LEVELS[k])
    days = st.slider("Trip length (days)", 1, 14, 4)
    interests = st.multiselect("Interests (optional)", INTERESTS)

    if st.button("✨ Generate my trip", type="primary", use_container_width=True):
        if not destination.strip():
            st.error("Enter a destination first.")
        else:
            budget_label = BUDGET_LEVELS[budget_id].split(" — ")[0]
            with st.spinner(f"Charting a course to {destination}…"):
                try:
                    trip = call_claude(build_prompt(destination.strip(), budget_label, days, interests))
                    trip["id"] = str(uuid.uuid4())
                    trip["favorites"] = []
                    st.session_state.trip = trip
                    st.session_state.current_trip_id = None
                    st.session_state.view = "result"
                    st.rerun()
                except Exception as e:
                    st.error(f"Couldn't generate that trip: {e}")

# ---------- SAVED TRIPS VIEW ----------
elif st.session_state.view == "saved":
    st.subheader("My trips")
    trips = load_trips()
    if not trips:
        st.info("No saved trips yet. Plan one and save it for later.")
    else:
        search = st.text_input("Search saved trips", "")
        filtered = [t for t in trips if search.lower() in t["destination"].lower()]
        for t in filtered:
            with st.container(border=True):
                col1, col2 = st.columns([4, 1])
                with col1:
                    st.markdown(f"**{t['destination']}**  \n{t['budgetLevel']} · {t['tripLength']} days · {t['estimatedTotalCost']}")
                with col2:
                    if st.button("Open", key=f"open_{t['id']}"):
                        st.session_state.trip = t
                        st.session_state.current_trip_id = t["id"]
                        st.session_state.view = "result"
                        st.rerun()
                    if st.button("Delete", key=f"del_{t['id']}"):
                        delete_trip(t["id"])
                        st.rerun()

# ---------- RESULT VIEW ----------
elif st.session_state.view == "result" and st.session_state.trip:
    trip = st.session_state.trip

    if st.button("← Plan another trip"):
        st.session_state.view = "form"
        st.session_state.trip = None
        st.rerun()

    st.header(trip["destination"])
    st.caption(f"{trip['budgetLevel']} trip · {trip['tripLength']} days")
    st.write(trip["summary"])
    col1, col2 = st.columns(2)
    col1.metric("Estimated cost", trip["estimatedTotalCost"])
    col2.metric("Best time to visit", trip["bestTimeToVisit"])

    if st.button("💾 Save this trip", type="primary"):
        trip_id = st.session_state.current_trip_id or str(uuid.uuid4())
        trip["id"] = trip_id
        trip["savedAt"] = time.time()
        upsert_trip(trip)
        st.session_state.current_trip_id = trip_id
        st.success("Trip saved!")

    st.divider()
    st.subheader("💰 Budget breakdown")
    for b in trip.get("budgetBreakdown", []):
        st.write(f"{b['category']} — {b['percentage']}%")
        st.progress(b["percentage"] / 100)

    st.divider()
    st.subheader("📍 Places to visit")
    for p in trip.get("placesToVisit", []):
        with st.container(border=True):
            st.markdown(f"**{p['name']}** · _{p['category']}_")
            st.write(p["description"])
            st.caption(f"⏱ {p['estimatedTime']}")

    st.divider()
    st.subheader("🍽 Where to eat")
    for r in trip.get("restaurants", []):
        with st.container(border=True):
            st.markdown(f"**{r['name']}** ({r['priceRange']}) · _{r['cuisine']}_")
            st.caption(f"Try the {r['mustTry']}")

    if trip.get("packingList"):
        st.divider()
        st.subheader("🎒 Packing list")
        for group in trip["packingList"]:
            with st.expander(group["category"]):
                for item in group["items"]:
                    st.checkbox(item, key=f"pack_{group['category']}_{item}")

    st.divider()
    st.subheader("📅 Day-by-day itinerary")
    for i, d in enumerate(trip.get("itinerary", [])):
        with st.expander(f"Day {d['day']}: {d['title']}", expanded=True):
            st.markdown(f"**☀️ Morning:** {d['morning']}")
            st.markdown(f"**🌇 Afternoon:** {d['afternoon']}")
            st.markdown(f"**🌙 Evening:** {d['evening']}")
            if d.get("tip"):
                st.caption(f"💡 Tip: {d['tip']}")
            if st.button(f"🔄 Regenerate day {d['day']}", key=f"regen_{i}"):
                budget_label = trip["budgetLevel"]
                with st.spinner("Refreshing this day…"):
                    try:
                        fresh = call_claude(build_day_prompt(trip["destination"], budget_label, d["day"], d["title"]))
                        trip["itinerary"][i] = fresh
                        st.session_state.trip = trip
                        st.rerun()
                    except Exception as e:
                        st.error(f"Couldn't refresh that day: {e}")
