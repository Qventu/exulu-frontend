# Prompt Library Feature Specification

## Overview
A centralized repository for users to create, organize, share, and reuse AI prompts with variable support across the platform.

---

## Data Model

### Prompt Entity
```typescript
{
  id: string
  name: string                    // Display name (required)
  description?: string            // Optional description
  content: string                 // Prompt text with {{variable}} support
  tags: string[]                  // Max 5 tags for filtering/categorization

  // RBAC (consistent with projects/chats)
  rights_mode: 'private' | 'users' | 'roles' | 'public' | 'projects'
  RBAC?: {
    users?: Array<{ id: number; rights: 'read' | 'write' }>
    roles?: Array<{ id: string; rights: 'read' | 'write' }>
    projects?: Array<{ id: string; rights: 'read' | 'write' }>
  }

  // Metadata
  created_by: number              // User ID
  created_at: DateTime
  updated_at: DateTime

  // Features
  is_favorited: boolean           // Per-user favorite flag
  favorite_count: number          // Global favorites
  usage_count: number             // How many times used

  // Relationships
  assigned_agents?: number[]      // Agent IDs this prompt works well with
}
```

### Business Rules
- **Name**: Required, unique per user (users can have same names across different users)
- **Tags**: Maximum 5 tags per prompt
- **Content**: No length limit
- **Variables**: Only `{{variable_name}}` syntax supported
- **Variable Names**: Alphanumeric + underscores only (e.g., `{{customer_name}}`, `{{issue_123}}`)
- **RBAC**: Follow existing patterns (creator + admins always have access)

---

## Core Features

### 1. Prompt Creation & Management

**Create Prompt:**
- Name (required)
- Description (optional)
- Content textarea with variable syntax help
- Tag input (max 5 tags)
- Agent assignment selector (multi-select)
- RBAC control (reuse existing `RBACControl` component)

**Edit Prompt:**
- Same fields as create
- Show "Last updated: X time ago"
- Preserve favorites/usage stats

**Delete Prompt:**
- Soft confirmation modal
- Only creator or users with write access can delete
- Check if prompt is currently in use (warning if yes)

**Variable Detection:**
- Auto-detect all `{{variable}}` patterns in content
- Display list of detected variables below content
- Show helpful examples: "Use {{variable_name}} format for dynamic content"
- Validate variable names (alphanumeric + underscores)

### 2. RBAC & Sharing

Reuse existing RBAC implementation pattern:
- **Component**: `<RBACControl>` from `/components/rbac.tsx`
- **Utility**: Create `checkPromptLibraryAccess()` similar to chat sessions
- **Modes**:
  - `private`: Creator + admins only
  - `public`: Everyone can read/use, write access controlled
  - `users`: Specific users with read/write permissions
  - `roles`: Specific job roles with read/write permissions
  - `projects`: Accessible within project context

**Permission Levels:**
- **Read**: Can view, use (copy/insert), and favorite the prompt
- **Write**: Can edit and delete the prompt

### 3. Discovery & Search

**Main Library View** (`/prompts`):
- Search bar (searches name, description, content)
- Filter panel:
  - Tags (multi-select)
  - Creator (dropdown)
  - Assigned Agent (dropdown)
  - Show only favorites (toggle)
- Sort dropdown:
  - Most favorited (default)
  - Most used
  - Recently created
  - Recently updated
  - Alphabetical (A-Z)
- Grid/List view toggle

**Results Display:**
- Prompt card showing:
  - Name + favorite star
  - Description (truncated)
  - Tags as badges
  - Variable count badge (e.g., "2 variables")
  - "Works with: Agent A, Agent B" if assigned
  - Usage count + favorite count
  - Action buttons: View, Use, Edit (if has write access)

### 4. Usage Integration

#### A) Agent Assignment (Recommendation System)
- In prompt editor, multi-select dropdown to assign to agents
- Many-to-many relationship (prompt ↔ agents)
- Shows on prompt card: "Works well with: [Agent badges]"
- In agent detail page, show "Recommended Prompts" section
- In chat with agent, show recommended prompts first in selector

#### B) Start Chat with Prompt
- "Start Chat" button on prompt card
- If no variables:
  - Opens new chat session
  - Pre-fills chat input with prompt content
  - User can edit before sending
- If has variables:
  - Opens modal with variable input form
  - User fills in values
  - Creates chat session with filled prompt
  - Pre-fills chat input

#### C) Prompt Selector in Chat
**UI Location:**
- Add "📚 Prompts" button in chat input area (next to send button)
- Clicking opens modal overlay

**Selector Modal:**
- Search bar
- Quick filters: Favorites, Assigned to current agent
- Scrollable list of prompts
- Each prompt shows:
  - Name + description
  - Variable count badge
  - "Insert" button

**Insertion Flow:**
- **No variables**: Immediately insert into chat input (append to existing text)
- **Has variables**:
  - Show variable input form in modal
  - User fills values
  - Insert filled prompt into chat input
  - Close modal

**Variable Form UX:**
- Show each variable as labeled input field
- Display variable name in user-friendly format (e.g., `customer_name` → "Customer Name")
- "Cancel" returns to prompt list
- "Insert" fills and inserts

### 5. Engagement Features

**Favorites:**
- Star icon on each prompt card
- Toggle favorite/unfavorite
- Updates favorite_count globally
- Filter to show only favorited prompts
- Track per-user (junction table)

**Usage Tracking:**
- Increment `usage_count` when:
  - Prompt is inserted via selector
  - Chat is started with prompt
  - Prompt is copied (if we add copy button)
- Display on prompt card
- Use for "Most Used" sorting

**Popular Prompts Section:**
- Dashboard widget or prominent section on main page
- Show top 5-10 most favorited prompts
- Quick access to popular templates

---

## UI/UX Wireframes

### Main Library Page (`/prompts`)
```
┌─────────────────────────────────────────────────────────────┐
│ Prompt Library                          [+ Create Prompt]   │
├─────────────────────────────────────────────────────────────┤
│ 🔍 Search prompts...                                        │
│                                                             │
│ Filters:                                         Sort by:   │
│ [Tags ▾] [Creator ▾] [Agent ▾] [⭐ Favorites]  [Most ⭐▾]  │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐  │
│ │ 📝 Customer Support Template              ⭐ 24 👁 142 │  │
│ │ Help resolve customer issues with empathy              │  │
│ │ 🏷 support  onboarding  customer-service              │  │
│ │ 📊 2 variables  •  Works with: Support Agent, GPT-4   │  │
│ │                                                        │  │
│ │                        [View] [Use] [Edit]            │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ 📝 Code Review Assistant                   ⭐ 18 👁 89 │  │
│ │ Provide constructive code review feedback              │  │
│ │ 🏷 development  code-review                           │  │
│ │ 📊 3 variables  •  Works with: Code Reviewer          │  │
│ │                                                        │  │
│ │                        [View] [Use] [Edit]            │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ ... more prompts ...                                        │
└─────────────────────────────────────────────────────────────┘
```

### Create/Edit Modal
```
┌────────────────────────────────────────────────────────┐
│ Create New Prompt                                  [×] │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Name *                                                 │
│ ┌────────────────────────────────────────────────┐    │
│ │ Customer Support Template                      │    │
│ └────────────────────────────────────────────────┘    │
│                                                        │
│ Description                                            │
│ ┌────────────────────────────────────────────────┐    │
│ │ Help resolve customer issues with empathy      │    │
│ └────────────────────────────────────────────────┘    │
│                                                        │
│ Prompt Content *                                       │
│ ┌────────────────────────────────────────────────┐    │
│ │ You are helping {{customer_name}} resolve     │    │
│ │ their issue with {{product_name}}.            │    │
│ │                                                │    │
│ │ Issue: {{issue_description}}                  │    │
│ │                                                │    │
│ │ Please provide a helpful and empathetic...    │    │
│ └────────────────────────────────────────────────┘    │
│ 💡 Use {{variable_name}} format for dynamic content   │
│ Detected variables: customer_name, product_name,      │
│                     issue_description                 │
│                                                        │
│ Tags (max 5)                                           │
│ ┌────────────────────────────────────────────────┐    │
│ │ [support ×] [onboarding ×] [customer-service ×]│    │
│ │ Add tag...                                     │    │
│ └────────────────────────────────────────────────┘    │
│                                                        │
│ Assign to Agents (optional)                            │
│ ┌────────────────────────────────────────────────┐    │
│ │ Select agents this prompt works well with...   │    │
│ │ ☑ Support Agent    ☑ GPT-4 Assistant          │    │
│ └────────────────────────────────────────────────┘    │
│                                                        │
│ ┌─ Access Control ─────────────────────────────┐      │
│ │ Visibility: [Private ▾]                      │      │
│ │                                              │      │
│ │ Only you and admins can access this prompt   │      │
│ └──────────────────────────────────────────────┘      │
│                                                        │
│                              [Cancel] [Save Prompt]    │
└────────────────────────────────────────────────────────┘
```

### Prompt Selector in Chat
```
Chat Interface:
┌────────────────────────────────────────────────────────┐
│ Chat with Support Agent                            [×] │
├────────────────────────────────────────────────────────┤
│                                                        │
│  User: I need help with customer support              │
│                                                        │
│  Agent: How can I assist you today?                   │
│                                                        │
├────────────────────────────────────────────────────────┤
│ Type a message...                   [📚] [Send]       │
└────────────────────────────────────────────────────────┘

Click [📚 Prompts]:
┌────────────────────────────────────────────────────┐
│ Select a Prompt                                [×] │
├────────────────────────────────────────────────────┤
│ 🔍 Search...                                       │
│ [⭐ Favorites] [Recommended for this agent]       │
├────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────┐    │
│ │ 📝 Customer Support Template           ⭐ 24│    │
│ │ 2 variables                                 │    │
│ │                               [Insert]      │    │
│ ├────────────────────────────────────────────┤    │
│ │ 📝 Escalation Template                 ⭐ 15│    │
│ │ 1 variable                                  │    │
│ │                               [Insert]      │    │
│ ├────────────────────────────────────────────┤    │
│ │ ... more prompts ...                        │    │
│ └────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘

When selecting prompt with variables:
┌────────────────────────────────────────────────────┐
│ Fill in Variables                              [×] │
├────────────────────────────────────────────────────┤
│ Customer Name                                      │
│ ┌──────────────────────────────────────────────┐  │
│ │ John Smith                                   │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ Product Name                                       │
│ ┌──────────────────────────────────────────────┐  │
│ │ Premium Subscription                         │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ Issue Description                                  │
│ ┌──────────────────────────────────────────────┐  │
│ │ Unable to access account after payment      │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│                           [Cancel] [Insert]        │
└────────────────────────────────────────────────────┘
```

### Agent Detail Page Enhancement
```
Agent Details Page:
┌────────────────────────────────────────────────────────┐
│ Support Agent                                          │
├────────────────────────────────────────────────────────┤
│ ... existing agent details ...                         │
│                                                        │
│ ┌─ Recommended Prompts ────────────────────────────┐  │
│ │                                                   │  │
│ │ These prompts work well with this agent:         │  │
│ │                                                   │  │
│ │ 📝 Customer Support Template              ⭐ 24  │  │
│ │    [View] [Start Chat]                           │  │
│ │                                                   │  │
│ │ 📝 Escalation Template                    ⭐ 15  │  │
│ │    [View] [Start Chat]                           │  │
│ │                                                   │  │
│ └───────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Database Schema

```sql
-- Main prompts table
CREATE TABLE prompt_library (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  tags TEXT[] CHECK (array_length(tags, 1) <= 5),
  rights_mode VARCHAR(20) NOT NULL,
  rbac JSONB,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  usage_count INT DEFAULT 0,
  favorite_count INT DEFAULT 0,
  assigned_agents INT[]
);

-- User favorites junction table
CREATE TABLE prompt_favorites (
  user_id INT REFERENCES users(id),
  prompt_id INT REFERENCES prompt_library(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, prompt_id)
);

-- Indexes for performance
CREATE INDEX idx_prompt_tags ON prompt_library USING GIN(tags);
CREATE INDEX idx_prompt_rights ON prompt_library(rights_mode);
CREATE INDEX idx_prompt_creator ON prompt_library(created_by);
CREATE INDEX idx_prompt_favorites ON prompt_library(favorite_count DESC);
CREATE INDEX idx_prompt_usage ON prompt_library(usage_count DESC);
CREATE INDEX idx_prompt_assigned_agents ON prompt_library USING GIN(assigned_agents);
CREATE INDEX idx_prompt_updated ON prompt_library(updated_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_prompt_library_updated_at
  BEFORE UPDATE ON prompt_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### GraphQL Schema

```graphql
type PromptLibrary {
  id: ID!
  name: String!
  description: String
  content: String!
  tags: [String!]!
  rights_mode: String!
  RBAC: RBAC
  created_by: Int!
  creator: User!
  created_at: DateTime!
  updated_at: DateTime!
  usage_count: Int!
  favorite_count: Int!
  assigned_agents: [Int!]
  agents: [Agent!]
  is_favorited: Boolean!  # Computed per current user
  variables: [String!]!   # Extracted from content
}

input CreatePromptInput {
  name: String!
  description: String
  content: String!
  tags: [String!]
  rights_mode: String!
  RBAC: RBACInput
  assigned_agents: [Int!]
}

input UpdatePromptInput {
  name: String
  description: String
  content: String
  tags: [String!]
  rights_mode: String
  RBAC: RBACInput
  assigned_agents: [Int!]
}

type Query {
  prompts(
    search: String
    tags: [String!]
    creator_id: Int
    agent_id: Int
    sort_by: PromptSortBy
    favorites_only: Boolean
  ): [PromptLibrary!]!

  prompt(id: ID!): PromptLibrary

  # Get prompts recommended for a specific agent
  agentPrompts(agent_id: Int!): [PromptLibrary!]!
}

type Mutation {
  createPrompt(input: CreatePromptInput!): PromptLibrary!
  updatePrompt(id: ID!, input: UpdatePromptInput!): PromptLibrary!
  deletePrompt(id: ID!): Boolean!

  # Toggle favorite status
  toggleFavoritePrompt(id: ID!): PromptLibrary!

  # Increment usage count (called when prompt is used)
  incrementPromptUsage(id: ID!): PromptLibrary!
}

enum PromptSortBy {
  MOST_FAVORITED
  MOST_USED
  RECENTLY_CREATED
  RECENTLY_UPDATED
  ALPHABETICAL
}
```

### React Components Structure

```
/app/(application)/prompts/
  page.tsx                          # Main library page with list
  [id]/
    page.tsx                        # Prompt detail/view page
  components/
    prompt-list.tsx                 # List view with grid
    prompt-card.tsx                 # Individual prompt card
    prompt-editor-modal.tsx         # Create/edit modal
    prompt-filters.tsx              # Search and filter panel
    prompt-sort.tsx                 # Sort dropdown
    variable-badge.tsx              # Display variable count
    assigned-agents-badge.tsx       # Display assigned agents

/app/(application)/chat/[agent]/
  components/
    prompt-selector-button.tsx      # Trigger button in chat
    prompt-selector-modal.tsx       # Modal for selecting prompts
    prompt-variable-form.tsx        # Form to fill variables

/app/(application)/agents/[id]/
  components/
    recommended-prompts.tsx         # Section showing agent prompts

/lib/prompts/
  extract-variables.ts              # Parse {{var}} from content
  format-variable-name.ts           # customer_name → "Customer Name"
  validate-variable-name.ts         # Check alphanumeric + underscore
  fill-prompt-variables.ts          # Replace {{var}} with values
  check-prompt-access.ts            # RBAC access checker

/hooks/
  use-prompts.ts                    # Query hook for prompts
  use-create-prompt.ts              # Mutation hook
  use-update-prompt.ts              # Mutation hook
  use-delete-prompt.ts              # Mutation hook
  use-toggle-favorite.ts            # Mutation hook
  use-prompt-selector.ts            # State management for selector
```

### Utility Functions

**Extract Variables**
```typescript
// lib/prompts/extract-variables.ts
export function extractVariables(content: string): string[] {
  const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  const matches = content.matchAll(regex);
  const variables = new Set<string>();

  for (const match of matches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}
```

**Format Variable Name**
```typescript
// lib/prompts/format-variable-name.ts
export function formatVariableName(variable: string): string {
  // customer_name → "Customer Name"
  return variable
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

**Fill Prompt Variables**
```typescript
// lib/prompts/fill-prompt-variables.ts
export function fillPromptVariables(
  content: string,
  values: Record<string, string>
): string {
  let filled = content;

  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    filled = filled.replace(regex, value);
  }

  return filled;
}
```

**Check Prompt Access**
```typescript
// lib/prompts/check-prompt-access.ts
export function checkPromptAccess(
  prompt: PromptLibrary,
  user: User,
  requiredLevel: 'read' | 'write'
): boolean {
  // Creator always has access
  if (prompt.created_by === user.id) return true;

  // Admin always has access
  if (user.role === 'admin') return true;

  // Check rights_mode
  if (prompt.rights_mode === 'private') return false;
  if (prompt.rights_mode === 'public') return requiredLevel === 'read';

  // Check RBAC
  if (prompt.rights_mode === 'users') {
    const userAccess = prompt.RBAC?.users?.find(u => u.id === user.id);
    if (!userAccess) return false;
    return requiredLevel === 'read' || userAccess.rights === 'write';
  }

  if (prompt.rights_mode === 'roles') {
    const roleAccess = prompt.RBAC?.roles?.find(r => r.id === user.role);
    if (!roleAccess) return false;
    return requiredLevel === 'read' || roleAccess.rights === 'write';
  }

  // Similar logic for projects...

  return false;
}
```

---

## User Stories & Acceptance Criteria

### Story 1: Create Prompt with Variables
**As a user**, I want to create a prompt template with variables so I can reuse it with different values.

**Acceptance Criteria:**
- [ ] Can click "Create Prompt" button from main page
- [ ] Modal opens with all required fields
- [ ] Can type `{{variable_name}}` in content
- [ ] Variables are auto-detected and displayed
- [ ] Invalid variable names show error
- [ ] Can add up to 5 tags
- [ ] Cannot save without name and content
- [ ] RBAC defaults to "private"
- [ ] Successfully creates and shows in list

### Story 2: Search and Filter Prompts
**As a user**, I want to search and filter prompts so I can find relevant templates quickly.

**Acceptance Criteria:**
- [ ] Search bar searches name, description, and content
- [ ] Can filter by multiple tags simultaneously
- [ ] Can filter by creator
- [ ] Can filter by assigned agent
- [ ] Can toggle "favorites only" filter
- [ ] Results update in real-time
- [ ] Can sort by different criteria
- [ ] Empty state shows when no results

### Story 3: Use Prompt in Chat
**As a user**, I want to insert a prompt into my chat so I don't have to copy/paste.

**Acceptance Criteria:**
- [ ] Prompt selector button visible in chat input area
- [ ] Clicking opens modal with searchable prompt list
- [ ] Prompts assigned to current agent appear first
- [ ] Can search prompts in modal
- [ ] For prompt without variables: clicking "Insert" adds to input
- [ ] For prompt with variables: shows variable form
- [ ] Variable form has labeled inputs for each variable
- [ ] Filling and inserting replaces {{vars}} with values
- [ ] Inserted text appends to existing input content
- [ ] Modal closes after insertion
- [ ] Usage count increments

### Story 4: Assign Prompts to Agents
**As a user**, I want to assign prompts to specific agents so I know which prompts work best.

**Acceptance Criteria:**
- [ ] Can select multiple agents in prompt editor
- [ ] Agent assignment saves correctly
- [ ] Prompt card shows "Works with: [agents]" badge
- [ ] Agent detail page shows "Recommended Prompts" section
- [ ] Can start chat from recommended prompts
- [ ] In chat selector, recommended prompts appear first

### Story 5: Favorite Prompts
**As a user**, I want to favorite prompts so I can quickly access my most-used ones.

**Acceptance Criteria:**
- [ ] Star icon on each prompt card
- [ ] Clicking toggles favorite status
- [ ] Filled star shows for favorited prompts
- [ ] Can filter to show only favorites
- [ ] Favorite count updates globally
- [ ] Favorites persist across sessions
- [ ] Sort by "Most Favorited" works correctly

### Story 6: Share Prompts with Team
**As an admin**, I want to share prompts with specific users or roles so they can benefit.

**Acceptance Criteria:**
- [ ] RBAC control visible in prompt editor
- [ ] Can select visibility mode (private/public/users/roles/projects)
- [ ] For "users" mode, can search and select users
- [ ] For "roles" mode, can select job roles
- [ ] Can set read vs write permissions
- [ ] Users without write access cannot edit
- [ ] Users without read access cannot see prompt
- [ ] Shared prompts appear in recipient's library

### Story 7: Start Chat with Prompt
**As a user**, I want to start a new chat with a prompt so I can begin conversations quickly.

**Acceptance Criteria:**
- [ ] "Start Chat" button on prompt card
- [ ] Clicking opens agent selector (or uses default)
- [ ] If no variables: creates chat with pre-filled input
- [ ] If has variables: shows variable form first
- [ ] After filling variables, creates chat with filled prompt
- [ ] User can edit pre-filled text before sending
- [ ] Usage count increments

### Story 8: View Prompt Details
**As a user**, I want to view full prompt details so I understand what it does.

**Acceptance Criteria:**
- [ ] Clicking prompt name/card opens detail view
- [ ] Shows full content (not truncated)
- [ ] Shows all metadata (creator, dates, stats)
- [ ] Shows assigned agents
- [ ] Shows detected variables with examples
- [ ] Has "Use", "Edit", "Delete" buttons (based on permissions)
- [ ] Can favorite from detail view
- [ ] Breadcrumb navigation back to list

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Database schema and migrations
- [ ] GraphQL schema definition
- [ ] Basic CRUD mutations
- [ ] Basic queries with filters
- [ ] Access control utility functions
- [ ] Variable extraction utilities

### Phase 2: Main UI (Week 2)
- [ ] Main prompts page with list view
- [ ] Prompt card component
- [ ] Search and filter panel
- [ ] Sort functionality
- [ ] Create/edit modal with variable detection
- [ ] RBAC integration
- [ ] Delete confirmation

### Phase 3: Chat Integration (Week 3)
- [ ] Prompt selector button in chat
- [ ] Prompt selector modal
- [ ] Variable input form
- [ ] Insert prompt into chat logic
- [ ] Usage tracking
- [ ] Start chat with prompt

### Phase 4: Agent Integration (Week 4)
- [ ] Agent assignment in prompt editor
- [ ] Recommended prompts on agent detail page
- [ ] Filter by agent in main library
- [ ] Recommended prompts first in chat selector

### Phase 5: Engagement Features (Week 5)
- [ ] Favorite/unfavorite functionality
- [ ] Favorites filter
- [ ] Usage count tracking
- [ ] Sort by favorites/usage
- [ ] Popular prompts section
- [ ] Analytics dashboard (optional)

### Phase 6: Polish & Testing (Week 6)
- [ ] Error handling and edge cases
- [ ] Loading states and skeletons
- [ ] Empty states
- [ ] Responsive design
- [ ] Accessibility (keyboard navigation, ARIA labels)
- [ ] Unit tests for utilities
- [ ] Integration tests for mutations
- [ ] E2E tests for critical flows
- [ ] Performance optimization

---

## Future Enhancements (Not in Scope)
- System variables (`{{current_date}}`, `{{user_name}}`, etc.)
- Prompt categories/folders
- Version history
- Import/export functionality
- Public marketplace
- Prompt analytics dashboard
- AI-powered prompt suggestions
- Prompt templates library
- Collaborative editing
- Comments on prompts

---

## Questions & Decisions Log

### Variable Syntax
**Decision**: Only support `{{variable}}` format
**Rationale**: Simple, clear, consistent with common templating systems

### Default Variables
**Decision**: Not implementing system variables in v1
**Rationale**: Keep scope focused, can add later if needed

### Categories
**Decision**: Tags only, no predefined categories
**Rationale**: More flexible, users can create their own organization

### Agent Integration
**Decision**: Show as recommended only, not modifying agent system prompts
**Rationale**: Less complex, prompts remain user-controllable

### Tag Limits
**Decision**: Max 5 tags per prompt
**Rationale**: Prevents tag spam, encourages thoughtful categorization

### Content Length
**Decision**: No hard limit on prompt content
**Rationale**: Database can handle it, let users decide

### Public Marketplace
**Decision**: Not building public marketplace
**Rationale**: Out of scope for v1, focus on internal team sharing

---

## Success Metrics

**Adoption:**
- Number of prompts created per user
- Percentage of users who have created at least one prompt
- Number of active users using prompts weekly

**Engagement:**
- Average prompts used per chat session
- Favorite rate (favorites / total prompts)
- Most favorited prompts

**Efficiency:**
- Time saved by using prompts vs typing manually
- Number of chats started with prompts
- Repeat usage rate of prompts

**Sharing:**
- Percentage of prompts shared beyond creator
- Number of users accessing shared prompts
- Cross-team prompt sharing

---

## Technical Debt & Considerations

**Performance:**
- Index tags array for fast filtering
- Consider pagination for large prompt libraries (100+ prompts)
- Cache popular prompts

**Security:**
- Validate RBAC on all mutations
- Sanitize user input for XSS
- Rate limit prompt creation

**UX:**
- Provide helpful examples for variable syntax
- Show preview of filled prompt before insertion
- Undo after prompt insertion

**Data Migration:**
- Plan for future schema changes
- Consider export functionality for backup

---

## Appendix: Related Files

**RBAC Implementation:**
- `/components/rbac.tsx` - RBAC UI component
- `/lib/check-chat-session-write-access.ts` - Access checker pattern
- `/types/models/project.ts` - Example RBAC model

**UI Patterns:**
- `/components/ui/*` - shadcn/ui components to reuse
- `/app/(application)/evals/[id]/runs/components/*` - Table patterns
- `/app/(application)/agents/edit/[id]/form.tsx` - Form patterns

**Data Table:**
- Can reuse data table components if we want tabular view
- Current implementation uses Tanstack Table

---

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Status:** Ready for Implementation
