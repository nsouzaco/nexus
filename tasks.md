# Adapt Clone - Development Tasks

## Phase 1: Project Setup
- [ ] Initialize Next.js 14 project with TypeScript and App Router
- [ ] Configure Tailwind CSS
- [ ] Install and set up shadcn/ui components
- [ ] Set up Prisma ORM
- [ ] Create database schema (Users, Integrations, Conversations, Messages)
- [ ] Configure NextAuth.js with credentials provider
- [ ] Create environment variables template (.env.example)
- [ ] Set up project folder structure

## Phase 2: Authentication
- [ ] Create signup page with form validation
- [ ] Create login page with form validation
- [ ] Implement NextAuth credentials provider
- [ ] Add password hashing with bcrypt
- [ ] Create auth API routes
- [ ] Add protected route middleware
- [ ] Create user session management
- [ ] Add logout functionality

## Phase 3: Landing Page & Layout
- [ ] Design and build landing page
- [ ] Create Navbar component (logo, user menu)
- [ ] Create responsive layout wrapper
- [ ] Add dark/light mode support (optional)
- [ ] Create loading states and skeletons

## Phase 4: Dashboard & Integrations
- [ ] Create dashboard page layout
- [ ] Build IntegrationCard component
- [ ] Create empty state for no integrations
- [ ] Implement Notion OAuth flow
  - [ ] Create connect endpoint
  - [ ] Handle callback and token exchange
  - [ ] Store encrypted tokens
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
- [ ] Create chat page layout with sidebar
- [ ] Build Sidebar component (conversation history)
- [ ] Create ChatMessage component (user/assistant styling)
- [ ] Build CitationChip component
- [ ] Create ChatInput component (textarea + send button)
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
- [ ] Store messages in database
- [ ] Add conversation context management

## Phase 8: Polish & Production
- [ ] Responsive design testing (desktop + mobile)
- [ ] Add comprehensive error handling
- [ ] Create error boundary components
- [ ] Add toast notifications
- [ ] Optimize loading states
- [ ] Add keyboard shortcuts
- [ ] Test all user flows end-to-end
- [ ] Set up Railway deployment
- [ ] Configure production environment variables
- [ ] Final testing and bug fixes

---

## Priority Order
1. **High**: Authentication, Dashboard, Integrations
2. **Medium**: Chat Interface, AI Query Engine
3. **Low**: Polish, optimizations

## Notes
- Start with one integration (Notion) and expand
- Use streaming for better AI response UX
- Prioritize mobile-friendly design from the start

