# Frontend component Makefile fragment (consumed by root Makefile).
#
# Like the Rust fragment, this one does NOT swallow failures with `|| true`:
# lint, typecheck, test, and build are the gate -- a check that cannot fail is
# worse than no check, because it is reported as passing.
#
# `npm ci` is the lockfile-exact install (equivalent to cargo's `--locked`), so
# the gate runs against exactly the reviewed dependency set. It also fails when
# package-lock.json is missing or out of sync with package.json.
#
# The npm preflight warning ("skipped is not passed") mirrors the cargo one in
# backend/Makefile: a host without Node reports a skip so it is never mistaken
# for a pass.
.PHONY: check install
check:
	@if ! command -v npm >/dev/null 2>&1; then \
		echo "npm not found; skipping frontend checks (skipped is not passed)"; \
	elif [ ! -f package.json ]; then \
		echo "no package.json here yet -- frontend checks SKIPPED (skipped is not passed)"; \
	else \
		set -e; \
		npm ci --no-audit --no-fund; \
		npm run lint; \
		npm run typecheck; \
		npm test; \
		npm run build; \
	fi

install:
	npm ci
