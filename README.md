# Medical Research Companion PWA

An autonomous medical research companion Progressive Web App designed to help caregivers of rare disease patients stay up-to-date with the latest medical research, clinical trials, and treatment breakthroughs.

## 🎯 Version 2.0 - Major Update

### What's New
- **PostgreSQL Persistent Storage**: All data now persists in PostgreSQL database
- **Multi-Device Sync**: Access your research from any device
- **User Authentication**: Secure login with JWT tokens
- **Automatic Backups**: Data is automatically backed up to PostgreSQL
- **Improved Performance**: Connection pooling and optimized queries

## 🌟 Current Features

### Autonomous Research Agents (2 Active, 2 Planned)

**Currently Active:**
- **Treatment Breakthrough Monitor**: Continuously scans FDA approvals, new therapies, and treatment guidelines
- **Clinical Trial Scanner**: Tracks new trials, enrollment changes, and trial results

**Planned for Phase 3:**
- **Medical Literature Researcher**: Will monitor medical journals and research publications
- **Pattern Recognition Agent**: Will identify patterns and connections across research findings

### Smart Digest System
- AI-powered analysis of research findings
- Executive summaries with key themes and contradictions
- Breakthrough detection and knowledge gap identification
- Daily, weekly, and monthly digest generation
- Automatic prioritization of critical findings

### Conversational Interface (85% Complete)
- Real-time chat with AI about research findings
- Streaming responses for immediate feedback
- Citation linking to specific findings
- Suggested follow-up questions
- Message persistence and search
- Export conversations to TXT/JSON

**Still in development:**
- Citation click navigation (currently logs only)
- Chat history sidebar UI
- Message feedback buttons
- Context accumulation from finding clicks

### Research Insights Dashboard
- Research progress tracking and metrics
- Source diversity analysis
- Finding patterns over time
- Knowledge gap visualization
- Research velocity metrics
- Replaced the deprecated Knowledge Graph feature

### Patient Care Management
- Timeline-based event tracking
- Voice recording and transcription for doctor visits
- Event categorization (appointments, symptoms, treatments)
- Chronological health journey visualization

### User Authentication
- Secure login and registration system
- JWT-based authentication
- Password reset functionality
- Session management

### Data Export
- Professional PDF reports with research summaries
- Formatted for medical professionals
- Includes findings, timeline events, and insights

### Privacy-First Design
- **Hybrid Storage**: PostgreSQL for persistence, IndexedDB for offline cache
- **Data Encryption**: Passwords hashed with bcrypt, JWT for sessions
- **User-Controlled**: You own your data, can export or delete anytime
- **HIPAA-Ready Architecture**: Designed for healthcare compliance
- **Offline Support**: Full functionality without network via local cache

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Docker and Docker Compose (for PostgreSQL)
- Modern web browser with IndexedDB support

### Quick Start with Docker (Recommended)

1. Clone the repository:
```bash
git clone [repository-url]
cd medical-companion-pwa
```

2. Copy environment template:
```bash
cp .env.example .env
# Edit .env and add your API keys
```

3. Start with Docker Compose:
```bash
docker-compose up -d
```

4. Initialize the database and start the application:
```bash
npm run start:postgres
```

5. Open your browser and navigate to `http://localhost:5173`

### Manual Installation (Alternative)

1. Clone the repository:
```bash
git clone [repository-url]
cd medical-companion-pwa
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
npm install
cd ..
```

4. Set up PostgreSQL:
```bash
# Start PostgreSQL with Docker
docker run -d \
  --name medcompanion-postgres \
  -e POSTGRES_DB=medcompanion \
  -e POSTGRES_USER=meduser \
  -e POSTGRES_PASSWORD=medpass123 \
  -p 5432:5432 \
  postgres:15-alpine

# Initialize database schema
psql -h localhost -U meduser -d medcompanion -f backend/src/db/init.sql
```

5. Configure environment variables:
```bash
# Copy the example files
cp .env.example .env
cp backend/.env.example backend/.env

# Edit both .env files and add:
# - API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, BRAVE_API_KEY)
# - Database URL: postgresql://meduser:medpass123@localhost:5432/medcompanion
# - JWT_SECRET: generate a secure random string
# - Set USE_POSTGRESQL=true
```

**Important:** Never commit API keys or passwords to version control. All `.env` files are gitignored by default.

6. Start both servers:

**Terminal 1 - Backend:**
```bash
cd backend
npm run build
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
# Build frontend
npm run build

# Build backend
cd backend
npm run build
```

The built files will be in the `dist` directory (frontend) and `backend/dist` (backend).

## 📱 PWA Installation

This app can be installed as a Progressive Web App on your device:

1. Open the app in Chrome or Edge
2. Click the install icon in the address bar
3. Follow the prompts to add to your home screen

## 🏗️ Project Structure

```
medical-companion-pwa/
├── src/
│   ├── types/              # TypeScript type definitions
│   ├── utils/
│   │   ├── db/             # IndexedDB operations
│   │   └── logger.ts       # Centralized logging
│   ├── services/           # Business logic (13+ files)
│   ├── stores/             # Zustand state management
│   ├── components/         # React components
│   │   ├── agents/         # Agent-specific components
│   │   ├── auth/           # Authentication components
│   │   └── ui/             # Radix UI components
│   └── App.tsx            # Main application component
├── backend/
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Backend services
│   │   └── middleware/     # Auth middleware
│   └── dist/              # Compiled JavaScript
├── public/                 # Static assets
└── vite.config.ts         # Vite configuration
```

## 💡 Usage Guide

### Adding a Disease Topic

1. Navigate to the "Topics" tab
2. Click "Add Topic"
3. Enter:
   - Topic name (e.g., "My Child's Condition")
   - Disease name (e.g., "Mitochondrial Disease")
   - Update frequency preference (hourly, daily, weekly, or adaptive)
   - Patient age group

The app will automatically create 2 monitoring agents for your topic.

### Running Agents

Agents can run in two modes:

1. **Automatic**: Agents run on schedule based on update frequency
   - Hourly: Fast-changing conditions
   - Daily: Most conditions
   - Weekly: Stable conditions
   - Adaptive: AI determines frequency

2. **Manual**: Click "Run Now" on any agent in the Agents tab

### Using the Chat Interface

1. Select a topic with findings
2. Click the chat icon in the top toolbar
3. Ask questions about your research findings
4. Citations link to specific findings (navigation coming soon)
5. Export conversations for medical appointments

### Viewing Research Findings

- **Dashboard**: See recent findings and agent updates
- **Research Insights**: Analyze patterns and metrics
- **Smart Digests**: Review AI-generated summaries
- **Timeline**: Track your health journey chronologically

### Cost Management

- Monthly budget: $20 (configurable)
- Real-time cost tracking on dashboard
- Automatic throttling when approaching budget limit

## 🔧 Configuration

### Agent Configuration

Agents can be customized per topic:
- Update frequency (hourly, daily, weekly, adaptive)
- Search depth (quick, standard, deep)
- Priority (critical, high, medium, low)

Location filters for clinical trials are defined in types but not yet exposed in UI.

## 🛡️ Privacy & Security

### Data Storage
- **PostgreSQL Database**: Primary persistent storage for all data
- **IndexedDB Cache**: Local cache for offline access and performance
- **Automatic Sync**: Changes sync between local and server storage
- **Multi-Device**: Access your data from any device with login
- **Backup & Recovery**: Automatic PostgreSQL backups
- **Encryption**: Passwords hashed with bcrypt, JWT for sessions

### API Usage
- Secure API endpoints with JWT authentication
- All health data stored in PostgreSQL with user isolation
- Row-level security for multi-tenant data
- SSL/TLS encryption for production deployments

## 📊 Technical Stack

### Frontend
- **Framework**: React 19.2.0 + TypeScript 5.9.3
- **Build Tool**: Vite 7.2.4
- **Styling**: Tailwind CSS + Radix UI
- **Local Cache**: IndexedDB via idb
- **State**: Zustand (installed, minimally used)
- **PWA**: Vite PWA Plugin + Workbox

### Backend
- **Runtime**: Node.js + Express
- **Language**: TypeScript
- **Database**:
  - PostgreSQL 15 (primary storage)
  - SQLite 3 (legacy fallback)
  - Connection pooling with pg library
- **Authentication**:
  - JWT tokens (30-day expiry)
  - bcrypt password hashing
  - Multi-device sessions
- **AI Services**:
  - Anthropic Claude Sonnet 4.5 (reasoning)
  - OpenAI Whisper (transcription)
- **Search APIs**:
  - PubMed E-utilities
  - ClinicalTrials.gov API
  - FDA API
  - Brave Search API (requires key)

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx (production)
- **Process Manager**: PM2 (production)

## 🔄 Database Migration

### Migrating from IndexedDB to PostgreSQL

If you have existing data in IndexedDB:

1. Export your data before migration:
```bash
# In the browser console:
await exportAllData(); // Exports to JSON file
```

2. Start PostgreSQL and initialize:
```bash
docker-compose up -d
npm run migrate:db
```

3. Import your exported data:
```bash
npm run import:data path/to/exported-data.json
```

### Database Backup & Recovery

```bash
# Backup PostgreSQL database
docker exec medcompanion-postgres pg_dump -U meduser medcompanion > backup.sql

# Restore from backup
docker exec -i medcompanion-postgres psql -U meduser medcompanion < backup.sql
```

## 🔮 Development Roadmap

### ✅ Phase 1 - Core Platform (COMPLETED)
- ✅ 2 Autonomous research agents
- ✅ Smart digest generation
- ✅ Voice recording & transcription
- ✅ Timeline event management
- ✅ Research Insights Dashboard
- ✅ User authentication system
- ✅ PDF export functionality
- ✅ Backend API server
- ✅ Real API integrations

### 🔄 Phase 2 - Conversational Interface (85% COMPLETE)
- ✅ Chat UI with streaming responses
- ✅ Citation linking system
- ✅ Message persistence
- ✅ Suggested questions
- ✅ Search through messages
- ✅ Export to TXT/JSON
- ⏳ Citation click navigation
- ⏳ Chat history management UI
- ⏳ Context accumulation from clicks
- ⏳ Message feedback UI

### 📋 Phase 3 - Enhanced Research (PLANNED)
- [ ] Medical Literature Agent implementation
- [ ] Pattern Recognition Agent implementation
- [ ] Advanced chat features (threading, branching)
- [ ] Message regeneration and editing
- [ ] Chat settings panel (model, temperature)
- [ ] PDF export for chat conversations

### 🚀 Future Enhancements
- [ ] Data encryption (AES-GCM)
- [ ] Family collaboration features
- [ ] Smart learning & adaptation from user patterns
- [ ] OCR for lab results
- [ ] Additional export formats (Excel, FHIR)
- [ ] Multi-language support
- [ ] Advanced symptom tracking

## 🐛 Known Limitations

### Current Limitations
1. Only 2 of 4 planned agents are available
2. No UI to manually add additional agents
3. Chat citation clicks don't navigate to findings yet
4. Excel/FHIR exports implemented but disabled in UI
5. Voice recording and attachments in chat disabled by default
6. Brave Search returns empty results without API key

### Deprecated Features
- **Knowledge Graph**: Removed as it violated "Facts, Not Scores™" principle
- **Insurance Access Agent**: Dropped due to complexity and regional variations

## 🔧 Development

### Logging

The application uses a centralized logging utility (`src/utils/logger.ts`) that automatically disables console output in production builds. All debug statements are wrapped to only appear in development mode.

### Running Tests

```bash
npm run test        # Run tests (when implemented)
npm run type-check  # Check TypeScript types
```

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

Built with love for caregivers managing rare diseases, inspired by the need for better autonomous medical research tools.

---

**Medical Disclaimer**: This is a research information tool only. Always consult with qualified healthcare professionals for medical decisions. This tool provides information, not medical advice.