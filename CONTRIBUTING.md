# Contributing to Groundschool AI 🤝

Thank you for your interest in contributing to Groundschool AI! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ with npm
- Git for version control
- Expo CLI (`npm install -g @expo/cli`)
- Code editor (VS Code recommended)

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/Groundschool-AI.git`
3. Install dependencies: `npm install`
4. Set up environment variables (see [INSTALLATION.md](INSTALLATION.md))
5. Start development server: `npm start`

## 📋 How to Contribute

### Types of Contributions
- 🐛 **Bug Reports**: Help us identify and fix issues
- ✨ **Feature Requests**: Suggest new functionality
- 🔧 **Code Contributions**: Submit bug fixes or new features
- 📚 **Documentation**: Improve or add documentation
- 🧪 **Testing**: Add or improve test coverage
- 🎨 **UI/UX**: Enhance user interface and experience

### Contribution Process
1. **Check existing issues** to avoid duplicates
2. **Create an issue** to discuss major changes
3. **Fork and create a branch** for your contribution
4. **Make your changes** following our coding standards
5. **Test thoroughly** and add tests if needed
6. **Submit a pull request** with clear description

## 🏗️ Development Guidelines

### Code Style
- **JavaScript/TypeScript**: Follow ESLint configuration
- **React Native**: Use functional components with hooks
- **Naming**: Use camelCase for variables, PascalCase for components
- **Comments**: Document complex logic and public APIs
- **Formatting**: Use Prettier for consistent formatting

### Project Structure
```
src/
├── app/              # Expo Router pages and screens
├── components/       # Reusable UI components
├── contexts/         # React Context providers
├── services/         # API and business logic services
├── utils/            # Utility functions and helpers
├── theme/            # Theme configuration and styling
└── constants/        # Application constants
```

### Coding Standards
- Write self-documenting code with clear variable names
- Keep functions small and focused (single responsibility)
- Use TypeScript types where applicable
- Handle errors gracefully with user-friendly messages
- Follow React Native best practices for performance

## 🧪 Testing

### Test Requirements
- **Unit Tests**: Required for utility functions and services
- **Integration Tests**: Required for API interactions
- **Component Tests**: Required for complex UI components
- **E2E Tests**: Required for critical user flows

### Running Tests
```bash
npm test                # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e        # End-to-end tests
npm run test:watch      # Watch mode for development
```

### Test Coverage
- Maintain >80% coverage for critical business logic
- Test error conditions and edge cases
- Mock external dependencies appropriately
- Use descriptive test names and organize with `describe` blocks

## 📝 Documentation

### Documentation Requirements
- Update README.md for significant changes
- Document new APIs and functions
- Include code examples for complex features
- Update installation/setup guides if needed
- Add screenshots for UI changes

### Documentation Style
- Use clear, concise language
- Include practical examples
- Organize with proper headings and structure
- Keep documentation up-to-date with code changes

## 🐛 Bug Reports

### Before Reporting
- Check existing issues for duplicates
- Test on the latest version
- Gather relevant system information
- Create minimal reproduction steps

### Bug Report Template
```markdown
**Bug Description**
Clear description of the issue

**Steps to Reproduce**
1. Go to...
2. Click on...
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., iOS 17, Android 13, macOS 14]
- App Version: [e.g., 1.0.0]
- Device: [e.g., iPhone 15, Pixel 7]

**Screenshots**
If applicable, add screenshots

**Additional Context**
Any other relevant information
```

## ✨ Feature Requests

### Feature Request Template
```markdown
**Feature Description**
Clear description of the proposed feature

**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should this feature work?

**Alternatives Considered**
Other solutions you've considered

**Additional Context**
Mockups, examples, or references
```

## 🔄 Pull Request Process

### PR Requirements
- **Clear Title**: Descriptive title summarizing changes
- **Description**: Detailed explanation of changes and motivation
- **Testing**: Evidence that changes work as expected
- **Documentation**: Updated docs for user-facing changes
- **Code Quality**: Passes linting and follows style guidelines

### PR Template
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
- [ ] New tests added (if applicable)

## Screenshots (if applicable)
Before/after screenshots for UI changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No merge conflicts
```

### Review Process
1. **Automated Checks**: CI/CD pipeline must pass
2. **Code Review**: At least one maintainer review required
3. **Testing**: Manual testing for significant changes
4. **Documentation**: Verify docs are updated
5. **Approval**: Maintainer approval required for merge

## 🏷️ Commit Guidelines

### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```
feat(quiz): add multi-document quiz generation
fix(auth): resolve login session persistence issue
docs(readme): update installation instructions
test(quiz): add unit tests for quiz validation
```

## 🌟 Recognition

### Contributors
All contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Special mentions for major features or fixes

### Becoming a Maintainer
Regular contributors may be invited to become maintainers based on:
- Quality and consistency of contributions
- Understanding of the codebase
- Positive community interactions
- Commitment to the project's goals

## 📞 Getting Help

### Community Support
- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: Report bugs or request features
- **Email**: Contact selezmj@gmail.com for urgent matters

### Development Help
- **Code Questions**: Use GitHub Discussions
- **Architecture Decisions**: Create an issue for discussion
- **Feature Planning**: Reach out to maintainers

## 📄 License

By contributing to Groundschool AI, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You

Your contributions help make aviation education more accessible and effective. Every bug report, feature suggestion, and code contribution makes a difference!

---

*Together, we're transforming aviation education through AI* ✈️🤖
