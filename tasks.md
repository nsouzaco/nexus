# Adapt Clone - Development Tasks

## Phase 1: Project Setup (Supabase)
- [x] Initialize Next.js 14 project with TypeScript and App Router
- [x] Configure Tailwind CSS
- [x] Install and set up shadcn/ui components
- [x] Update package.json with Supabase dependencies
- [x] Create Supabase client utilities (browser + server)
- [x] Set up Supabase database schema
- [x] Configure Row Level Security (RLS) policies
- [x] Create environment variables template

## Phase 2: Authentication (Supabase Auth)
- [x] Create signup page with Supabase Auth
- [x] Create login page with Supabase Auth
- [x] Add auth callback route (/auth/callback)
- [x] Update middleware for Supabase session handling
- [x] Create auth helpers (getUser, signOut)
- [x] Add logout functionality
- [ ] Test auth flow end-to-end (needs Supabase anon key)

## Phase 3: Landing Page & Layout
- [x] Design and build landing page
- [x] Create Navbar component (logo, user menu)
- [x] Create responsive layout wrapper
- [ ] Add loading states and skeletons

## Phase 4: Dashboard & Integrations
- [x] Create dashboard page layout
- [x] Build IntegrationCard component
- [x] Create empty state for no integrations
- [ ] Implement Notion OAuth flow
  - [ ] Create connect endpoint
  - [ ] Handle callback and token exchange
  - [ ] Store encrypted tokens in Supabase
- [ ] Implement Google Drive OAuth flow
  - [ ] Create connect endpoint
  - [ ] Handle callback and token exchange
  - [ ] Store encrypted tokens
- [ ] Implement GitHub OAuth flow
  - [ ] Create connect endpoint
  - [ ] Handle callback and token exchange
  - [ ] Store encrypted tokens
- [ ] Implement Airtable integration
  - [ ] Create API key input modal
  - [ ] Validate and store API key
- [ ] Add disconnect functionality for each integration
- [ ] Show connection status and last sync time

## Phase 5: Data Retrieval Services
- [ ] Create base data retrieval interface
- [ ] Implement Notion service
  - [ ] Search pages
  - [ ] Read page content
  - [ ] Query databases
- [ ] Implement Google Drive service
  - [ ] List files
  - [ ] Search files
  - [ ] Read file content (Docs, Sheets, PDFs)
- [ ] Implement Airtable service
  - [ ] List bases
  - [ ] List tables
  - [ ] Query records
- [ ] Implement GitHub service
  - [ ] List repos
  - [ ] Search issues
  - [ ] Read file contents
  - [ ] List commits
- [ ] Add error handling and rate limiting

## Phase 6: Chat Interface
- [x] Create chat page layout with sidebar
- [ ] Build Sidebar component (conversation history)
- [ ] Create ChatMessage component (user/assistant styling)
- [ ] Build CitationChip component
- [x] Create ChatInput component (textarea + send button)
- [ ] Add loading indicator for AI responses
- [ ] Implement message scrolling and auto-scroll
- [ ] Create new conversation flow
- [ ] Add conversation title generation

## Phase 7: AI Query Engine
- [ ] Set up OpenAI SDK
- [ ] Create system prompt for business Q&A
- [ ] Implement chat API endpoint
- [ ] Add context retrieval from connected sources
- [ ] Parse and format source citations
- [ ] Implement streaming responses
- [ ] Store messages in Supabase
- [ ] Add conversation context management

## Phase 8: Polish & Production
- [ ] Responsive design testing (desktop + mobile)
- [ ] Add comprehensive error handling
- [ ] Create error boundary components
- [x] Add toast notifications
- [ ] Optimize loading states
- [ ] Add keyboard shortcuts
- [ ] Test all user flows end-to-end
- [ ] Set up Vercel deployment
- [ ] Configure production environment variables
- [ ] Final testing and bug fixes

---

## Supabase Database Schema

```sql
-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations
CREATE TABLE integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('notion', 'google_drive', 'airtable', 'github')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  UNIQUE(user_id, provider)
);

-- Conversations
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only access their own profile
CREATE POLICY "Users can access own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Integrations: Users can only access their own integrations
CREATE POLICY "Users can access own integrations" ON integrations
  FOR ALL USING (auth.uid() = user_id);

-- Conversations: Users can only access their own conversations
CREATE POLICY "Users can access own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

-- Messages: Users can access messages from their conversations
CREATE POLICY "Users can access messages from own conversations" ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );
```

---

## Phase 2 (v2): Pinecone RAG for File Upload ✅ COMPLETE

### Infrastructure
- [x] Install dependencies (pinecone, pdf-parse, mammoth, papaparse, uuid)
- [x] Create Pinecone client utility (`src/lib/pinecone/client.ts`)
- [x] Create database migration for files and chunks tables
- [ ] Create Pinecone index (requires account)
- [ ] Create Supabase storage bucket

### Services
- [x] Create TypeScript types (`src/types/files.ts`, `src/types/pinecone.ts`)
- [x] Create EmbeddingService for OpenAI embeddings
- [x] Create ChunkingService for document splitting
- [x] Create PineconeService for vector operations
- [x] Create FileService for file management
- [x] Create RAGService for retrieval orchestration
- [x] Create DocumentParserService (PDF, Word, CSV, JSON, TXT, MD)

### API Routes
- [x] POST `/api/files/upload` - Upload file
- [x] GET `/api/files` - List user files
- [x] GET `/api/files/[id]` - Get file details
- [x] DELETE `/api/files/[id]` - Delete file
- [x] POST `/api/files/[id]` - Retry processing

### UI Components
- [x] FileUpload component with drag-and-drop
- [x] FileList component with status and actions
- [x] AlertDialog component
- [x] Tabs component
- [x] Add Files tab to dashboard

### Remaining
- [ ] Integrate RAG into chat API endpoint
- [ ] Update chat UI to show file citations

---

## Priority Order
1. **High**: Supabase setup, Authentication, Dashboard
2. **Medium**: Integrations, Chat Interface, AI Query Engine
3. **Low**: Polish, optimizations

## Notes
- Supabase project needs to be created first
- RLS policies are critical for security
- Start with one integration (Notion) and expand
- Use streaming for better AI response UX
- RAG system requires PINECONE_API_KEY and PINECONE_INDEX_NAME env vars
