# Contributing to Grund

## Branching Strategy

### Branch Naming Convention
- `feature/[description]` - New features or capabilities
- `fix/[description]` - Bug fixes
- `refactor/[description]` - Code refactoring
- `agent/[agent-name]` - New agent development
- `client/[client-name]` - Client-specific tooling (never actual client data)

### Workflow
1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/daily-brief-agent
   ```

2. **Make commits** with clear messages:
   ```bash
   git commit -m "Add Daily Brief agent context and pipeline"
   ```

3. **Push the branch**:
   ```bash
   git push -u origin feature/daily-brief-agent
   ```

4. **Create a Pull Request** when ready for review:
   ```bash
   gh pr create
   ```

5. **Merge to main** after review (or self-review for personal project)

### Commit Message Format
```
[type]: [description]

[optional body]

[optional footer]
```

Types:
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring
- `docs:` Documentation changes
- `test:` Test additions or fixes
- `chore:` Maintenance tasks

### When to Create a PR
- Any significant feature addition
- Changes that affect multiple packages
- Agent implementations
- Infrastructure changes
- When you want to document the change history

### When Direct to Main is OK
- Small documentation fixes
- Typo corrections
- Emergency hotfixes (document why in commit)

## Development Guidelines

### Agents
- Each agent lives in `packages/agents/[agent-name]/`
- Must include: `CONTEXT.md`, data schemas, TypeScript types
- Add tests for data helpers and utilities


### Testing
- Run tests before creating PR: `bun test`
- Run typecheck: `bun run typecheck`
- Ensure all packages build successfully

### Code Style
- TypeScript for all new code
- Prefer functional patterns
- Keep AI agent context documents minimal and scannable
- Use clear, descriptive names

## Project Structure
```
grund/
├── apps/           # User-facing applications
├── packages/       # Shared libraries and services
│   ├── agents/     # AI agent definitions
│   ├── api/        # Backend API
│   ├── db/         # Database schemas
│   └── shared/     # Shared types and utilities