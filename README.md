# 🌊 Urban Flood Nowcasting System (UFNS)
### SIH 2026 — Problem Statement 26085 · Team wallBreakers

> Real-time street-level flood prediction, safe routing, AI assistance, and emergency services — all in one platform.

---

## 🚀 Quick Start (One Command)

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| pgAdmin | http://localhost:5050 |

---

## 🔐 Demo Login Credentials

| Role | Email | Password |
|---|---|---|
| **Citizen** | citizen@ufns.in | Demo@1234 |
| **Admin** | admin@ufns.in | Demo@1234 |

> **Note:** These demo accounts need to be registered first via the Signup page, OR the Admin can be seeded via the database. The Login page has **Demo: Citizen** and **Demo: Admin** buttons that auto-fill the credentials.

---

## 📋 Feature Overview

### 🗺️ Global Interactive Live Map
- **World-wide OSM** tiles — zoom, pan anywhere on Earth
- **Nominatim geocoding** search — find any country, city, street, or landmark
- Click search result to fly the map there; click map to drop a marker
- **Layer toggles**: Flood Heatmap, Roads, Rainfall, Drainage Network, Rivers, Risk Zones
- Road click **popups** showing: Road Name, Lat/Lon, Flood Depth, Rainfall Intensity, Risk Level, Drain Capacity

### 📍 Live GPS Location
1. Click **"Use My Location"** button on the map
2. Browser requests Geolocation permission — grant it
3. A **blue dot** marks your position and the map flies to it
4. Position updates continuously with `watchPosition`
5. If permission is denied → fallback message shown, use search box instead

**Displayed info:**
- Current Latitude / Longitude
- Accuracy (metres)
- City & Ward (via reverse geocoding)

### 🚨 Nearest Emergency Services
After using "Use My Location", emergency service cards appear on the map showing:
- 🏠 Nearest Flood Shelters
- 🏥 Nearest Hospitals
- 👮 Nearest Police Stations
- 🚒 Nearest Fire Stations

Each card shows Name, Distance (km), Capacity, Phone, and a **Navigate** button that flies the map there.

### 🛣️ Smart Safe Route Planner
Navigate to **Route Planner** tab:
1. Enter **From** and **To** locations (supports autocomplete via OSM)
2. Click **Find Safe Route**
3. Route avoids roads with predicted water depth > 15 cm
4. Displays: Route polyline, ETA, Distance, Flooded roads avoided, Max water depth

### 🤖 FloodAssist AI Chatbot
A floating chat button appears in the **bottom-right corner** on all dashboard pages.
Click to open the chat window. Ask anything:

| Query | Example |
|---|---|
| Area safety | "Is my area safe?" |
| Road flooding | "Will MG Road flood?" |
| Shelter | "Find nearest shelter" |
| Hospital | "Nearest hospital" |
| Evacuation | "Safe evacuation route" |
| Emergency numbers | "Police number" |
| Flood depth | "Explain flood depth levels" |
| Rainfall | "Current rainfall summary" |
| Risk | "What does red risk mean?" |

### 🔔 Alert Center
- **Toast popups** for new unread alerts (top-right)
- **Bell icon** with unread count badge
- **Full notifications page** at `/alerts`
- Risk level cards: 🟢 Green / 🟡 Yellow / 🟠 Orange / 🔴 Red
- Admin can broadcast alerts via `POST /api/alerts/broadcast`

---

## 👤 Role-Based Dashboards

### Citizen Dashboard (`/dashboard`)
- Live flood map, Use My Location, Search location
- Weather summary, water depth KPIs
- Flood alerts panel, Emergency contacts
- FloodAssist AI chatbot

### Admin Dashboard (`/authority`)
- Upload rainfall CSV
- Upload flood datasets
- Retrain AI model
- Start rainfall simulation
- User management
- Alert broadcasting
- Sensor monitoring
- Model accuracy metrics
- Download reports

---

## 🧠 How to Retrain the AI Model

```bash
# SSH into the backend container
docker exec -it ufns_backend bash

# Run retraining script
python ai/train.py --epochs 100 --model xgboost

# Or via the Admin Dashboard UI
# → Navigate to /authority → Click "Retrain AI Model"
```

---

## 📤 How to Upload Datasets

### Via Admin Dashboard UI
1. Login as Admin
2. Go to **Admin Dashboard** (`/authority`)
3. Click **"Upload Rainfall CSV"** or **"Upload Flood Datasets"**
4. Select file → Upload

### Via API
```bash
curl -X POST http://localhost:8000/api/admin/upload \
  -H "Authorization: Bearer <your_admin_token>" \
  -F "file=@rainfall_data.csv"
```

---

## 📡 API Documentation

Full interactive docs: **http://localhost:8000/docs**

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login (returns JWT) |
| GET | `/api/auth/profile` | Get current user profile |

### Location
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/location/search?q={query}` | Nominatim geocoding search |
| GET | `/api/location/reverse?lat={lat}&lon={lon}` | Reverse geocode to address |

### Emergency Services
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/shelters/nearest?lat=&lon=&limit=5` | Nearest flood shelters |
| GET | `/api/hospitals/nearest?lat=&lon=&limit=5` | Nearest hospitals |
| GET | `/api/police/nearest?lat=&lon=&limit=5` | Nearest police stations |
| GET | `/api/fire/nearest?lat=&lon=&limit=5` | Nearest fire stations |

### Safe Routing
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/routes/safe?from_lat=&from_lon=&to_lat=&to_lon=` | Safe route avoiding flooded roads |

### Flood Prediction
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rainfall` | Rainfall grid data |
| POST | `/api/predict` | Single-point flood prediction |
| GET | `/api/map` | Full flood GeoJSON |
| GET | `/api/summary` | Simulation summary |
| GET | `/api/alerts` | Active alerts |
| GET | `/api/metrics` | Model accuracy metrics |

### AI Chatbot
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | Send message to FloodAssist AI |
| GET | `/api/chat/history/{user_id}` | Get chat history |

### Alerts
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/alerts/notifications` | Get notifications |
| POST | `/api/alerts/broadcast` | Broadcast alert (Admin only) |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/simulate` | Inject rainfall simulation |
| POST | `/api/admin/reset` | Reset simulation |

### WebSocket
```
ws://localhost:8000/ws/live  — Live flood updates (push every 30s)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│  React Frontend (Vite + TypeScript)                  │
│  ├── Leaflet / OSM Maps (Global, Nominatim)          │
│  ├── JWT AuthContext (Role-based routing)            │
│  ├── FloodAssist AI Chatbot (floating)               │
│  └── Alert Center (toasts + bell + page)            │
└───────────────┬────────────────────────────────────-─┘
                │ HTTP / WebSocket
┌───────────────▼─────────────────────────────────────┐
│  FastAPI Backend (Python 3.11)                       │
│  ├── JWT Auth (python-jose + bcrypt)                 │
│  ├── XGBoost Flood Prediction Model                  │
│  ├── NetworkX Drain Graph                            │
│  ├── Haversine Emergency Services                    │
│  └── Nominatim Geocoding Proxy                       │
└───────────────┬─────────────────────────────────────┘
                │ SQLAlchemy + asyncpg
┌───────────────▼─────────────────────────────────────┐
│  PostgreSQL 15 + PostGIS 3.3                         │
│  Tables: users, shelters, hospitals, police_stations │
│  fire_stations, chat_history, notifications,         │
│  saved_locations (+ all existing flood tables)       │
└─────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Tables

### New Tables (v2.0)
| Table | Description |
|---|---|
| `users` | Registered users (citizens & admins) with bcrypt passwords |
| `shelters` | Flood shelters with PostGIS location |
| `hospitals` | Hospitals with PostGIS location |
| `police_stations` | Police stations with PostGIS location |
| `fire_stations` | Fire stations with PostGIS location |
| `chat_history` | Per-user FloodAssist AI conversation history |
| `notifications` | Broadcast & targeted alerts with risk levels |
| `saved_locations` | User's bookmarked locations |

> **Existing flood prediction tables are untouched.**

---

## 🛠️ Local Development (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## 📁 Project Structure

```
urban-flood-nowcasting/
├── backend/
│   ├── main.py                  # FastAPI app + lifespan
│   ├── database.py              # Async SQLAlchemy engine
│   ├── models/
│   │   ├── user.py              # User model
│   │   ├── emergency.py         # Shelter/Hospital/Police/Fire
│   │   └── activity.py          # Chat history/Notifications
│   ├── routers/
│   │   ├── auth.py              # Signup/Login/Profile
│   │   ├── emergency.py         # Nearest services
│   │   ├── location.py          # Nominatim geocoding
│   │   ├── saferoute.py         # Safe flood-aware routing
│   │   ├── chat.py              # FloodAssist AI
│   │   └── alertrouter.py       # Notifications & broadcast
│   ├── services/
│   │   └── auth.py              # JWT + bcrypt utilities
│   └── schemas/
│       └── auth.py              # Pydantic auth schemas
├── frontend/
│   └── src/
│       ├── contexts/
│       │   └── AuthContext.tsx   # JWT auth state
│       ├── pages/
│       │   ├── Login.tsx         # JWT login + demo buttons
│       │   ├── Signup.tsx        # Registration with validation
│       │   ├── Profile.tsx       # User profile & settings
│       │   ├── GISMap.tsx        # Global OSM map
│       │   ├── Alerts.tsx        # Alert center
│       │   ├── RoutePlanner.tsx  # Safe route planner
│       │   ├── CitizenDashboard.tsx
│       │   └── AuthorityDashboard.tsx
│       └── components/
│           ├── Chatbot.tsx       # FloodAssist AI floating chat
│           └── Layout.tsx        # Role-aware sidebar
├── docker-compose.yml
└── README.md
```

---

## 🤝 Team wallBreakers

Built for Smart India Hackathon 2026 · Problem Statement 26085
