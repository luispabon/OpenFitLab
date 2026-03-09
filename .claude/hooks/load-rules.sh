#!/bin/bash
# Injected at session start — loads cursor rules and AGENTS.md into Claude's context.
# Output (stdout) is automatically added to Claude's conversation context.

cd "$(dirname "$0")/../.." || exit 0

echo "=== SESSION START: Loading project rules ==="
echo ""

if [ -f "AGENTS.md" ]; then
  echo "--- AGENTS.md ---"
  cat "AGENTS.md"
  echo ""
fi

for file in .cursor/rules/*.mdc; do
  if [ -f "$file" ]; then
    echo "--- $file ---"
    cat "$file"
    echo ""
  fi
done

echo "=== END project rules ==="
