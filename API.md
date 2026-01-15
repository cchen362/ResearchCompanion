# Medical Companion PWA - API Documentation

## Base URL
- Development: `http://localhost:3001/api`
- Production: `https://yourdomain.com/api`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "token": "jwt_token",
  "expiresIn": 2592000
}
```

### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "token": "jwt_token",
  "expiresIn": 2592000
}
```

### POST /api/auth/logout
Logout and invalidate session.

**Headers:** Requires authentication

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /api/auth/verify
Verify current authentication token.

**Headers:** Requires authentication

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

## Topics Management

### GET /api/topics
Get all topics for the authenticated user.

**Headers:** Requires authentication

**Query Parameters:**
- `includeAgents` (boolean): Include associated agents

**Response:**
```json
{
  "success": true,
  "topics": [
    {
      "id": "uuid",
      "name": "My Child's Condition",
      "diseaseName": "Mitochondrial Disease",
      "updateFrequency": "daily",
      "patientAge": "pediatric",
      "createdAt": "2024-01-01T00:00:00Z",
      "agents": []
    }
  ]
}
```

### POST /api/topics
Create a new medical topic.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "name": "Topic Name",
  "diseaseName": "Disease Name",
  "updateFrequency": "daily",
  "patientAge": "adult",
  "symptoms": ["symptom1", "symptom2"],
  "medications": ["medication1"]
}
```

### PUT /api/topics/:id
Update an existing topic.

**Headers:** Requires authentication

### DELETE /api/topics/:id
Delete a topic and all associated data.

**Headers:** Requires authentication

## Findings

### GET /api/findings
Get findings for the authenticated user.

**Headers:** Requires authentication

**Query Parameters:**
- `topicId` (string): Filter by topic
- `source` (string): Filter by source type (pubmed, clinical, web)
- `limit` (number): Limit results (default: 50)
- `offset` (number): Pagination offset
- `search` (string): Search in content

**Response:**
```json
{
  "success": true,
  "findings": [
    {
      "id": "uuid",
      "topicId": "uuid",
      "content": "Research finding content...",
      "source": {
        "name": "PubMed",
        "type": "pubmed",
        "url": "https://...",
        "publishDate": "2024-01-01"
      },
      "relevanceScore": 0.95,
      "tags": ["treatment", "clinical trial"],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100
}
```

### POST /api/findings
Create a new finding.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "topicId": "uuid",
  "content": "Finding content",
  "source": {
    "name": "Source Name",
    "type": "pubmed",
    "url": "https://..."
  },
  "tags": ["tag1", "tag2"]
}
```

### GET /api/findings/:id
Get a specific finding by ID.

### PUT /api/findings/:id
Update a finding.

### DELETE /api/findings/:id
Delete a finding.

## Agents

### GET /api/agents
Get all agents for the user.

**Headers:** Requires authentication

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "id": "uuid",
      "topicId": "uuid",
      "name": "Treatment Breakthrough Monitor",
      "type": "treatment_monitor",
      "status": "idle",
      "lastRun": "2024-01-01T00:00:00Z",
      "nextRun": "2024-01-02T00:00:00Z",
      "config": {
        "searchDepth": "standard",
        "updateFrequency": "daily"
      }
    }
  ]
}
```

### POST /api/agents/:id/run
Manually trigger an agent run.

**Headers:** Requires authentication

**Response:**
```json
{
  "success": true,
  "executionId": "uuid",
  "status": "running",
  "message": "Agent execution started"
}
```

### GET /api/agents/:id/status
Get current agent execution status.

## AI Services

### POST /api/ai/research
Execute AI-powered research.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "topicId": "uuid",
  "query": "Latest treatments for condition",
  "agentType": "treatment_monitor",
  "sources": ["pubmed", "clinical"],
  "maxResults": 10
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "content": "Research finding...",
      "source": {},
      "relevance": 0.95
    }
  ],
  "totalFound": 10,
  "searchQuery": "transformed query",
  "cost": 0.05
}
```

### POST /api/ai/digest
Generate a smart digest from findings.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "findingIds": ["uuid1", "uuid2"],
  "topicId": "uuid",
  "type": "weekly"
}
```

**Response:**
```json
{
  "success": true,
  "digest": {
    "id": "uuid",
    "executiveSummary": "Summary text...",
    "themes": [],
    "contradictions": [],
    "breakthroughs": [],
    "knowledgeGaps": [],
    "nextSteps": [],
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### POST /api/ai/chat
Chat with AI about research findings.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "message": "User question",
  "topicId": "uuid",
  "conversationId": "uuid",
  "context": {
    "findingIds": ["uuid1", "uuid2"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "AI response...",
  "citations": [
    {
      "findingId": "uuid",
      "excerpt": "Relevant excerpt..."
    }
  ],
  "suggestedQuestions": [
    "Follow-up question 1",
    "Follow-up question 2"
  ]
}
```

### POST /api/ai/transcribe
Transcribe audio to text.

**Headers:** Requires authentication

**Request Body:** multipart/form-data
- `audio`: Audio file (wav, mp3, m4a)
- `language`: Language code (optional, default: "en")

**Response:**
```json
{
  "success": true,
  "transcription": "Transcribed text...",
  "duration": 120,
  "language": "en"
}
```

## Timeline Events

### GET /api/timeline
Get timeline events for the user.

**Headers:** Requires authentication

**Query Parameters:**
- `topicId` (string): Filter by topic
- `type` (string): Filter by event type
- `startDate` (string): Start date (ISO 8601)
- `endDate` (string): End date (ISO 8601)

### POST /api/timeline
Create a timeline event.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "topicId": "uuid",
  "type": "appointment",
  "title": "Doctor Visit",
  "description": "Regular checkup",
  "date": "2024-01-01T10:00:00Z",
  "metadata": {
    "doctor": "Dr. Smith",
    "location": "Medical Center"
  }
}
```

## User Preferences

### GET /api/user/preferences
Get user preferences.

**Headers:** Requires authentication

**Response:**
```json
{
  "success": true,
  "preferences": {
    "emailNotifications": true,
    "digestFrequency": "weekly",
    "theme": "light",
    "language": "en",
    "timezone": "America/New_York"
  }
}
```

### PUT /api/user/preferences
Update user preferences.

**Headers:** Requires authentication

**Request Body:**
```json
{
  "emailNotifications": false,
  "digestFrequency": "daily"
}
```

## Health & Status

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "database": "connected",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### GET /api/stats
Get usage statistics.

**Headers:** Requires authentication

**Response:**
```json
{
  "totalFindings": 500,
  "totalTopics": 3,
  "totalAgents": 6,
  "apiUsage": {
    "month": "2024-01",
    "cost": 15.32,
    "requests": 1234
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional details
  }
}
```

Common error codes:
- `UNAUTHORIZED` - Authentication required or invalid token
- `FORBIDDEN` - Access denied
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMITED` - Too many requests
- `SERVER_ERROR` - Internal server error

## Rate Limiting

Default rate limits:
- 100 requests per 15 minutes per IP
- 1000 requests per hour per authenticated user
- AI endpoints: 50 requests per hour

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704103200
```

## Pagination

Endpoints that return lists support pagination:
- `limit`: Number of items to return (max: 100)
- `offset`: Number of items to skip
- `cursor`: Cursor-based pagination (where supported)

## Webhooks (Future)

Webhook support is planned for:
- Agent completion notifications
- New breakthrough findings
- Digest generation complete

---

*Last Updated: January 16, 2026*
*API Version: 2.0.0*