# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2024-12-09

### Added

- Helpful command examples in README for common ProGuardian prompts
- Quick copy-paste commands for enforcing Guardian protocol
- Common scenario examples for real-world usage
- Version check utility for update notifications (like Claude Code)
- Automated npm publishing workflow for GitHub releases

### Fixed

- Version check duplicate notification bug
- Path traversal security error when running from different directories
- Linting errors in version-check.js and install-wrapper.js
- Test failures in version-check tests due to logger output handling

### Changed

- Enhanced npm-GitHub integration with bugs and homepage fields
- Improved version check logic to prevent showing same notification twice
- Removed "Functions under 20 lines" restriction from Guardian protocol
- Added "NEVER make unasked changes" warning to Guardian protocol

## [0.3.0] - 2024-12-08

### Changed

- **BREAKING**: Completely restructured Guardian protocol templates
  - Reduced from ~567 lines to ~118 lines (75% reduction)
  - New ROLE/GOAL/FORMAT/WARNINGS/CONTEXT structure
  - Removed heavy roleplay elements while keeping Senior Engineer framing
  - Maintained all 14 steps with review gates
- Updated README with more honest tone about limitations
- Added cost consideration warning (more steps = more tokens)
- Improved wrapper system prompt injection

### Added

- Known Limitations section in README
- System prompt injection in both claude-wrapper and gemini-wrapper
- Support for both ROLE and GOAL ordering in templates

### Fixed

- Test failures in install-wrapper coverage tests
- Consistent formatting across all template files

## [0.2.1] - Previous

### Added

- Multi-CLI support (Claude and Gemini)
- Guardian 2.0 protocol
- Comprehensive test suite with 100% coverage
- Security protections against path traversal and command injection

## [0.1.0] - Initial Release

### Added

- Basic Guardian protocol implementation
- Support for Claude CLI
- Core commands: init, check, install-wrapper
