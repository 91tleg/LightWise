# Git Workflow Guide for LightWise

This document outlines the commit message conventions, pull request process, and branch strategy.

---

## Table of Contents

1. [Commit Message Template](#commit-message-template)
2. [Commit Message Guidelines](#commit-message-guidelines)
3. [Pull Request Process](#pull-request-process)
4. [Branch Strategy](#branch-strategy)
5. [Common Workflows](#common-workflows)

---

## Commit Message Template

### Template Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Full Example

```
feat(firmware): add motion sensor calibration routine

Implement automatic calibration for PIR motion sensor during startup.
- Samples ambient light for 30 seconds to establish baseline
- Adjusts sensitivity threshold based on environmental conditions
- Logs calibration results to EEPROM for persistence

Fixes #42
Closes #45
Related-to: #67
```

---

## Commit Message Guidelines

### Type

Must be one of the following:

| Type | Description | Example |
|------|-------------|---------|
| **feat** | A new feature | `feat(api): add telemetry query filters` |
| **fix** | A bug fix | `fix(firmware): correct I2C sensor timeout` |
| **docs** | Documentation only | `docs(readme): update setup instructions` |
| **style** | Code style changes (formatting, missing semicolons, etc.) | `style(backend): format lambda function` |
| **refactor** | Code refactoring without feature changes | `refactor(frontend): extract sensor card component` |
| **perf** | Performance improvements | `perf(dynamodb): add query indexes` |
| **test** | Adding or updating tests | `test(api): add validation test cases` |
| **chore** | Build, dependencies, CI/CD changes | `chore(deps): upgrade aws-sdk to 3.x` |
| **ci** | CI/CD configuration changes | `ci(github-actions): add linting job` |
| **build** | Build system or build artifact changes | `build(webpack): optimize bundle size` |

### Scope

The scope provides additional contextual information:
- The scope is **optional**

**Examples**:
- `firmware` — ESP32 firmware code
- `api` — Cloud API endpoints
- `dynamodb` — Database schema/queries
- `frontend` — React dashboard
- `deployment` — AWS infrastructure
- `backend` — Lambda functions

**Guideline**: Use lowercase, no spaces.

### Subject

- **Max 50 characters**
- Use imperative mood: "add" not "added" or "adds"
- No period (.) at the end
- Clear and descriptive
- Specific enough to understand change at a glance

**Good Examples**:
- `add motion sensor calibration routine`
- `fix race condition in telemetry ingest`
- `update DynamoDB table schema`

**Bad Examples**:
- `update stuff` (too vague)
- `fixed bug.` (past tense + period)
- `This commit adds a new feature to the API that allows querying historical data` (too long)

### Body

The body should include the motivation for the change and contrast this with previous behavior:

- The body is **optional**
- Use the imperative, present tense: "change" not "changed" nor "changes"
- **Why** was this change needed? (motivation)
- **What** changes were made? (implementation details)
- **How** does it work? (technical approach)
- **What** are the side effects or breaking changes?

**Guidelines**:
- Wrap at 72 characters
- Separate from subject with a blank line
- Use bullet points for multiple changes
- Reference related issues with `Fixes #123` or `Related-to #456`
- Explain the "why", not the "what" (code shows the what)

**Example**:
```
feat(firmware): implement adaptive brightness control

Add dynamic brightness adjustment based on motion detection and ambient
light levels. When motion is detected, increase brightness to 80%. When
no motion for 3 minutes, reduce to 40%.

Changes:
- Added motion_timeout timer in firmware config
- Calculate brightness as: base_level * (ambient_lux / 100)
- Store last_motion_time in RTC memory for persistence across sleep
- Added calibration routine during startup

This reduces power consumption by ~30% during off-peak hours while
maintaining safety during active periods.

Fixes #67
```

### Footer

Metadata about the commit:

- **Fixes #123** — Closes issue automatically when merged to main
- **Closes #123** — Same as Fixes
- **Related-to #123** — Link without auto-closing
- **Breaking change: description** — Document any breaking changes

**Example**:
```
Fixes #42
Related-to #45, #89
Breaking change: Changed POST /telemetry response format
```

### Commit Message Checklist

Before committing, verify:

- [ ] Type is correct (feat, fix, docs, etc.)
- [ ] Scope is specific and lowercase
- [ ] Subject is 50 characters or less
- [ ] Subject is imperative mood
- [ ] Subject has no period
- [ ] Body explains the "why" and "how"
- [ ] Body is wrapped at 72 characters
- [ ] Footer references issues correctly
- [ ] No sensitive information (passwords, keys, tokens)

---

## Pull Request Process

### 1. Create Feature Branch

Create a branch from `dev`:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/short-description
```

**Branch naming convention**:

- Lowercase: Don't use uppercase letters in the branch name, stick to lowercase
- Hyphen separated: If your branch name consists of more than one word, separate them with a hyphen. following **kebab-case** convention.
- (a-z, 0-9): Use only alphanumeric characters and hyphens in your branch name. Avoid any non-alphanumeric character.
- Please, don't use continuous hyphens (--). This practice can be confusing. For example, if you have branch types (such as a feature, fix, etc.), use a slash (/) instead.
- Avoid ending your branch name with a hyphen. It does not make sense because a hyphen separates words, and there's no word to separate at the end.
- This practice is the most important: Use descriptive, concise, and clear names that explain what was done on the branch.

```
feature/<description>     # New features
fix/<description>         # Bug fixes
docs/<description>        # Documentation
refactor/<description>    # Code refactoring
perf/<description>        # Performance improvements
```

**Wrong branch names**:
- `fixSidebar`
- `feature-new-sidebar-`
- `FeatureNewSidebar`
- `feat_add_sidebar`

**Good branch names**
- `feature/new-sidebar`
- `fix/interval-query-param-on-get-historical-data`

### 2. Make Changes

Commit changes following the [Commit Message Guidelines](#commit-message-guidelines):

```bash
git add .
git commit
# Editor opens with template
```

**Commit frequently** with logical, atomic changes:
- One feature per commit (or logical part of feature)
- Commits that compile/pass tests independently
- Don't mix multiple features in one commit
- Don't fix style issues in feature commits

### 3. Push to Remote

```bash
git push origin feature/short-description
```

### 4. Open Pull Request

On GitHub, create a PR with:

#### PR Title
Follow the same format as commit messages:
```
feat(firmware): add motion sensor calibration routine
```

#### PR Description Template

```markdown
## Description
Brief summary of what this PR does and why.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Changes Made
- Change 1
- Change 2
- Change 3

## Related Issues
Fixes #42
Related to #45

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing tests pass locally with my changes

## Screenshots (if applicable)
Add screenshots for UI changes.

## Notes
Any additional notes for reviewers.
```

### 5. Code Review

**As Author**:
- Be responsive to feedback
- Make requested changes in new commits (don't force push)
- Mark conversations as resolved only after making changes
- Request re-review after making changes

**As Reviewer**:
- Review within 24 hours when possible
- Be constructive and specific
- Approve only if high confidence in quality
- Check for:
  - Code quality and style
  - Test coverage
  - Documentation
  - No breaking changes without discussion
  - Performance implications

### 6. Merge to Dev

Once approved:

```bash
# Ensure your branch is up-to-date
git fetch origin
git rebase origin/dev

# Merge to dev (use "Squash and merge" for small commits)
# or "Create a merge commit" for feature branches
```

**Merge options**:
- **Squash and merge**: For small commits → single clean commit
- **Create a merge commit**: For feature branches → preserves history
- **Rebase and merge**: Keep linear history (use sparingly)

### 7. Delete Branch

After merging:

```bash
# Delete local branch
git branch -d feature/short-description

# Delete remote branch
git push origin --delete feature/short-description
# Or delete using github gui
```

---

## Branch Strategy

### Branch Structure

```
main (production)
  ↑
  └── Release PRs only
      
dev (development)
  ↑
  ├── feature/motion-sensor-calibration
  ├── fix/telemetry-validation-error
  ├── docs/api-contract-updates
  └── refactor/firmware-modules
```

### Branch Rules

#### `main` (Production)
- **Protection**: Yes
- **Merge from**: `dev` only via PR
- **Testing**: All tests must pass
- **Review**: At least 1 approvals required
- **Status checks**: Must pass CI/CD pipeline
- **Force push**: Disabled
- **Purpose**: Stable, production-ready code

#### `dev` (Development)
- **Protection**: Yes
- **Merge from**: Feature branches via PR
- **Testing**: All tests must pass
- **Review**: At least 1 approval required
- **Status checks**: Must pass CI/CD pipeline
- **Force push**: Disabled
- **Purpose**: Integration branch for upcoming release

#### Feature/Fix/Docs Branches
- **Source**: `dev`
- **Naming**: `feature/`, `fix/`, `docs/`, `refactor/`, `perf/`
- **Lifespan**: Short-lived (< 1 week ideally)
- **Protection**: No
- **Purpose**: Isolated development for single feature/fix

### Branch Lifecycle

```
1. Create from dev
   git checkout dev && git pull origin dev
   git checkout -b feature/description

2. Make commits
   git commit (following template)

3. Push and open PR
   git push origin feature/description
   # Create PR on GitHub

4. Code review
   Address feedback, push new commits

5. Merge to dev
   GitHub: Use "Squash and merge" or "Create a merge commit"

6. Cleanup
   Delete local and remote branches(Do NOT delete dev branch)

7. Later: Release to main
   Create release PR: dev → main
   Tag version after merge
```

---

## Common Workflows

### Starting a New Feature

```bash
# Ensure you're on latest dev
git checkout dev
git pull origin dev

# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
git add .
git commit

# Push to remote
git push origin feature/your-feature-name

# Open PR on GitHub
```

### Updating Feature Branch with Latest Dev

If `dev` has changes since you started:

```bash
# Option 1: Rebase (preferred for clean history)
git fetch origin
git rebase origin/dev

# Option 2: Merge (if rebase conflicts are complex)
git fetch origin
git merge origin/dev
```

### Fixing Mistakes in Commits

**Amend last commit** (before pushing):
```bash
git add .
git commit --amend
```

**Revert entire commit** (after pushing):
```bash
git revert <commit-hash>
```

**Reset to previous commit** (dangerous - use with caution):
```bash
git reset --hard <commit-hash>
git push -f origin branch-name
```

### Syncing with Main Branch

Periodically ensure `dev` is updated with `main`:

```bash
git checkout main
git pull origin main

git checkout dev
git merge main

git push origin dev
```

---

## Code Quality Standards

### Before Committing

1. **Run tests locally**
2. **Check linting**
3. **Format code**
4. **No debug code**

### In Pull Request

GitHub Actions will automatically:
- Run all tests
- Check code coverage
- Lint code style
- Build project

**PR will be blocked if**:
- Tests fail
- Linting errors present
- Code coverage drops below threshold (80%)
- Build fails

---

## Troubleshooting

### "My PR has conflicts"

```bash
git fetch origin
git rebase origin/dev

# Fix conflicts in your editor
git add .
git rebase --continue
git push origin feature/name --force-with-lease
```

### "I committed to the wrong branch"

```bash
# If not pushed yet
git reset HEAD~1           # Undo last commit
git checkout -b feature/correct-branch
git commit                 # Recommit

# If already pushed
git checkout feature/correct-branch
git merge original-branch
git checkout original-branch
git reset --hard origin/original-branch
```

### "I need to go back to a previous version"

```bash
# See commit history
git log --oneline

# Create new branch from old commit
git checkout -b feature/new-branch <commit-hash>

# Or reset current branch (destructive)
git reset --hard <commit-hash>
git push origin branch-name --force-with-lease
```

---

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Book: Branching Workflows](https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows)
- [GitHub Flow Guide](https://guides.github.com/introduction/flow/)
- [Semantic Versioning](https://semver.org/)

---

**Document Version**: 0.1  
**Last Updated**: January 24, 2026  
