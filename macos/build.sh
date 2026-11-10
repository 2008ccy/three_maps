#!/bin/bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
bundle="$root/地图卡片.app/Contents"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/map-cards-build.XXXXXX")"
mkdir -p "$scratch/MapCards.iconset" "$bundle/MacOS" "$bundle/Resources"
export CLANG_MODULE_CACHE_PATH="${TMPDIR:-/tmp}/three-maps-swift-cache"
xcrun swiftc -target arm64-apple-macos14.0 -O -parse-as-library \
  "$here/MapCards/CardLibrary.swift" "$here/MapCards/MapCardsApp.swift" -o "$scratch/MapCards"
xcrun swift "$here/MapCards/Icon.swift" "$scratch/MapCards.iconset"
iconutil -c icns "$scratch/MapCards.iconset" -o "$bundle/Resources/MapCards.icns"
install -m 755 "$scratch/MapCards" "$bundle/MacOS/MapCards"
install -m 644 "$here/MapCards/Info.plist" "$bundle/Info.plist"
codesign --force --sign - "$root/地图卡片.app"
codesign --verify --strict "$root/地图卡片.app"
printf '%s\n' "$root/地图卡片.app"
