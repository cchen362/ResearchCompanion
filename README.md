# Medical Research Companion PWA

An autonomous medical research companion that helps caregivers of rare disease patients stay up-to-date with the latest medical research, clinical trials, and treatment breakthroughs. Built with a server-first architecture and AI-powered intelligence.

## Current Features

### Autonomous Research Agents (3 Active)

Three parallel research agents continuously scan medical databases for new findings:

- **PubMed Literature Monitor**: Searches peer-reviewed medical journals and publications via PubMed E-utilities
- **Clinical Trial Scanner**: Tracks new trials, enrollment changes, and trial results via ClinicalTrials.gov API
- **Medical Literature & Web Researcher**: Monitors FDA approvals and supplementary research via Brave Search and FDA APIs

Agents run autonomously on configurable schedules (hourly, daily, weekly, or adaptive) with manual "Run Now" available anytime.

### Smart Digest System

AI-powered weekly digests synthesize research findings into magazine-style summaries:

- **Featured Discovery**: Highlighted breakthrough with full context
- **Themes & Contradictions**: Grouped analysis of research patterns
- **Breakthroughs**: Notable advances with evidence grading
- **Knowledge Gaps**: Areas where more research is needed
- **Questions for Doctor**: Evidence-based questions to bring to appointments
- **Warning Signs**: Safety-critical signals from the research
- **Technical/Explained Toggle**: Every section offers dual modes — full technical detail or plain-language explanation
- **Digest TOC with Scroll-Spy**: Sidebar navigation for long digests (desktop)

### AI Chat Companion

Server-first persistent chat rebuilt for reliability and warmth:

- **Streaming Responses**: Real-time token streaming via POST-based SSE
- **Citation Integration**: Clickable citation buttons linking directly to source findings
- **Warm Companion Persona**: Caregiver-focused language, not clinical bot tone
- **Suggested Questions**: Context-aware follow-up questions based on your research
- **Message Persistence**: All messages stored in PostgreSQL, accessible across devices
- **Push/Reflow Layout**: Chat panel pushes content aside on wide screens, overlays on narrow

### Companion Intelligence

AI-driven features that surface insights proactively:

- **Research Pulse**: A one-sentence AI companion summary per topic (e.g., "Your Haemophilia research has 3 new breakthroughs this week...")
- **Worth Revisiting**: AI identifies connections between older findings and new breakthroughs, showing reasoning like "Shared therapeutic target" or "Confirms earlier hypothesis" in a center modal with side-by-side comparison
- **Explained Mode**: Technical/Explained toggle on Worth Revisiting cards for accessibility

### Unified Home Page

A single dashboard merging the former Dashboard and Research Insights views:

- **Bento Grid Layout**: 3-column responsive grid on desktop, stacks on mobile
- **Topic Filtering**: Filter all content by medical condition
- **Findings Highlights**: Teaser preview cards for recent findings
- **Digest Signposts**: Key insights from latest digest at a glance
- **Research Pulse Cards**: AI companion intelligence front and center
- **Source Breakdown**: PubMed / Clinical / Web categorization badges

### Design System

A comprehensive design token foundation:

- **Medical Blue Palette**: Evolved from indigo to HSL 222 medical blue
- **System Dark Mode**: Automatic via `prefers-color-scheme: dark`
- **60+ CSS Custom Properties**: Colors, surfaces, shadows, spacing, typography
- **Typography**: Figtree (headings) + Noto Sans (body)
- **Responsive Layouts**: Mobile-first to 1920px+ with adaptive containers (1600-1680px max)
- **Accessibility**: WCAG AA contrast ratios, 44x44px touch targets, `prefers-reduced-motion` support

### User Authentication

- **Redesigned Auth Page**: Split layout with gradient branding panel and pill toggle (Sign In / Create Account)
- **JWT Authentication**: 30-day token expiry with multi-device session management
- **Secure Storage**: bcrypt password hashing, PostgreSQL session tracking
- **Responsive**: Desktop split layout collapses to single column on mobile

### Data Export

- Professional PDF reports with research summaries
- CSV and JSON export for research data
- Formatted for sharing with medical professionals

### Privacy & Security

- **Server-First Architecture**: PostgreSQL is the sole source of truth for all data
- **Data Encryption**: Passwords hashed with bcrypt, JWT for sessions
- **User Isolation**: Row-level security for multi-tenant data
- **User-Controlled**: Export or delete your data anytime
- **HIPAA-Ready**: Architecture designed for healthcare compliance

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Modern web browser

### Quick Start with Docker (Recommended)

1. Clone the repository:
```bash
git clone [repository-url]
cd medical-companion-pwa
```

2. Copy environment template and configure:
```bash
cp .env.example .env
# Edit .env and add your API keys:
#   ANTHROPIC_API_KEY - Required for AI features (Claude)
#   OPENAI_API_KEY    - Required for voice transcription (Whisper)
#   BRAVE_API_KEY     - Required for web research agent
#   PUBMED_API_KEY    - Optional, improves PubMed rate limits
#   JWT_SECRET        - Generate a secure random string
```

3. Start with Docker Compose:
```bash
docker compose up -d --build
```

4. Open your browser at `http://localhost:6767`

**Important:** Never commit API keys or passwords to version control. All `.env` files are gitignored.

### Manual Development Setup

1. Install dependencies:
```bash
npm install
cd backend && npm install && cd ..
```

2. Start PostgreSQL:
```bash
docker run -d \
  --name medcompanion-postgres \
  -e POSTGRES_DB=medcompanion \
  -e POSTGRES_USER=meduser \
  -e POSTGRES_PASSWORD=medpass123 \
  -p 5432:5432 \
  postgres:15-alpine
```

3. Configure environment:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
# Edit both .env files with your API keys and:
#   DATABASE_URL=postgresql://meduser:medpass123@localhost:5432/medcompanion
```

4. Start both servers:

**Terminal 1 — Backend:**
```bash
cd backend
npm run build
npm start
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

5. Open your browser at `http://localhost:5176`

### Building for Production

```bash
# Build frontend
npm run build

# Build backend
cd backend
npm run build
```

The built files will be in `dist/` (frontend) and `backend/dist/` (backend).

## PWA Installation

This app can be installed on your device for quick access:

1. Open the app in Chrome or Edge
2. Click the install icon in the address bar
3. Follow the prompts to add to your home screen

Note: The app requires a network connection for all features (AI, research agents, data persistence).

## Project Structure

```
medical-companion-pwa/
├── src/
│   ├── types/                  # TypeScript type definitions
│   ├── utils/
│   │   ├── db/                 # IndexedDB cache operations
│   │   ├── sourceCategory.ts   # Canonical source categorization
│   │   └── logger.ts           # Centralized logging
│   ├── services/               # API client services
│   ├── stores/                 # Zustand state management
│   │   ├── uiStore.ts          # UI state, modals, view settings
│   │   └── chatStore.ts        # Chat streaming state only
│   ├── components/
│   │   ├── home/               # Home page (bento grid, pulse, signposts)
│   │   ├── research/           # Findings page (cards, drawers, digest, toolbar)
│   │   ├── chat/               # Chat panel and suggested questions
│   │   ├── agents/             # Agent monitoring components
│   │   ├── digest/             # Digest display components
│   │   ├── auth/               # Auth page and guard
│   │   └── ui/                 # Radix UI base components
│   └── App.tsx                 # Routing and app shell
├── backend/
│   ├── src/
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Business logic (AI, agents, search, digest)
│   │   ├── models/             # PostgreSQL data models
│   │   ├── middleware/         # Auth middleware
│   │   ├── schemas/            # Zod validation schemas
│   │   └── db/                 # Database init and migrations
│   └── dist/                   # Compiled JavaScript
├── IMPLEMENTATION_PLANS/       # Feature implementation blueprints
├── docker-compose.yml          # Production containerization
├── Dockerfile                  # Multi-stage build (frontend + backend + nginx)
└── vite.config.ts              # Vite configuration
```

## Usage Guide

### Navigation

The app has four main tabs:

| Tab | Purpose |
|-----|---------|
| **Home** | Dashboard with findings highlights, digest signposts, research pulse |
| **Topics** | Create and manage medical conditions to track |
| **Agents** | Monitor and configure autonomous research agents |
| **Findings** | Browse all research findings, view digests, explore sources |

The chat panel is accessible from any page via the message icon in the header.

### Adding a Disease Topic

1. Navigate to the **Topics** tab
2. Click **Add Topic**
3. Enter the topic name, disease name, update frequency, and patient age group
4. The app automatically creates 3 monitoring agents for your topic

### Viewing Research

- **Home**: At-a-glance overview with AI companion intelligence
- **Findings tab**: Full findings list with source filtering (PubMed / Clinical / Web), date filtering, and list/digest view toggle
- **Smart Digests**: Click the digest view to see AI-synthesized summaries with the Technical/Explained toggle
- **Chat**: Ask questions about your findings — responses include clickable citation buttons

### Agent Configuration

Agents can be customized per topic:
- Update frequency (hourly, daily, weekly, adaptive)
- Search depth (quick, standard, deep)
- Priority (critical, high, medium, low)

## Technical Stack

### Frontend
- **Framework**: React 19.2.0 + TypeScript 5.9.3
- **Build Tool**: Vite 7.2.4
- **Styling**: Tailwind CSS 3.4 + Radix UI components
- **State**: Zustand 5.0.9
- **Local Cache**: IndexedDB via idb 8.0.3
- **Routing**: React Router 7.12
- **Charts**: Recharts 3.7
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js 20 + Express 4.19
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL 15 with connection pooling (pg 8.17)
- **Authentication**: JWT (jsonwebtoken 9.0) + bcrypt 6.0
- **Validation**: Zod 4.3.5
- **AI Services**:
  - Anthropic Claude Sonnet 4.5 (reasoning, digests, chat) via SDK 0.71
  - OpenAI Whisper (voice transcription) via SDK 6.15
- **Search APIs**:
  - PubMed E-utilities
  - ClinicalTrials.gov API
  - FDA API
  - Brave Search API

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Web Server**: Nginx (production static serving)
- **Database**: PostgreSQL 15 Alpine in Docker
- **Deployment**: Docker Compose on Debian Linux

## Database

PostgreSQL 15 with 16 tables:

| Table | Purpose |
|-------|---------|
| `users` | Authentication and profiles |
| `user_devices` | Multi-device session tracking |
| `user_sessions` | JWT session management |
| `topics` | Medical conditions being monitored |
| `agents` | Research agent configurations |
| `agent_executions` | Agent run history and logs |
| `findings` | Research findings from all sources |
| `digests` | AI-generated smart digest content |
| `digest_queue` | Background digest generation queue |
| `chats` | Chat conversation metadata |
| `chat_messages` | Individual chat messages with citations |
| `audio_recordings` | Voice recording metadata and transcriptions |
| `notifications` | Agent and system notifications |
| `timeline_events` | Health timeline events |
| `user_preferences` | User settings and preferences |
| `api_usage` | API call analytics |

Flexible metadata stored as JSONB fields (source info, themes, breakthroughs, worth revisiting patterns, etc.).

## Architecture Principles

- **Facts, Not Scores**: Only factual, verifiable information — no arbitrary metrics or invented scores
- **Server-First**: PostgreSQL is the sole source of truth; IndexedDB is a performance cache only
- **No Offline Mode**: All core features (AI, agents, data) require network connectivity
- **Transparent Attribution**: Every finding clearly attributed to its source with direct links

## Development

### Logging

The application uses a centralized logging utility (`src/utils/logger.ts`) that automatically disables console output in production builds.

### Scripts

```bash
# Frontend
npm run dev              # Start Vite dev server (port 5176)
npm run build            # Build for production
npm run build:typecheck  # Type check then build
npm run lint             # Run ESLint
npm run preview          # Preview production build

# Backend
cd backend
npm run dev              # Start with tsx watch (hot reload)
npm run build            # Compile TypeScript
npm start                # Run compiled JavaScript
```

### Database Backup & Recovery

```bash
# Backup
docker exec medcompanion-postgres pg_dump -U meduser medcompanion > backup.sql

# Restore
docker exec -i medcompanion-postgres psql -U meduser medcompanion < backup.sql
```

## Implementation Plans

Feature development is tracked through detailed implementation plans in `/IMPLEMENTATION_PLANS/`. Each plan is a strict actionable blueprint with step-by-step instructions. See [IMPLEMENTATION_PLANS/README.md](IMPLEMENTATION_PLANS/README.md) for the full list and format details.

## License

This project is licensed under the MIT License — see the LICENSE file for details.

## Acknowledgments

Built with love for caregivers managing rare diseases, inspired by the need for better autonomous medical research tools.

---

**Medical Disclaimer**: This is a research information tool only. Always consult with qualified healthcare professionals for medical decisions. This tool provides information, not medical advice.
