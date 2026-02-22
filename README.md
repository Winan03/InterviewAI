# 🎙️ VozInterview — AI Interview Assistant

> Real-time AI-powered interview assistant with stealth screen overlay, image solver, and bilingual explanations. Built with FastAPI, React, Electron, and Hugging Face AI models.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Backend API Routes](#backend-api-routes)
- [Frontend Components](#frontend-components)
- [Electron Desktop App](#electron-desktop-app)
- [Landing Page](#landing-page)
- [Environment Variables](#environment-variables)
- [Setup & Installation](#setup--installation)
- [Development](#development)
- [Build & Deployment](#build--deployment)
- [Scalability Notes](#scalability-notes)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Landing Page                          │
│  (Static HTML/CSS/JS — auth.html, dashboard.html)        │
│  Hosted at: /landing on same backend                     │
└────────────┬─────────────────────┬───────────────────────┘
             │ Login/Register      │ Download EXE (Premium)
             ▼                     ▼
┌──────────────────────────────────────────────────────────┐
│                   FastAPI Backend                         │
│  Port: 8000                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ auth.py  │ │payments  │ │solver.py │ │  main.py   │  │
│  │ JWT Auth │ │ Stripe   │ │ Vision AI│ │ WebSocket  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│       │              │            │             │         │
│       ▼              ▼            ▼             ▼         │
│  PostgreSQL     Stripe API   HF Vision     HF Text AI    │
└──────────────────────────────────────────────────────────┘
             ▲                           ▲
             │ REST + WebSocket          │ IPC
┌──────────────────────────────────────────────────────────┐
│              Electron Desktop App                         │
│  ┌──────────────────────────────────────────────────┐    │
│  │  React Frontend (Vite)                            │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │    │
│  │  │Interview │ │ Solver   │ │  Auth / Setup    │  │    │
│  │  │  Mode    │ │  Mode    │ │                  │  │    │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌─────────────────────┐ ┌───────────────────────────┐   │
│  │ Ghost Mode          │ │ Stealth Screen Capture    │   │
│  │ Ctrl+Shift+Space    │ │ Content-protected snip    │   │
│  │ System Tray         │ │ overlay with DPI support  │   │
│  └─────────────────────┘ └───────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
VozInterview/
├── .env                    # Environment variables (NOT tracked)
├── .env.example            # Template for required env vars
├── .gitignore              # Security exclusions
├── setup.bat               # One-click setup script
│
├── backend/                # FastAPI backend
│   ├── main.py             # App entry + WebSocket + REST endpoints
│   ├── config.py           # Pydantic settings (reads .env)
│   ├── auth.py             # JWT authentication (register/login)
│   ├── payments.py         # Stripe checkout, webhooks, download
│   ├── solver.py           # Image Solver (HF Vision AI)
│   ├── ai_client.py        # AI text generation (HF/AIML fallback)
│   ├── transcription.py    # Audio transcription (Whisper)
│   ├── pdf_parser.py       # PDF/CV text extraction
│   ├── models.py           # SQLAlchemy User model
│   ├── database.py         # Async DB engine + sessions
│   ├── requirements.txt    # Python dependencies
│   └── test_*.py           # Test scripts
│
├── frontend/               # React + Vite + Electron
│   ├── electron/
│   │   ├── main.cjs        # Electron main process (ghost mode, IPC, tray)
│   │   └── snip.html       # Screen capture overlay (DPI-aware canvas)
│   ├── src/
│   │   ├── App.jsx         # Mode switcher (Interview / Solver)
│   │   ├── main.jsx        # React entry point
│   │   ├── index.css       # Global styles
│   │   ├── components/
│   │   │   ├── AudioCapture.jsx    # Microphone + system audio capture
│   │   │   ├── AuthScreen.jsx      # Login/Register UI
│   │   │   ├── ChatHistory.jsx     # Past interview sessions
│   │   │   ├── ImageSolver.jsx     # Image upload + capture + results
│   │   │   ├── NewChatModal.jsx    # New session creation
│   │   │   ├── Overlay.jsx         # AI response overlay display
│   │   │   ├── SetupScreen.jsx     # CV upload + job description
│   │   │   └── WindowControls.jsx  # Custom titlebar buttons
│   │   └── hooks/
│   │       ├── useAuth.js          # JWT auth state management
│   │       ├── useChatHistory.js   # Session history persistence
│   │       └── useWebSocket.js     # Real-time backend connection
│   ├── package.json        # Dependencies + electron-builder config
│   └── vite.config.js      # Vite configuration (base: './')
│
├── landing/                # Public marketing site
│   ├── index.html          # Landing page (pricing, features)
│   ├── styles.css          # Landing page styles
│   ├── script.js           # Landing page interactions
│   ├── auth.html           # Login/Register page
│   ├── auth.css            # Auth page styles
│   ├── auth.js             # Auth logic (JWT handling)
│   └── dashboard.html      # User dashboard (plan info, download)
│
└── n8n/                    # Automation workflows
    └── interview_assistant_workflow.json
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | FastAPI + Uvicorn | REST API + WebSocket server |
| **Database** | PostgreSQL + SQLAlchemy (async) | User accounts, subscriptions |
| **Auth** | JWT (PyJWT) | Stateless session tokens |
| **Payments** | Stripe Checkout | Premium subscription billing |
| **AI Text** | Hugging Face Router → Gemma 3 12B | Interview response generation |
| **AI Vision** | Hugging Face Router → Qwen2.5-VL-7B | Image exercise analysis |
| **Transcription** | Whisper (OpenAI) | Audio → text |
| **Frontend** | React 18 + Vite | SPA with component architecture |
| **Desktop** | Electron 28 | Native Windows overlay app |
| **Landing** | Vanilla HTML/CSS/JS | Marketing site + auth + dashboard |

---

## 🔌 Backend API Routes

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Create new user account | No |
| `POST` | `/api/auth/login` | Get JWT access token | No |
| `GET` | `/api/auth/me` | Get current user info | JWT |

### Payments (`/api/payments`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/payments/create-checkout` | Create Stripe checkout session | JWT |
| `POST` | `/api/payments/webhook` | Stripe webhook (payment confirmation) | Stripe sig |
| `GET` | `/api/payments/status` | Check user subscription status | JWT |
| `GET` | `/api/payments/download` | Download Electron installer (.exe) | JWT + Premium |

### Image Solver (`/api/solver`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/solver/analyze` | Analyze exercise image → JSON result | JWT |

**Request body:**
```json
{
  "image_base64": "data:image/png;base64,...",
  "question": "(optional) Explain the grammar rule"
}
```

**Response:**
```json
{
  "answer": "1. have lived\n2. will cancel\n...",
  "explanation_en": "English explanation...",
  "explanation_es": "Explicación en español...",
  "exercise_type": "fill-in-the-blank"
}
```

### Real-time Interview (`/ws/audio`)

| Protocol | Endpoint | Description |
|---|---|---|
| `WebSocket` | `/ws/audio?token=<jwt>` | Real-time audio stream + AI responses |

**WebSocket message types:**
- `audio` → Transcribe audio and respond with AI
- `text` → Process text directly with AI  
- `set_context` → Set CV/job description for the session
- `ping` → Heartbeat

### Other Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/health` | Detailed health check |
| `POST` | `/upload-context` | Upload CV PDFs + job description |
| `POST` | `/transcribe` | One-shot audio transcription |
| `POST` | `/process` | One-shot AI processing |

---

## ⚛️ Frontend Components

### Modes

| Mode | Component | Description |
|---|---|---|
| 🎧 **Interview** | `Overlay.jsx` + `AudioCapture.jsx` | Real-time audio capture + AI overlay |
| 📸 **Solver** | `ImageSolver.jsx` | Image upload/capture + bilingual analysis |

### Component Map

| Component | Purpose |
|---|---|
| `App.jsx` | Root component with mode switcher tabs |
| `AuthScreen.jsx` | Login / Register with JWT persistence |
| `SetupScreen.jsx` | CV upload + job description setup |
| `AudioCapture.jsx` | Browser audio recording (mic + system) |
| `Overlay.jsx` | Floating AI response display |
| `ImageSolver.jsx` | Drag/drop image upload + screen capture + results |
| `ChatHistory.jsx` | Past interview session viewer |
| `NewChatModal.jsx` | Modal to start a new interview session |
| `WindowControls.jsx` | Custom Electron titlebar (minimize, pin, close) |

### Hooks

| Hook | Purpose |
|---|---|
| `useAuth.js` | JWT token management, login/logout, user state |
| `useChatHistory.js` | localStorage-backed session history |
| `useWebSocket.js` | Auto-reconnecting WebSocket to backend |

---

## 🖥️ Electron Desktop App

### Ghost Mode Features

| Feature | Mechanism |
|---|---|
| **Invisible in screen share** | `setContentProtection(true)` on all windows |
| **No taskbar icon** | `skipTaskbar: true` |
| **Global toggle** | `Ctrl+Shift+Space` shows/hides the window |
| **System tray** | Small icon near clock with right-click menu |
| **Always on top** | `alwaysOnTop: true, 'floating'` level |

### Screen Capture (Snipping Tool)

1. User clicks **✂️ Capturar Pantalla** in Solver mode
2. Main window hides → full screen is captured via `desktopCapturer`
3. Content-protected overlay appears with frozen screenshot
4. User drags a rectangle to select region
5. Region is cropped at native DPI resolution → sent as base64 to Solver
6. Main window restores

### IPC Channels

| Channel | Direction | Purpose |
|---|---|---|
| `start-snip` | Renderer → Main | Begin screen capture flow |
| `set-screenshot` | Main → Snip | Send screenshot to overlay |
| `snip-complete` | Snip → Main | Send selected region coordinates |
| `snip-cancel` | Snip → Main | Cancel capture (ESC) |
| `snip-result` | Main → Renderer | Send cropped base64 image to ImageSolver |
| `window-minimize` | Renderer → Main | Minimize app |
| `window-close` | Renderer → Main | Close app |
| `window-toggle-pin` | Renderer → Main | Toggle always-on-top |
| `window-compact` | Renderer → Main | Compact window size |
| `window-expand` | Renderer → Main | Expand window size |

---

## 🌐 Landing Page

| File | URL Path | Purpose |
|---|---|---|
| `index.html` | `/landing/` | Marketing page with features + pricing |
| `auth.html` | `/landing/auth.html` | Login / Register page |
| `dashboard.html` | `/landing/dashboard.html` | User dashboard (plan status, download) |

The landing pages are served as static files by FastAPI at `/landing/*`.

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `HF_API_TOKEN` | ✅ | Hugging Face API token (free tier) |
| `HF_MODEL` | | Text AI model (default: gemma-3-12b-it) |
| `HF_API_URL` | | HF Router URL |
| `HF_VISION_MODEL` | | Vision AI model (default: Qwen2.5-VL-7B) |
| `AIML_API_KEY` | | Fallback AI provider key |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET_KEY` | ✅ | Secret key for signing JWT tokens |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe webhook signing secret |

---

## 🚀 Setup & Installation

### Prerequisites

- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **PostgreSQL 15+** running locally
- **Git**

### Quick Setup (Windows)

```bash
# Clone the repository
git clone https://github.com/your-username/VozInterview.git
cd VozInterview

# Copy environment template
cp .env.example .env
# Edit .env with your actual API keys

# Run the setup script
setup.bat
```

### Manual Setup

```bash
# 1. Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 2. Frontend (in a new terminal)
cd frontend
npm install
npm run dev          # Web only
npm run electron:dev # Electron + Web

# 3. Database
# Create PostgreSQL database named 'vozinterview'
# Tables are auto-created on backend startup
```

---

## 🏗️ Development

### Running in Development

```bash
# Terminal 1: Backend
cd backend && venv\Scripts\activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend + Electron
cd frontend
npm run electron:dev
```

### Key Development URLs

| URL | Purpose |
|---|---|
| `http://localhost:8000` | Backend API |
| `http://localhost:8000/docs` | Swagger API documentation |
| `http://localhost:8000/landing/` | Landing page |
| `http://localhost:5173` | Vite dev server (React) |

---

## 📦 Build & Deployment

### Building the Electron Installer

```bash
cd frontend
npm run electron:build
# Output: release/VozInterview Setup 1.0.0.exe (~73 MB)
```

### Deploying the Backend

The backend can be deployed to any platform supporting Python:

```bash
# Production start
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

**Recommended platforms:** Railway, Render, AWS EC2, DigitalOcean.

### Serving the Landing Page

The landing pages are static and served by FastAPI at `/landing/*`. In production, consider serving them via Nginx or a CDN for better performance.

---

## 📈 Scalability Notes

### Database
- Currently using async SQLAlchemy with `asyncpg` driver
- Schema supports subscription management with `plan_expires_at`
- **Scale path:** Add connection pooling (pgBouncer), read replicas

### AI Models
- Primary: HF Router (free tier, rate limited)
- Fallback: AIML API
- **Scale path:** Add OpenAI/Anthropic as paid fallbacks, implement request queuing

### WebSocket
- Single-server ConnectionManager manages active connections
- **Scale path:** Use Redis PubSub for multi-server WebSocket coordination

### Frontend
- React SPA with Vite — fast HMR in dev, optimized production builds
- **Scale path:** Add React Router for multi-page, lazy loading for code splitting

### Electron
- Single-platform (Windows) NSIS installer
- **Scale path:** Add macOS (DMG) and Linux (AppImage) targets in `package.json`

### Payments
- Stripe Checkout with webhook-based fulfillment
- **Scale path:** Add subscription renewal, team plans, usage-based billing

---

## 📄 License

Private — All rights reserved.
