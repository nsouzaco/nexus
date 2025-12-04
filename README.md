# Nexus

An AI-powered business intelligence assistant that connects to your data sources and answers questions with cited sources.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-green?logo=supabase)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai)

---

## Overview

Nexus unifies your scattered business data—across Notion, Google Drive, Airtable, and GitHub—into a single conversational interface. Ask questions in plain English, get answers grounded in your actual data, with links back to the source.

**Key capabilities:**
- 🔍 **Search** across all connected tools simultaneously
- 📊 **Visualize** data with auto-generated charts
- ✍️ **Create** records in Airtable, issues in GitHub, pages in Notion, docs in Google Drive
- 🎯 **Generate presentations** with multiple slides via Google Slides API
- 📁 **Upload** documents (PDF, Word, CSV) for semantic search
- 🌐 **Web search** for external context
- 📈 **Observability** via Langfuse for agent reasoning traces

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js 14 App                          │
├──────────────────────────┬──────────────────────────────────────┤
│       Pages/Routes       │            API Routes                │
│  • Landing (/)           │  • /api/chat (streaming)             │
│  • Auth (login/signup)   │  • /api/integrations/*/connect       │
│  • Dashboard             │  • /api/files (upload/process)       │
│  • Chat                  │                                      │
├──────────────────────────┴──────────────────────────────────────┤
│                        Agentic Layer                            │
│  Vercel AI SDK • GPT-4o • Tool Calling • Multi-step Execution   │
├─────────────────────────────────────────────────────────────────┤
│                        Services Layer                           │
│  RAG Service • Integration Services • Web Search • Embeddings   │
├──────────────────────────┬──────────────────────────────────────┤
│       Supabase           │           Pinecone                   │
│  Postgres + Auth + RLS   │      Vector Database (RAG)           │
└──────────────────────────┴──────────────────────────────────────┘
              │                          │
    ┌─────────┴─────────┐      ┌─────────┴─────────┐
    │   Integrations    │      │   External APIs   │
    │ Notion • Drive    │      │ OpenAI • Tavily   │
    │ Airtable • GitHub │      │                   │
    └───────────────────┘      └───────────────────┘
```

### Data Flow

1. **User asks a question** → Chat API receives message
2. **Agent decides** which tools to call (search integrations, files, web)
3. **Data retrieved** from relevant sources in parallel
4. **GPT-4o synthesizes** response with tool results
5. **Streamed to UI** with optional chart visualizations

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router, Server Components) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (Postgres with RLS) |
| Auth | Supabase Auth (email/password) |
| AI | Vercel AI SDK + OpenAI GPT-4o |
| Embeddings | OpenAI text-embedding-3-small (1024 dim) |
| Vector DB | Pinecone (serverless) |
| Deployment | Vercel |

### Key Libraries

- `ai` / `@ai-sdk/openai` — Streaming, tool calling, multi-step agents
- `@supabase/ssr` — Server-side Supabase client
- `@pinecone-database/pinecone` — Vector operations
- `@notionhq/client` — Notion API
- `pdf-parse` / `mammoth` / `papaparse` — Document parsing
- `recharts` — Chart rendering
- `zod` — Schema validation for agent tools

---

## Integrations

| Service | Auth Method | Capabilities |
|---------|-------------|--------------|
| **Notion** | OAuth 2.0 | Search pages/databases, create pages |
| **Google Drive** | OAuth 2.0 | Search files, create Docs/Sheets/Slides |
| **Airtable** | Personal Access Token | Search, create, update records |
| **GitHub** | OAuth 2.0 | Search repos/issues/code, create issues |
| **File Upload** | Direct upload | PDF, Word, CSV, JSON, TXT, Markdown |
| **Web Search** | Tavily API | Real-time web results |

---

## Agent Tools

The AI agent has access to 14 tools for autonomous task execution:

| Tool | Description |
|------|-------------|
| `searchAirtable` | Query records with base/table filtering |
| `searchGitHub` | Search repos, issues, code |
| `searchNotion` | Search pages and databases |
| `searchGoogleDrive` | Search files |
| `searchFiles` | Semantic search over uploaded documents |
| `webSearch` | Search the web via Tavily |
| `createAirtableRecord` | Create new records |
| `updateAirtableRecord` | Update existing records |
| `createGitHubIssue` | Create issues in repositories |
| `createNotionPage` | Create new pages |
| `createGoogleDriveFile` | Create Google Docs, Sheets, or Slides |
| `createSlidesPresentation` | Create presentations with slide content via Slides API |
| `generateChart` | Generate line/bar/area/pie charts |
| `executeCode` | Sandboxed JavaScript execution |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/             # Login, Signup pages
│   ├── (protected)/        # Dashboard, Chat (auth required)
│   └── api/
│       ├── chat/           # Streaming chat endpoint
│       ├── files/          # File upload & processing
│       └── integrations/   # OAuth flows
├── components/
│   ├── features/           # IntegrationCard, FileUpload, ChartRenderer
│   ├── layout/             # Navbar, Sidebar
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── ai/                 # Agent tools & system prompt
│   ├── pinecone/           # Vector DB client
│   └── supabase/           # Auth clients (server/browser)
├── services/
│   ├── integrations/       # Notion, Drive, Airtable, GitHub
│   ├── rag.service.ts      # RAG retrieval orchestration
│   ├── embedding.service.ts
│   ├── pinecone.service.ts
│   └── chunking.service.ts
└── types/                  # TypeScript definitions
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project
- Pinecone index (1024 dimensions, cosine metric)
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/nsouzaco/nexus.git
cd nexus

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### Environment Variables

Create `.env.local` with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Pinecone
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=nexus

# OAuth (configure in respective developer consoles)
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Airtable (uses Personal Access Token via UI modal)

# Optional: Web Search
TAVILY_API_KEY=your_tavily_key

# Optional: Langfuse (agent observability)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASEURL=https://us.cloud.langfuse.com
```

### Database Setup

Apply migrations to your Supabase project:

```bash
# Using Supabase CLI
supabase db push
```

Or run the SQL files in `supabase/migrations/` manually.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Database Schema

```
auth.users (Supabase managed)
    │
    ├── profiles (display_name, avatar)
    │
    ├── integrations (provider, tokens, status)
    │
    ├── files (filename, status, metadata)
    │   └── chunks (content, embeddings metadata)
    │
    └── conversations
        └── messages (role, content, sources)
```

All tables have Row Level Security (RLS) policies ensuring users can only access their own data.

---

## Security

- **Authentication**: Supabase Auth with secure session cookies
- **Authorization**: Row Level Security on all database tables
- **Token Storage**: OAuth tokens stored encrypted
- **API Protection**: All API routes validate user session
- **Sandboxed Execution**: Code execution tool has limited scope

---

## Observability

The app includes **Langfuse** integration for full observability into the AI agent's behavior.

**What's captured:**
- 🧠 **Agent reasoning** — See the agent's thinking process before each tool call
- 🔧 **Tool execution traces** — Input arguments and output results for every tool
- 📊 **Token usage** — Track costs per conversation
- ⏱️ **Latency breakdown** — Identify slow steps in multi-step flows
- 👤 **User/session context** — Filter traces by user or conversation

**Why it matters:**
When a user reports "the AI gave me a wrong answer," you can trace exactly what happened—which tools were called, what data was returned, and how the agent interpreted it. This data is essential for improving agent prompts and debugging edge cases.

**Setup:** Add your Langfuse keys to `.env.local`:
```env
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASEURL=https://us.cloud.langfuse.com
```

---

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nsouzaco/nexus)

Configure environment variables in Vercel dashboard.

---

## License

MIT

