# Exulu Frontend

<div align="center">

![Exulu Logo](public/exulu_logo.svg)

**The open-source management interface for Exulu IMP**

[![Node.js](https://img.shields.io/badge/Node.js-22.18.0-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0.4-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.4-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

## Overview

Exulu Frontend is a powerful, open-source web interface for managing AI agents, workflows, and knowledge contexts. Built with Next.js and TypeScript, it provides an intuitive experience for interacting with the Exulu IMP (Intelligence Management Platform) backend.

Think of it as your command center for AI orchestration - where you design agents, manage their knowledge sources, monitor performance, and orchestrate complex workflows.

### Why Open Source?

We believe that developer tools should be transparent, customizable, and community-driven. The Exulu Frontend is open source to enable:

- **Customization**: Adapt the interface to your specific needs
- **Transparency**: See exactly how your AI management interface works
- **Community Innovation**: Benefit from and contribute to ongoing improvements
- **Self-Hosting**: Deploy on your own infrastructure with full control

## Key Features

### 🤖 Agent Management
- Visual agent configurations
- Support for all your Exulu configured AI models and providers
- Real-time agent testing and debugging
- Custom tool and capability assignment
- Template agent library for quick starts
- Visual overview of evals
- User management, role management and authentication

### 💬 Interactive Chat Interface
- Multi-session chat with individual agents
- Real-time streaming responses
- Rich message formatting with markdown, code highlighting, and LaTeX
- File upload and attachment support
- Session history and management
- Ability to create lottie based agent animations for idle, talking and thinking states

### 🗄️ Context Management
- GUI for managing and adding data to knowledge bases
- GUI for triggering embedding generation and monitoring
- Semantic search and retrieval testing
- Context usage analytics and insights

### 🔄 Workflow Orchestration
- Visual workflow creating (turn conversations into workflows)
- Multi-agent coordination and task delegation
- Async job monitoring and management

### 📊 Analytics Dashboard
- Comprehensive usage metrics and statistics
- Token consumption tracking
- Agent performance analytics
- Time-series charts and data visualization

### 🧪 Evaluation Framework
- Create test cases and evaluation sets
- Run automated agent evaluations
- Compare agent performance across iterations
- Track evaluation metrics over time
- Export results for analysis

### 👥 User & Access Management
- Role-based access control (RBAC)
- Granular permissions for agents, workflows, and data
- User invitation and onboarding
- API key generation and management
- Authentication with JWT and NextAuth

### 🎨 Theming & Customization
- Light and dark mode support
- Customizable color schemes via CSS variables
- Responsive design for desktop and mobile
- Import and export theme configurations

### 🏷️ Branding Assets

White-label the app by dropping files into the `public/` folder of the project
where you run the Exulu backend package. The backend serves that folder
statically and the frontend loads the assets from the backend URL:

| File | Used for | Format |
| --- | --- | --- |
| `logo_light.png` | Logo in light mode | PNG |
| `logo_dark.png` | Logo in dark mode | PNG |
| `cover.jpg` | Login screen cover image | JPEG |
| `favicon.png` | Browser tab icon and installed-app icon (Windows taskbar, iOS/Android home screen) | Square PNG, 512×512 recommended, transparent background |

Missing files simply 404 and browsers fall back to their defaults.

To name the installed app (the label under the icon), set the optional
`APP_NAME` environment variable on the frontend. Defaults to `IMP`.

### 🔧 Developer Tools
- GraphQL API explorer with GraphiQL interface
- Query examples and templates

## Getting Started

### Prerequisites

- Node.js 22.18.0 (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- A running Exulu IMP backend instance
- Properly setup environment variables

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/Qventu/exulu-frontend.git
cd exulu-frontend
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Check .env.example.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

The Exulu Frontend is open source, while the Exulu IMP backend requires a commercial license. See [exulu.com](https://exulu.com) for backend licensing information.

---

<div align="center">

**Exulu Frontend** - Open-source frontend client for the Exulu Intelligence Management Platform

Made with ❤️ by [Qventu](https://qventu.com)

</div>