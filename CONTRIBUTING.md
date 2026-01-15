# Contributing to Medical Companion PWA

Thank you for your interest in contributing to the Medical Companion PWA! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## How to Contribute

### Reporting Issues

1. Check if the issue already exists in the [Issues](../../issues) section
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce the problem
   - Expected vs actual behavior
   - Screenshots if applicable
   - Browser and OS information

### Suggesting Features

1. Check existing feature requests first
2. Open a new issue with the "enhancement" label
3. Describe the feature and its benefits
4. Include mockups or examples if possible

### Contributing Code

#### Setup Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/medical-companion-pwa.git
   cd medical-companion-pwa
   ```

3. Install dependencies:
   ```bash
   npm install
   cd backend && npm install
   ```

4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Development Guidelines

##### Code Style

- **TypeScript**: Use strict mode, define interfaces for all data structures
- **React**: Functional components with hooks
- **Formatting**: Use Prettier (configuration included)
- **Linting**: Follow ESLint rules
- **Naming**:
  - Components: PascalCase
  - Functions/variables: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Files: camelCase for utils, PascalCase for components

##### Best Practices

1. **Type Safety**
   ```typescript
   // Good
   interface Props {
     data: Finding;
     onUpdate: (id: string) => void;
   }

   // Bad
   const Component = (props: any) => {}
   ```

2. **Error Handling**
   ```typescript
   // Good
   try {
     const result = await api.fetchData();
     return { success: true, data: result };
   } catch (error) {
     logger.error('Fetch failed:', error);
     return { success: false, error };
   }
   ```

3. **Component Structure**
   ```typescript
   // Follow consistent ordering
   export function Component() {
     // 1. State declarations
     // 2. Computed values (useMemo)
     // 3. Effects (useEffect)
     // 4. Event handlers
     // 5. Render
   }
   ```

##### Testing

- Write tests for new features
- Ensure existing tests pass
- Test edge cases and error conditions
- Use meaningful test descriptions

##### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(chat): add streaming response support
fix(auth): resolve token refresh race condition
docs(readme): update installation instructions
```

#### Pull Request Process

1. **Before submitting:**
   - Run type checking: `npm run type-check`
   - Fix any linting issues
   - Test your changes thoroughly
   - Update documentation if needed

2. **PR Description should include:**
   - What changes were made
   - Why they were necessary
   - How to test the changes
   - Screenshots for UI changes
   - Breaking changes (if any)

3. **Review process:**
   - PRs require at least one review
   - Address all feedback constructively
   - Keep PRs focused and reasonably sized
   - Update your branch with main if needed

## Development Principles

### "Facts, Not Scores™" Philosophy

This project adheres to displaying only factual, verifiable information:
- No arbitrary metrics or scores
- All information must be attributed to sources
- Transparency is paramount

### Privacy First

- User data stays local (IndexedDB)
- No automatic cloud sync
- Clear data ownership

### Accessibility

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support

## Project Structure

```
medical-companion-pwa/
├── src/               # Frontend React application
│   ├── components/    # React components
│   ├── services/      # Business logic and API calls
│   ├── stores/        # Zustand state management
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Utility functions
├── backend/           # Node.js Express backend
│   ├── src/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Business logic
│   │   └── types/     # TypeScript types
│   └── dist/          # Compiled JavaScript
├── public/            # Static assets
└── docs/              # Documentation

```

## Getting Help

- Check the [CLAUDE.md](./CLAUDE.md) file for architectural decisions
- Review existing issues and discussions
- Ask questions in pull requests
- Reference the [README.md](./README.md) for setup instructions

## Recognition

Contributors will be recognized in:
- The project's contributors list
- Release notes for significant contributions
- Documentation for major features

## Questions?

Feel free to open an issue for any questions about contributing!

---

Thank you for helping make Medical Companion PWA better! 🙏