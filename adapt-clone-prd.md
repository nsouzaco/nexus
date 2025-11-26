# Adapt Clone — MVP PRD

## Overview

An AI-powered business intelligence tool that connects to your data sources (Notion, Google Drive, Airtable, GitHub) and lets you ask natural language questions to get instant answers with source citations.

**Core Value Prop:** Ask any question, get trusted answers from your connected tools.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL (Railway) |
| Auth | NextAuth.js |
| AI | OpenAI (GPT-4o) |
| Deployment | Railway |

---

## Integrations

| Integration | Auth Method | Primary Use Case |
|-------------|-------------|------------------|
| Notion | OAuth 2.0 | Query wikis, databases, documents |
| Google Drive | OAuth 2.0 | Search and analyze files (Docs, Sheets, PDFs) |
| Airtable | Personal Access Token | Query structured data tables |
| GitHub | OAuth 2.0 | Query repos, issues, pull requests, commits |

---

## Core Features

### 1. Authentication
- User signup/login via email + password
- Session management
- Protected routes

### 2. Integration Management
- Dashboard showing connected integrations
- Connect/disconnect each integration
- OAuth flow handling for Notion, Google Drive, GitHub
- API key input for Airtable
- Store tokens securely in database

### 3. Chat Interface
- Conversational UI similar to ChatGPT
- Message input with send button
- Message history (scrollable)
- Loading states during AI responses
- Source citations with links to original data

### 4. AI Query Engine
- Takes user question + context from connected integrations
- Retrieves relevant data from connected sources
- Sends to OpenAI with system prompt for business Q&A
- Returns answer with citations

### 5. Data Retrieval
- Notion: Search pages, read page content, query databases
- Google Drive: List files, search files, read file content
- Airtable: List bases, list tables, query records
- GitHub: List repos, search issues, read file contents, list commits

---

## User Flows

### First-Time User
1. Land on homepage
2. Sign up with email/password
3. Redirect to dashboard
4. See empty state prompting to connect integrations
5. Connect first integration (OAuth flow)
6. Return to dashboard, see connected status
7. Start asking questions

### Returning User
1. Log in
2. Go to chat
3. Ask question
4. System retrieves from connected sources
5. AI generates answer with citations
6. User can ask follow-ups

### Connecting an Integration
1. Click "Connect" on integration card
2. Redirect to provider's OAuth consent screen
3. User approves
4. Redirect back with auth code
5. Exchange code for access token
6. Store token in database
7. Show success state

---

## Data Model

### Users
- id
- email
- password (hashed)
- created_at

### Integrations
- id
- user_id
- provider (notion | google_drive | airtable | github)
- access_token (encrypted)
- refresh_token (encrypted, if applicable)
- connected_at
- status (active | expired | revoked)

### Conversations
- id
- user_id
- title
- created_at
- updated_at

### Messages
- id
- conversation_id
- role (user | assistant)
- content
- sources (JSON array of citations)
- created_at

---

## Pages / Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Login form |
| `/signup` | Signup form |
| `/dashboard` | Integration management |
| `/chat` | Main chat interface |
| `/chat/[id]` | Specific conversation |
| `/api/auth/*` | NextAuth routes |
| `/api/integrations/*` | OAuth callbacks + token management |
| `/api/chat` | Chat completion endpoint |

---

## MVP Scope

### In Scope
- Email/password auth
- 4 integrations (Notion, Google Drive, Airtable, GitHub)
- Single chat thread per session
- Basic source citations
- Responsive design (desktop + mobile)

### Out of Scope (v2+)
- Team workspaces
- Action execution (create tasks, send messages)
- Advanced RAG with vector embeddings
- File upload (without integration)
- Conversation sharing
- OAuth login (Google, GitHub as auth providers)
- Usage limits / billing

---

## UI Components Needed

### Layout
- Navbar (logo, user menu)
- Sidebar (conversation history)

### Dashboard
- Integration card (icon, name, status, connect/disconnect button)
- Empty state

### Chat
- Message bubble (user vs assistant styling)
- Citation chip (clickable, shows source)
- Input bar (textarea, send button)
- Loading indicator

### Auth
- Form card (inputs, submit button, link to alternate auth page)

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | Railway Postgres connection string |
| NEXTAUTH_SECRET | Random string for session encryption |
| NEXTAUTH_URL | App URL |
| OPENAI_API_KEY | OpenAI API key |
| NOTION_CLIENT_ID | Notion OAuth app ID |
| NOTION_CLIENT_SECRET | Notion OAuth secret |
| GOOGLE_CLIENT_ID | Google OAuth app ID |
| GOOGLE_CLIENT_SECRET | Google OAuth secret |
| GITHUB_CLIENT_ID | GitHub OAuth app ID |
| GITHUB_CLIENT_SECRET | GitHub OAuth secret |
| AIRTABLE_CLIENT_ID | Airtable OAuth app ID (optional, can use PAT) |
| AIRTABLE_CLIENT_SECRET | Airtable OAuth secret |

---

## Success Criteria

MVP is complete when a user can:
1. Sign up and log in
2. Connect at least one integration
3. Ask a question about their connected data
4. Receive an accurate answer with source citations
