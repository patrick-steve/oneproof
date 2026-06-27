#!/usr/bin/env bash
# Strip CR from shell scripts inside vendored submodules.
#
# Why: submodules have their own git context, so the repo-root .gitattributes
# does not apply to them. On Windows + autocrlf=true, `git submodule update`
# will check out vendor/.../*.sh with CRLF endings, which breaks
# `#!/usr/bin/env bash` shebangs under WSL with:
#   env: $'bash\r': No such file or directory
#
# Re-run this after every `git submodule update --init --recursive`.
# Idempotent — safe to run when no CRLFs are present.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/vendor"

if [ ! -d "$VENDOR" ]; then
  echo "no vendor/ — nothing to do"
  exit 0
fi

count=0
while IFS= read -r -d '' f; do
  if grep -q $'\r' "$f"; then
    sed -i 's/\r$//' "$f"
    count=$((count + 1))
  fi
done < <(find "$VENDOR" -type f \( -name '*.sh' -o -name '*.bash' \) -print0)

echo "normalize-vendor-lf: stripped CR from $count file(s) under vendor/"
