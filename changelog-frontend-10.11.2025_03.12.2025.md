
---
## feat: integrate project context into agent sessions with enhanced UI

- Add project information display in chat sessions with project name, description, and link
- Modify agent loading logic to wait for session data to enable project-based tool ingestion
- Enhance project item cards with improved metadata display (date, char count, chunks)
- Add type safety checks for todo-list status/priority configurations
- Update agent session queries and types to include project field
- Temporarily disable project-based RBAC sharing option
- Update context processor trigger type from "onCreate" to "onInsert" for consistency
- Remove unused imports and optimize query dependencies

This enables agents to access project-specific retrieval tools when a session
is associated with a project, improving contextual awareness and tooling capabilities.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

---
## feat: enhance queue management with bulk operations and UI improvements

Add bulk job deletion and improve queue management UI across the application:

**Queue Management Enhancements:**
- Add checkbox selection for individual and bulk job deletion
- Implement bulk delete functionality with parallel job processing
- Add "Delete N jobs" button that appears when jobs are selected
- Update delete confirmation dialog to handle both single and multiple jobs
- Disable selection checkboxes for active jobs to prevent accidental deletion
- Add retry job functionality with proper error handling

**UI/UX Improvements:**
- Fix scrolling issues in chat layout and agent navigation
- Add queue management section to context embeddings page
- Move embedding generation/deletion controls to dropdown menu in RecentEmbeddings
- Clean up file upload state management in chat interface
- Improve overflow handling with max-height constraints
- Remove unused imports and cleanup component code

**Authentication & Infrastructure:**
- Fix JWT secret encoding to use base64url format as required by jose
- Implement connection pool singleton pattern to prevent multiple pools in dev mode
- Add proper error handling and client release in finally blocks
- Add environment variable validation for NEXTAUTH_SECRET

**Data Management:**
- Add queue visibility for source updates in embeddings view
- Integrate QueueManagement component into data/embeddings page
- Update toast notifications to use sonner library consistently
- Add source retry functionality with proper configuration lookup

**Package Updates:**
- Add new dependencies to support enhanced functionality

This update significantly improves the queue management experience by enabling
batch operations and providing better visibility into background jobs across
the application.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

---
## feat: add parameter support for context source execution

Add support for configurable parameters when triggering context sources:

- Add params field to source config type definition with name,
  description, and default values
- Implement parameter input form in source trigger dialog
- Initialize parameter values with defaults when opening trigger dialog
- Pass parameter values to executeSource mutation
- Add Response component for rendering authentication information
  with markdown support
- Clean up parameter state when closing dialog
- Update GraphQL query to fetch source params configuration

This enables dynamic configuration of source executions through
a user-friendly dialog interface, allowing users to customize
source behavior at runtime with proper default values and descriptions.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

---
## feat: add prompt library integration to chat with agent selection and embedder configuration

This commit introduces a comprehensive prompt library integration into the chat interface,
along with enhanced embedder configuration capabilities.

Key changes:

Chat Experience:
- Add new ChatEmptyState component displaying popular prompt templates with agent selection
- Enable prompt-based chat initialization via promptId query parameter
- Show prompt metadata (usage count, favorites, tags, variables) in empty state
- Auto-populate chat input when navigating from prompt library
- Improve user onboarding by surfacing prompt templates on empty chat page

Embedder Configuration:
- Add embedder configuration UI to context embeddings view
- Implement VariableSelectionElement for API key and config selection
- Support creating and updating embedder configs with GraphQL mutations
- Display embedder details and configuration options in data display
- Show authentication information for provider API keys

Code Quality & Bug Fixes:
- Export VariableSelectionElement component for reuse across forms
- Fix potential undefined error in columns when text field is missing
- Add language prop to CodePreview for JSON formatting
- Improve code preview formatting with proper type checking
- Clean up authentication layout by removing ToC footer links

GraphQL Integration:
- Add GET_PROMPT_BY_ID, CREATE_EMBEDDER_CONFIG, UPDATE_EMBEDDER_CONFIG queries
- Add GET_AGENTS_BY_IDS for batch agent fetching
- Extend chat queries to support prompt initialization flow

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

---
## fix: typescript issue with iterable


---
## fix: typescript issue with iterable


---
## feat: add prompt library with RBAC and chat integration

Implements a centralized prompt library system allowing users to create,
organize, share, and reuse AI prompts with variable support.

Key features:
- Prompt management: Create, edit, delete prompts with {{variable_name}} syntax
- RBAC integration: Full access control with private/public/users/roles/projects
- Chat integration: Prompt selector modal with variable filling
- Discovery: Search, filter by tags/creator/agent, sort by favorites/usage/date
- Agent assignment: Link prompts to specific agents with recommendations
- Engagement: Favorites, usage tracking, and popular prompts

Components added:
- /app/(application)/prompts: Main library page with grid view and filters
- Prompt selector modal for chat sessions with variable form
- Utility functions for variable extraction, formatting, and RBAC checks
- Custom hooks for CRUD operations and state management

Database schema:
- prompt_library table with tags, RBAC, and usage metrics
- prompt_favorites junction table for per-user favorites
- Indexes for performance on tags, usage, and favorites

Configuration:
- Added MCP server configuration for default coding agent
- Added comprehensive feature specification document

Files changed:
- 40+ files modified across chat, evals, data, and user management
- Removed deprecated jobs module
- Enhanced navigation with prompt library link
- Updated RBAC utilities for prompt access control

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

---
## feat: enhance data management with sources/embeddings split and dashboard leaderboards

This commit introduces significant improvements to the data management interface and
dashboard analytics:

Data Management Enhancements:
- Split context settings into dedicated "Sources" and "Embeddings" tabs for better
  organization
- Renamed context-settings.tsx to embeddings.tsx and created new sources.tsx component
- Updated navigation in contexts sidebar to show Sources and Embeddings options instead
  of single Settings tab
- Enhanced tool configuration items with default value preview and improved text
  formatting
- Added TextPreview component for displaying truncated text with expand functionality

Dashboard Improvements:
- Added new Leaderboard component for tracking top performers across multiple dimensions
- Implemented three leaderboards: Top Users, Top Projects, and Top Agents
- Added toggle between "Count" and "Tokens" views for leaderboard metrics
- Enhanced DonutChart and TimeSeriesChart components with better data visualization
- Added queries for user statistics, project statistics, and agent statistics
- Integrated user and project hydration queries for displaying entity names

Component Enhancements:
- Created reusable TodoList component for AI elements
- Enhanced MessageRenderer with better type handling
- Improved RoleForm with updated field validation
- Updated MainNav with refined navigation structure
- Enhanced text preview component with configurable slice length

Configuration & Build:
- Updated .gitignore to exclude package/dist/* and .env-selector-history.json
- Added select-env.js script for environment management
- Updated type definitions for BullMQ and Context models
- Added new queries for statistics and entity hydration
- Enhanced auth options with improved session handling

Code Quality:
- Removed trailing whitespace throughout agent form
- Improved type safety for tool configuration items
- Enhanced capitalization for tool config labels and descriptions
- Better error handling and loading states across components

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>

---