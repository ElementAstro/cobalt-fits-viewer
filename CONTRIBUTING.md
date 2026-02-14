# Contributing to Cobalt FITS Viewer

Thank you for your interest in contributing! Here's how you can help.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally

```sh
git clone https://github.com/<your-username>/cobalt-fits-viewer.git
cd cobalt-fits-viewer
pnpm install
```

3. **Create a branch** for your changes

```sh
git checkout -b feat/my-feature
```

## Development

```sh
# Start the development server
pnpm start

# Run on specific platforms
pnpm ios
pnpm android
pnpm web
```

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — A new feature
- `fix:` — A bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, etc.)
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

## Pull Request Process

1. Ensure your code runs without errors on at least one platform
2. Update the README if you changed public APIs or project structure
3. Fill in the PR template completely
4. Request a review from a maintainer

## Reporting Issues

- Use the **Bug Report** template for bugs
- Use the **Feature Request** template for suggestions
- Search existing issues before creating a new one

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
