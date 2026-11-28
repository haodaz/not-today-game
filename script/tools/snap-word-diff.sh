#!/bin/zsh
# Update the given tests' snapshots, then print only the changed words of each snapshot file
# (git word diff, one token per change) so a reviewer can see whether the change is exactly the
# intended markup. Usage: script/tools/snap-word-diff.sh tests/a.test.ts tests/b.test.ts
set -e
npx vitest run "$@" -u > /dev/null 2>&1 || true
for t in "$@"; do
  snap="tests/__snapshots__/$(basename "$t").snap"
  [ -f "$snap" ] || continue
  echo "== $snap"
  git diff --word-diff=porcelain --word-diff-regex='[^<>]+|<[^>]*>' -- "$snap" | grep -E '^[-+][^-+]' | sort | uniq -c
done
