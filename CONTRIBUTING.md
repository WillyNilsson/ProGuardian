# Contributing to ProGuardian CLI

Thank you for your interest in contributing to ProGuardian CLI! We welcome contributions that help improve the Guardian's supervision capabilities and ensure AI coding assistants produce high-quality, secure code.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct: be respectful, inclusive, and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git

### Development Setup

1. **Fork and clone the repository:**

   ```bash
   git clone https://github.com/YOUR-USERNAME/proguardian-cli.git
   cd proguardian-cli
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Run tests to verify setup:**

   ```bash
   npm test
   ```

4. **Create a new branch for your feature:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### 1. Before You Start Coding

- Check existing issues and pull requests to avoid duplicate work
- For significant changes, open an issue first to discuss your proposal
- Ensure your fork is up-to-date with the main branch

### 2. During Development

Follow the Guardian's own quality standards:

#### Code Quality Checklist

- [ ] Functions are under 20 lines
- [ ] No more than 3 levels of nesting
- [ ] Self-documenting variable and function names
- [ ] No hardcoded values (use constants)
- [ ] Proper error handling with specific error types
- [ ] No console.log statements
- [ ] Comments explain WHY, not WHAT

#### Security Checklist

- [ ] No secrets or credentials in code
- [ ] Input validation for all user inputs
- [ ] No use of eval() or Function constructor
- [ ] Dependencies are from trusted sources
- [ ] No security vulnerabilities in dependencies

### 3. Testing Requirements

All code must be thoroughly tested:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Check formatting
npm run format:check
```

#### Test Guidelines

- Write tests BEFORE implementing features (TDD preferred)
- Test both success and failure cases
- Include edge cases (null, undefined, empty values)
- Aim for >80% code coverage
- No test cheating (modifying tests to pass)

### 4. Commit Guidelines

We follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

Examples:

```bash
feat(commands): add support for ChatGPT CLI
fix(init): handle missing CLAUDE.md gracefully
docs(readme): update installation instructions
test(guardian): add edge case tests for PR reviews
```

### 5. Pull Request Process

1. **Update your branch:**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all quality checks:**

   ```bash
   npm run quality  # Runs lint and format check
   npm test         # Run all tests
   ```

3. **Create pull request:**
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changes you made and why
   - Include screenshots for UI changes
   - Add test results or coverage reports

4. **PR Template:**

   ```markdown
   ## Description

   Brief description of changes

   ## Type of Change

   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing

   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed

   ## Checklist

   - [ ] Code follows Guardian standards
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] No security vulnerabilities
   - [ ] No console.log statements
   ```

## Areas for Contribution

### 1. Guardian Instructions Enhancement

The Guardian prompt in `src/data/guardian-prompt.js` can always be improved:

- Add new quality checks
- Improve delegation patterns
- Enhance security validations
- Add industry-specific guidelines

### 2. New AI Assistant Support

Help us support more AI coding assistants:

- GitHub Copilot CLI
- Amazon CodeWhisperer
- Other AI coding tools

### 3. Additional Commands

Ideas for new commands:

- `proguardian lint` - Check existing code against Guardian standards
- `proguardian report` - Generate quality reports
- `proguardian config` - Customize Guardian behavior

### 4. Testing Improvements

- Add more edge case tests
- Improve test coverage
- Add integration tests
- Performance benchmarks

### 5. Documentation

- Improve examples
- Add video tutorials
- Translate to other languages
- Create Guardian best practices guide

## Release Process

1. Maintainers review and merge PRs
2. Version bumps follow semantic versioning
3. Automated CI/CD publishes to npm
4. GitHub releases include changelogs

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for general questions
- Check existing issues/discussions first

## Recognition

Contributors will be recognized in:

- GitHub contributors page
- Release notes for significant contributions
- Special mentions for exceptional work

Thank you for helping make AI coding assistants better! 🛡️
