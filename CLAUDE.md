# Exulu Frontend - Design Context

## Design Context

### Users

**Who:** Developers, DevOps engineers, AI/ML practitioners, and technical teams managing AI agent orchestration and workflows.

**Context:** Users are working in a professional development environment, often multitasking between multiple tools (IDEs, terminals, dashboards). They need quick access to agent status, chat history, knowledge contexts, and analytics. They may be debugging agent behavior, configuring new workflows, or monitoring production AI operations.

**Job to be done:**
- Configure and manage AI agents across multiple models and providers
- Monitor and debug AI agent behavior in real-time
- Organize and manage knowledge contexts for agent RAG
- Analyze usage patterns and optimize costs
- Ensure reliable, transparent AI operations

**Emotional goals:**
- **Efficiency & Speed:** Interface should be fast, direct, and minimize friction - no unnecessary clicks or cognitive overhead
- **Confidence & Control:** Users should feel empowered and in command of complex AI operations with clear visibility into what's happening

### Brand Personality

**Voice & Tone:** Professional yet approachable. Trustworthy without being boring. Intelligent without being condescending. Direct communication with technical accuracy.

**3-Word Personality:** Professional, Trustworthy, Intelligent

**References:**
- **Vercel Dashboard:** Developer-focused aesthetic, clean information hierarchy, purposeful spacing
- **Linear:** Fast, precise, purposeful design with subtle but delightful animations
- **Payload CMS:** Technical sophistication balanced with visual polish

**Anti-References:**
- ❌ **Generic Bootstrap/Material Design:** Avoid templated, off-the-shelf look
- ❌ **Dense/cluttered dashboards:** Not legacy admin panels with overwhelming information density
- ❌ **Overly playful/casual:** This is a professional developer tool, not a consumer app

### Aesthetic Direction

**Visual Tone:** Modern developer tool with technical sophistication. Clean, organized, and purposeful with restrained use of vibrant accents.

**Color Strategy:**
- **Primary Purple** (`hsl(257.9, 100%, 60%)` in light, `hsl(257.6, 100%, 68%)` in dark): Vibrant accent for primary actions, active states, and key UI elements. Use sparingly for maximum impact.
- **Neutral Foundation:** Cool gray backgrounds (`--background`, `--card`, `--muted`) that recede to let content shine
- **Semantic Colors:** Clear distinction between success (green), destructive (red), warning (orange), and info (blue/purple)
- **Dark Mode First Thinking:** Both themes are equally important - test in both

**Typography Hierarchy:**
```
Display/Hero: text-4xl (2.25rem) - True hero/display moments only (page titles are text-2xl)
Heading 1: text-2xl (1.5rem) - Section titles
Heading 2: text-xl (1.25rem) - Subsection titles
Heading 3: text-lg (1.125rem) - Card titles, group labels
Body: text-base (1rem) - Default text, descriptions
Small: text-sm (0.875rem) - Labels, secondary info, metadata
Tiny: text-xs (0.75rem) - Badges, timestamps, helper text
Code: font-mono - Technical content, API responses
```

**Spacing Scale Standardization:**
```
Micro: gap-1, p-1 (0.25rem) - Tight spacing within components
Small: gap-2, p-2 (0.5rem) - Between related elements
Default: gap-4, p-4 (1rem) - Standard component spacing
Medium: gap-6, p-6 (1.5rem) - Between component groups
Large: gap-8, p-8 (2rem) - Between major sections
XL: gap-12, p-12 (3rem) - Page-level spacing
```

**Component Philosophy:**
- **shadcn/ui as foundation:** Leverage existing components for consistency
- **Subtle animations:** Purposeful motion that enhances usability (accordion, hover states, page transitions) - never gratuitous
- **Information density:** Balance between showing relevant data and avoiding clutter - use progressive disclosure
- **Responsive by default:** Mobile-friendly but desktop-optimized (developers primarily work on larger screens)

**Interaction Patterns:**
- Hover states should be subtle but noticeable (background transitions, border highlights)
- Focus states must be clear for keyboard navigation (ring offset pattern)
- Loading states should be immediate and contextual (skeleton > spinner > gradient shimmer based on context)
- Micro-interactions on buttons, cards, and interactive elements (scale, shadow, border changes)

### Design Principles

These principles should guide all design decisions for Exulu:

#### 1. **Clarity Over Cleverness**
Information architecture and UI patterns should be immediately obvious. Developers want to get work done, not decode your interface. Use clear labels, logical grouping, and familiar patterns. Avoid hiding critical functionality behind obscure icons or nested menus.

*Example: Agent status, model selection, and key actions should be visible at a glance, not buried in dropdowns.*

#### 2. **Performance is a Feature**
Speed and responsiveness are non-negotiable. Optimize for perceived performance with instant feedback, optimistic UI updates, and streaming responses. Every animation should be fast (<300ms), every action should feel immediate, and loading states should be contextual.

*Example: Chat messages stream in real-time, page transitions are instant, skeleton loaders appear immediately while data loads.*

#### 3. **Trust Through Transparency**
This is an open-source platform for managing AI operations - transparency is core to the value proposition. Show what's happening under the hood: token usage, model selections, reasoning steps, error details. Use expandable sections for advanced details, but never hide critical information.

*Example: Collapsible reasoning steps, citation sources for knowledge, clear error messages with actionable solutions.*

#### 4. **Sophisticated Simplicity**
Interface should be clean and uncluttered while handling complex workflows. Use progressive disclosure: show essentials by default, advanced options on demand. Embrace whitespace. Let the vibrant purple accent do the heavy lifting for visual hierarchy - don't over-design.

*Example: Agent cards show key info (name, status, description) with a details button for full configuration. Dashboard shows summary cards that expand to detailed charts.*

#### 5. **Consistent Yet Flexible**
Maintain strict consistency in spacing, typography, color usage, and component patterns across the app. But allow for contextual flexibility when needed - not everything is a card, not every action is a button. Use the design system as a foundation, not a prison.

*Example: Standard button variants (default, outline, ghost) used consistently, but custom styles for the chat input area where the context demands it.*

---

## Technical Implementation Notes

### Current Stack
- **Framework:** Next.js 16.0.10 (React 19, App Router)
- **Styling:** Tailwind CSS 3.4.0 with CSS variables for theming
- **Components:** shadcn/ui (Radix UI primitives)
- **Icons:** Lucide React (stroke-width: 1 for consistency)
- **Animations:** Framer Motion + tailwindcss-animate
- **Theme:** next-themes for light/dark mode
- **Typography:** Inter (sans), JetBrains Mono (mono), Merriweather (serif)

### Color System
All colors are defined as HSL values in CSS variables for easy theming. Primary purple and chart colors are already established. Maintain the existing color palette for consistency.

### Component Patterns
Follow the established shadcn/ui patterns:
- `Button` variants: default, destructive, outline, secondary, ghost, link
- `Card` structure: Card > CardHeader > CardTitle/CardDescription > CardContent > CardFooter
- `Badge` for status indicators
- Radix UI for complex components (Dialog, Dropdown, Tooltip, etc.)

### Animation Standards
- **Fast transitions:** 150-200ms for hover/focus states
- **Standard transitions:** 300ms for component state changes
- **Slower transitions:** 500ms for page transitions or complex animations
- **Easing:** Use `ease-in-out` for most transitions

### Accessibility
- Maintain focus rings with offset for keyboard navigation
- Use semantic HTML structure
- Include ARIA labels for icon-only buttons
- Ensure color contrast meets WCAG AA standards
- Support reduced motion preferences

---

## Common Design Decisions

### When to use each button variant:
- **default:** Primary actions (Submit, Create, Save)
- **outline:** Secondary actions alongside primary (Cancel with Submit)
- **ghost:** Tertiary actions, icon buttons, navigation items
- **destructive:** Delete, remove, dangerous actions (with confirmation)
- **link:** In-text navigation, subtle actions in prose

### Card vs. plain container:
- **Card:** Distinct UI blocks with related content (agent cards, dashboard widgets, form sections)
- **Plain container:** Layout structure, spacing wrappers, full-width content areas

### Badge usage:
- **default:** Status indicators (Active, Running)
- **secondary:** Categories, tags, labels
- **destructive:** Error states, failures
- **outline:** Inactive or neutral states

### Loading state patterns:
- **Skeleton:** Initial page load for known layouts (dashboard, lists)
- **Gradient shimmer:** Streaming text (chat messages)
- **Spinner:** Indeterminate actions (form submission, API calls)

---

*This design context should guide all future work on the Exulu frontend. Refer back to these principles when making decisions about layout, components, interactions, or visual style.*
