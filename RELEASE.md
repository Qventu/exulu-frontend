# Semantic Release with Docker Image Building

This project uses semantic-release to automatically manage version numbers and create GitHub releases, while also building and pushing Docker images with the corresponding version tags.

## How it works

1. **Commit Convention**: The project follows [Conventional Commits](https://www.conventionalcommits.org/) to determine version bumps:
   - `feat:` - Minor version bump (new feature)
   - `fix:` - Patch version bump (bug fix)
   - `BREAKING CHANGE:` - Major version bump (breaking change)

2. **Automatic Release Process**:
   - When code is pushed to the `main` branch, semantic-release analyzes the commits
   - It determines the next version number based on commit messages
   - Creates a GitHub release with the new version tag (e.g., `v1.2.3`)
   - Generates a changelog based on the commits

3. **Docker Image Building**:
   - After the release is created, the workflow builds a Docker image
   - The image is tagged with multiple tags including:
     - `latest` (for the main branch)
     - `v1.2.3` (exact version)
     - `v1.2` (major.minor)
     - `v1` (major only)

## Configuration Files

- `release.config.cjs` - Semantic-release configuration
- `.github/workflows/release.yml` - GitHub Actions workflow
- `package.json` - Contains semantic-release script and dependencies

## Commit Message Examples

```bash
# Patch release (1.0.0 -> 1.0.1)
git commit -m "fix: resolve authentication issue"

# Minor release (1.0.0 -> 1.1.0)
git commit -m "feat: add user dashboard"

# Major release (1.0.0 -> 2.0.0)
git commit -m "feat: redesign API

BREAKING CHANGE: API endpoints have been restructured"
```

## Workflow Triggers

The release workflow is triggered by:
- Pushes to the `main` branch
- Pushes of semantic version tags (e.g., `v1.2.3`)

## Docker Image Tags

The Docker image will be available with the following tags:
- `ghcr.io/your-org/your-repo:latest`
- `ghcr.io/your-org/your-repo:v1.2.3`
- `ghcr.io/your-org/your-repo:v1.2`
- `ghcr.io/your-org/your-repo:v1`

## Prerequisites

- GitHub repository with GitHub Actions enabled
- Proper permissions for the workflow (contents, issues, pull-requests, packages)
- Docker registry access (GitHub Container Registry in this case) 