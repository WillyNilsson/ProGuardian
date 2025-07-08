# ProGuardian CLI

[![CI Status](https://github.com/WillyNilsson/ProGuardian/workflows/CI/badge.svg)](https://github.com/WillyNilsson/ProGuardian/actions/workflows/ci.yml)
[![Coverage Status](https://codecov.io/gh/WillyNilsson/ProGuardian/branch/main/graph/badge.svg)](https://codecov.io/gh/WillyNilsson/ProGuardian)
[![npm version](https://badge.fury.io/js/@proguardian%2Fcli.svg)](https://www.npmjs.com/package/@proguardian/cli)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Security Scan](https://github.com/WillyNilsson/ProGuardian/workflows/Security/badge.svg)](https://github.com/WillyNilsson/ProGuardian/actions/workflows/security.yml)

A personal tool I built to enhance my workflow with AI coding assistants. While Claude Code and Gemini CLI are amazing tools, I encountered some recurring issues that led me to create ProGuardian as a quality assurance layer.

## Why I Built This

I love using AI coding assistants - they've transformed how I work. But I noticed patterns that were causing some tension:

- **Placeholder code**: `// TODO: implement this properly` appearing in "completed" features
- **Test cheating**: Tests that always pass, or tests weakened to match buggy code
- **Security oversights**: Hardcoded values, missing input validation, generic error handling
- **Shortcuts**: "Quick fixes" that become permanent technical debt
- **Incomplete work**: Code that technically runs but isn't production-ready

## What ProGuardian Does

ProGuardian adds a "Guardian Protocol" layer to your AI assistant that attempts to encourage a more methodical approach through a review-gate workflow:

```
Plan → Review → Implement → Review → Test → Review → Done
```

The idea is that each review gate should be completed before proceeding, with evidence like grep outputs and test results. Whether the AI actually follows this varies.

### Key Features

- **Works with existing tools**: Enhances your CLAUDE.md or GEMINI.md files
- **14-step workflow**: Structured approach designed to catch issues early
- **Evidence-based reviews**: Asks for grep outputs, test results, actual proof
- **Anti-placeholder stance**: Explicitly discourages TODOs and mock implementations
- **Test integrity focus**: Encourages fixing code rather than weakening tests

## Status: Work in Progress

This is an active project I'm continuously improving based on my own usage. It's not perfect or complete - I'm discovering edge cases and refining the approach as I use it daily. 

Current state:
- ✅ Core workflow implemented and tested
- ✅ Works with both Claude Code and Gemini CLI
- ✅ Published on npm for easy installation
- 🚧 Continuous refinements based on real usage
- 🚧 Adding new safety checks as I encounter issues

### Known Limitations

- **Compliance varies**: Sometimes the AI forgets or ignores the CLAUDE.md and GEMINI.md
- **Not foolproof**: Even with the protocol, issues can slip through
- **Context matters**: Works better for some tasks than others
- **Requires patience**: The review steps add time to the development process
- **Possibly increases cost**: More steps and longer .MD = more tokens.

## Installation

```bash
npm install -g @proguardian/cli
```

## Usage

### 1. Initialize Guardian in your project:
```bash
cd your-project
proguardian init
```

This enhances your existing CLAUDE.md or GEMINI.md file (or creates one if needed).

### 2. Optional: Install the wrapper
```bash
proguardian install-wrapper
```

This creates a wrapper that automatically enforces Guardian mode when `.proguardian` exists.

### 3. Use your AI assistant normally
```bash
claude "implement user authentication"
# or
gemini "add error handling to the API"
```

The AI should now follow the Guardian protocol - planning before coding, reviewing implementation, and running actual tests. In practice, you might need to remind it occasionally (is that the Guardian way?), as AIs don't always stick to their context files.

```

## Contributing

Since this is a personal tool I'm actively developing and using myself, I welcome feedback and contributions! If you encounter issues or have ideas for improvements:

- Open an issue describing what you encountered
- Share your use cases - I'm curious how others might use this
- PRs welcome, especially for edge cases I haven't encountered yet

## Technical Details

- **Node.js 20+** required

## License

Apache 2.0.

---

*ProGuardian is a personal project not affiliated with Anthropic (Claude) or Google (Gemini), though I would obviously love for that to change.*