# Medical Research Companion PWA

An autonomous medical research companion Progressive Web App designed to help caregivers of rare disease patients stay up-to-date with the latest medical research, clinical trials, and treatment breakthroughs.

## 🌟 Key Features

### Autonomous Research Agents
- **Treatment Breakthrough Monitor**: Continuously scans FDA approvals, new therapies, and treatment guidelines
- **Clinical Trial Scanner**: Tracks new trials, enrollment changes, and trial results
- **Medical Literature Researcher**: Monitors medical journals and research publications
- **Pattern Recognition Agent**: Identifies patterns and connections across research findings

### Smart Learning & Adaptation
- Agents learn from user engagement patterns
- Adaptive scheduling based on disease progression rates
- Personalized source preferences
- Intelligent relevance scoring

### Patient Care Management
- Timeline-based event tracking
- Voice recording and transcription for doctor visits
- Photo capture with OCR for lab results
- Family collaboration support (up to 5 members)

### Privacy-First Design
- All sensitive data stored locally using IndexedDB
- End-to-end encryption capability (Web Crypto API)
- Zero-knowledge server architecture
- No cloud storage of personal health information

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Modern web browser with IndexedDB support

### Installation

1. Clone or download the project:
```bash
cd Desktop/medical-companion-pwa
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

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
│   │   └── agents/         # Agent utilities
│   ├── services/           # API and agent services
│   ├── components/         # React components
│   │   ├── agents/         # Agent-specific components
│   │   └── patient/        # Patient care components
│   └── App.tsx            # Main application component
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
   - Disease characteristics (rare, progression rate)
   - Patient age group

The app will automatically create monitoring agents for your topic.

### Running Agents

Agents can run in two modes:

1. **Automatic**: Agents run on schedule based on disease progression rate
   - Rapid progression: Every 12 hours
   - Moderate: Daily
   - Slow: Weekly

2. **Manual**: Click "Run Now" on any agent in the Agents tab

### Viewing Research Findings

- **Dashboard**: See recent findings and agent updates
- **Notifications**: Get alerted for breakthrough treatments and important updates
- **Topics**: Deep dive into research for specific conditions

### Cost Management

- Monthly budget: $20 (configurable)
- Real-time cost tracking on dashboard
- Automatic throttling when approaching budget limit

## 🔧 Configuration

### API Keys (Required for Full Functionality)

Create a `.env` file in the project root:

```env
VITE_API_URL=http://localhost:3001/api
VITE_ANTHROPIC_API_KEY=your_key_here
VITE_OPENAI_API_KEY=your_key_here
```

### Agent Configuration

Agents can be customized per topic:
- Update frequency (hourly, daily, weekly, adaptive)
- Search depth (quick, standard, deep)
- Priority (critical, high, medium, low)
- Location filters for clinical trials

## 🛡️ Privacy & Security

### Data Storage
- **Local Storage**: All personal data stored in browser IndexedDB
- **Capacity**: Gigabytes of storage for research data
- **Persistence**: Request persistent storage to prevent eviction

### Encryption
- AES-GCM 256-bit encryption available
- Password-derived keys (PBKDF2)
- User controls all encryption keys

### API Usage
- Stateless API calls only
- No server-side storage of queries
- Encrypted search parameters

## 🤝 Family Collaboration

### Roles
- **Owner**: Full control, can add/remove members
- **Caregiver**: Can edit and run agents
- **Viewer**: Read-only access

### Sharing
- Generate secure invite links
- Control permissions per family member
- Synchronized across devices

## 📊 Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Storage**: IndexedDB + OPFS
- **PWA**: Vite PWA Plugin + Workbox
- **State**: Zustand
- **AI Services**: Anthropic Claude, OpenAI Whisper
- **Search**: Brave Search API, PubMed E-utilities

## 🔮 Roadmap

### Phase 1 (Complete)
- ✅ Core PWA structure
- ✅ Autonomous agent framework
- ✅ Basic UI components
- ✅ IndexedDB integration
- ✅ Cost tracking
- ✅ Backend API server
- ✅ Real API integrations (PubMed, ClinicalTrials.gov)
- ✅ Service Worker scheduling
- ✅ Audio recording interface
- ✅ Smart digest generation with AI analysis

### Phase 2: Conversational Interface (4-6 weeks)
- [ ] Chat interface for research findings
- [ ] Context-aware Q&A about medical research
- [ ] Citation linking to specific findings
- [ ] Suggested follow-up questions
- [ ] Conversation history management
- [ ] Streaming AI responses for real-time interaction

### Phase 3A: Data Export & Analytics (3-4 weeks)
- [ ] PDF report generation with research summaries
- [ ] CSV/Excel export for timeline and tracking data
- [ ] FHIR-compatible medical record export
- [ ] Symptom correlation charts
- [ ] Treatment effectiveness visualization
- [ ] Pattern analysis across timeline events

### Phase 3B: Knowledge Graph Visualization (4-5 weeks)
- [ ] Interactive knowledge graph of research findings
- [ ] Relationship detection between medical concepts
- [ ] Pattern highlighting and contradiction detection
- [ ] 2D/3D graph visualization modes
- [ ] Filter by theme, category, or time period
- [ ] AI-powered relationship discovery

### Future Enhancements
- [ ] Multi-language support (starting with Spanish/Mandarin)
- [ ] Enhanced symptom tracking with severity scales
- [ ] Predictive insights based on timeline patterns
- [ ] Advanced analytics dashboard

## 🐛 Known Issues

1. Web search using mock data (real API integration pending)
2. Audio recording requires HTTPS in production
3. Some agent features require API keys
4. Conversational interface not yet implemented (Phase 2)

## 📝 License

This project is for personal, non-commercial use only.

## 🙏 Acknowledgments

Built with love for caregivers managing rare diseases, inspired by the need for better autonomous medical research tools.

---

**Note**: This is a prototype/MVP. Always consult with medical professionals for health decisions. This tool provides information only, not medical advice.