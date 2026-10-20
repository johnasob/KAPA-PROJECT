#!/bin/sh
# CLI oficial fijada y verificada; evita instalar paquetes globales.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version=2.76.4
platform=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$(uname -m)" in x86_64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; *) echo 'Arquitectura no soportada' >&2; exit 1 ;; esac
dir="$root/.tools/supabase-$version"
if [ ! -x "$dir/supabase" ]; then
  mkdir -p "$dir"
  archive="supabase_${platform}_${arch}.tar.gz"
  base="https://github.com/supabase/cli/releases/download/v$version"
  curl --fail --silent --show-error --location --retry 2 "$base/supabase_${version}_checksums.txt" -o "$dir/checksums.txt"
  curl --fail --silent --show-error --location --retry 2 "$base/$archive" -o "$dir/$archive"
  (cd "$dir"; awk -v filename="$archive" '$2 == filename { print }' checksums.txt > selected.sha256; test -s selected.sha256; sha256sum -c selected.sha256; tar -xzf "$archive" supabase)
fi
# El registro público oficial de Docker está admitido por este entorno.
export SUPABASE_INTERNAL_IMAGE_REGISTRY="${SUPABASE_INTERNAL_IMAGE_REGISTRY:-docker.io}"
cd "$root"
exec "$dir/supabase" "$@"
