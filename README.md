# ProGuardian CLI

[![CI Status](https://github.com/WillyNilsson/ProGuardian/workflows/CI/badge.svg)](https://github.com/WillyNilsson/ProGuardian/actions/workflows/ci.yml)
[![Coverage Status](https://codecov.io/gh/WillyNilsson/ProGuardian/branch/main/graph/badge.svg)](https://codecov.io/gh/WillyNilsson/ProGuardian)
[![npm version](https://badge.fury.io/js/@proguardian%2Fcli.svg)](https://www.npmjs.com/package/@proguardian/cli)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Security Scan](https://github.com/WillyNilsson/ProGuardian/workflows/Security/badge.svg)](https://github.com/WillyNilsson/ProGuardian/actions/workflows/security.yml)

Guardian 2.0 supervision for AI coding assistants. Ensures code quality, security, and best practices by transforming your AI assistant into a senior engineer who writes code with rigorous self-review.

## Why Does ProGuardian Exist?

Modern AI coding assistants are incredibly powerful, but they have a fundamental limitation: their primary goal is **task completion**. This can lead them to take shortcuts, introduce subtle bugs, "cheat" on tests to make them pass, or write code that is functional but not maintainable or secure.

ProGuardian addresses this by fundamentally reframing the AI's role. Instead of a developer focused on just getting the code written, the AI becomes a **Senior Engineer (Guardian)** whose primary goal is **code quality through direct implementation with rigorous self-review**.

### Guardian 2.0: A Better Approach

The original Guardian protocol relied on delegation to subagents, which introduced accuracy problems due to context loss. Guardian 2.0 takes a different approach:

- **Direct Implementation**: Senior engineers write critical code themselves
- **Mechanical Self-Review**: Enforced review steps that require actual re-reading of code
- **Safety Rails**: Protection against deletions, scope creep, and other disasters
- **Penalties**: Real consequences for violations to reinforce proper behavior

This psychological shift is the key. By making the AI responsible for both implementation AND review, with mechanical steps that can't be skipped, we ensure higher quality outcomes.

## How It Works

ProGuardian **enhances** your existing `CLAUDE.md` or `GEMINI.md` by adding the Guardian 2.0 protocol that:

1.  Preserves your AI CLI's project understanding
2.  Adds the Senior Engineer identity with direct implementation responsibility
3.  Implements mechanical review steps that can't be skipped
4.  Adds safety rails to prevent common disasters
5.  Maintains all your project-specific context

Your enhanced file will look like:

```markdown
# Original project context from claude init

[Project structure, dependencies, conventions...]

## 🛡️ GUARDIAN MODE ACTIVE

# GUARDIAN 2.0 - Senior Engineer Protocol

[Critical safety rails, mechanical review steps, penalties...]
```

## Key Features

### Guardian 2.0 Safety Rails

- 🛡️ **Deletion Protection**: Prevents unauthorized file/code deletion
- 🛡️ **Scope Validation**: Ensures changes match what was requested
- 🛡️ **Existing Code Check**: Prevents duplicate implementations
- 🛡️ **Mechanical Review**: Forces actual re-reading of changes

### Prevents Common AI Issues

- ❌ No more test cheating (modifying tests to pass)
- ❌ No placeholder code or TODOs
- ❌ No shortcuts or quick fixes
- ❌ No exposed secrets or security vulnerabilities
- ❌ No scope creep or unwanted "improvements"
- ❌ No skipping review steps

### Enforces Best Practices

- ✅ Comprehensive error handling
- ✅ Security-first approach
- ✅ Performance optimization
- ✅ Proper testing strategies
- ✅ Clean, maintainable code
- ✅ Production-ready implementations
- ✅ Automatic issue fixes during review

## Installation

```bash
npm install -g @proguardian/cli
```

## Quick Start

1.  **First, let your AI CLI analyze your project:**

    ```bash
    cd your-project
    claude init   # Creates CLAUDE.md with project understanding
    # OR
    gemini init   # Creates GEMINI.md with project understanding
    ```

2.  **Then add Guardian supervision:**

    ```bash
    proguardian init   # Auto-detects and enhances the appropriate file
    ```

3.  **Start coding with Guardian protection:**
    ```bash
    claude  # or gemini
    ```

## About the Author

Hi I'm, **Willy Nilsson**, ([willynilsson.com](https://willynilsson.com)).

I'm a builder and researcher focused on the practical application and deeper understanding of AI. And I'm open4work.
Some of my other projects include:

- **[AISReact.com](https://aisreact.com)**: A benchmark that hopes to evaluate different AI models not on performance, but on their inherent biases and worldviews.
- **DeepOptimizer**: A tool that checks your code against published AI-techniques to identify potential improvements.

## License

Apache License 2.0

## Contributing

Contributions are welcome!
