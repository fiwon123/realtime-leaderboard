# Development Workflow Prompt

You are the primary AI agent for `realtime-leaderboard`. Drive development work
using this workflow. Every change is tracked end-to-end on GitHub:
**issue → branch → PR → merge**, with the issue and PR assigned, labeled, linked,
and commented at each milestone.

## 1. Plan and understand

- Understand the requirement; ask clarifying questions if ambiguous.
- Explore the codebase (read relevant files, follow existing patterns).
- **Create or understand the GitHub issue**: ensure it exists, is assigned
  (`--assignee fiwon123`), labeled per commit type, has a milestone (current
  active milestone, e.g. `v0.1-MVP`), and post a "Starting work on this —
  Milestone: <milestone-name>" comment.
- Output: Goal, Files to modify, Dependencies, Risks, Steps. Get user approval
  before proceeding to implementation.

## 2. Branch

- Always start from an up-to-date `dev`:

```bash
git checkout dev
git pull origin dev
git checkout -b <type>/<issue-number>-<slug>
```

- Branch types: `feat/`, `fix/`, `refactor/`, `docs/`, `test/`, `chore/`, `ci/`
- Examples: `feat/4-score-ingest`, `fix/9-rank-tiebreak`, `refactor/12-claim-transaction`

## 3. Implement

- Make small, focused commits with conventional commits: `feat:`, `fix:`,
  `refactor:`, `docs:`, `test:`, `chore:`, `ci:`
- Rust specifics: run `cargo fmt` on changed files, keep `clippy` clean (warnings
  denied), and prefer `#[tokio::test]` for async tests.
- Keep score ingest idempotent — an event carries an id, and at-least-once
  delivery means the same event may arrive more than once.
- Do NOT create issues/PRs from subagents — that responsibility stays with the
  primary agent.

## 4. Test

- Run the local gate: `make check` (fmt + clippy + test + build).
  **Until `backend/Cargo.toml` exists the Rust steps are skipped — a skipped run
  is not a passed run**, so scaffolding changes are verified by review, not by
  `make`.
- Unit tests must not require Postgres or Redis. Integration tests that need them
  run against the compose `db`/`redis` services (`docker compose up -d db redis`).
- CI does not run on feature branches — local testing is your gate.
- If using the dev sandbox: `make dev-up`, `make shell`, `make opencode` as
  appropriate.

## 5. Push & PR

```bash
git push origin <branch>
gh pr create --base dev --title "<type>: <description>" \
  --body "Closes #<issue-number>" --label <label> --assignee fiwon123 \
  --milestone "<milestone-name>"
```

- Label per commit type: `feat` → `enhancement`, `fix` → `bug`, `chore` → `chore`,
  `refactor` → `refactor`, `docs` → `documentation`, `test` → `test`, `ci` → `ci`.
- Fill out the PR template completely; link the issue with `Closes #<issue-number>`.
- Comment on the issue: `PR opened: #<pr-number>`.

## 6. Review & Merge

- Self-review the diff for bugs, security, and regressions.
- Merge only when explicitly instructed; prefer squash merge, then delete the branch:

```bash
gh pr merge <pr-number> --squash --delete-branch
```

- After merging to `dev`:
  - Comment on the issue: `Merged into dev — ready for release`
  - Comment on the PR: `Merged into dev — thanks!`
  - **Close the issue explicitly**: `gh issue close <issue-number>`.
    `Closes #N` only auto-closes on the repository's default branch (`main`);
    a feature PR merges into `dev`, so without this step issues stay open forever.
- Always return to `dev` after the merge:
  `git checkout dev && git pull origin dev`

## 7. Release (dev → main) — user-initiated

- Never create a release PR or merge to `main` on your own. The user must
  explicitly ask ("Can we merge dev to main?").
- Create the release PR `dev` → `main` with label `release`. CI runs on this PR.
- This PR closes no issues — all milestone issues were closed at step 6.
- Never pass `--delete-branch` to a release merge: the head branch is `dev`
  itself, so `--delete-branch` deletes the integration branch.
- After CI passes, ask the user to confirm the merge; then merge `main` back
  into `dev` and verify `dev` survived:
  `git ls-remote --heads origin dev` (must print a line).

## 8. Cleanup

- Return to `dev`, pull, prune:

```bash
git checkout dev
git pull origin dev
git remote prune origin
```

## Important

- **Skipped is not passed.** A triggered run whose jobs were all gated out, or a
  run that never happened, is not coverage. Do not describe a change as "CI
  passed" unless a run actually executed the job that covers it; if it did not,
  say the change is unverified and test it locally.
- Configuration-only until the first feature issue: the scaffold ships first, and
  `make check` skips the Rust steps until `backend/Cargo.toml` exists.
- The dev sandbox has no Docker socket — `docker`/`docker compose` fail inside it.
  The container reaches Postgres and Redis by service name (`db`, `redis`).
- Never commit secrets. `DATABASE_URL`, `REDIS_URL`, and any tokens come from the
  environment; `.env` is gitignored and `.sqlx/` is deliberately committed.
