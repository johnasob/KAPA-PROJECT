#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
temporary=$(mktemp)
trap 'rm -f "$temporary"' EXIT HUP INT TERM
sh "$root/scripts/supabase.sh" gen types typescript --local > "$temporary"
test -s "$temporary"
node -e 'const fs=require("node:fs"); const p=process.argv[1]; fs.writeFileSync(p,fs.readFileSync(p,"utf8").trimEnd()+"\n");' "$temporary"
mv "$temporary" "$root/src/lib/database.types.ts"
