#!/usr/bin/env bash
# Builds build/outputs/archive.snplg without Android Studio or Gradle.
#
# Steps: Metro JS bundle -> javac + dex for the small file
# module -> PluginConfig.json -> zip as .snplg.
#
# Needs: Node 18+, a JDK (javac, jar), zip. If ANDROID_HOME points to an
# Android SDK, its android.jar and d8 are used. Otherwise the script fetches
# android.jar (API 30) and the dx dexer (dex2jar 2.4) from GitHub once and
# caches them in tools/.cache.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NAME="archive"
GEN="$ROOT/build/generated"
OUT="$ROOT/build/outputs"
NAT="$ROOT/build/native"
CACHE="$ROOT/tools/.cache"

say() { printf '\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

command -v node >/dev/null || die "Node.js is required"
command -v javac >/dev/null || die "A JDK (javac) is required"
command -v jar >/dev/null || die "The JDK 'jar' tool is required"
command -v zip >/dev/null || die "zip is required"

rm -rf "$ROOT/build"
mkdir -p "$GEN" "$OUT" "$NAT" "$CACHE"

if [[ ! -d node_modules ]]; then
  say "Installing npm dependencies"
  npm install --no-audit --no-fund
fi

say "Bundling JavaScript (Metro)"
CI=1 npx react-native bundle --entry-file index.js --platform android --dev false \
  --bundle-output "$GEN/$NAME.bundle" --assets-dest "$GEN" >/dev/null

# ---------------------------------------------------------------- native
say "Compiling the native file module"
ANDROID_JAR=""
D8=""
if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME/platforms" ]]; then
  ANDROID_JAR="$(ls -d "$ANDROID_HOME"/platforms/android-*/android.jar 2>/dev/null | sort -V | tail -n1 || true)"
  D8="$(ls -d "$ANDROID_HOME"/build-tools/*/d8 2>/dev/null | sort -V | tail -n1 || true)"
fi
if [[ -z "$ANDROID_JAR" ]]; then
  ANDROID_JAR="$CACHE/android-30.jar"
  if [[ ! -s "$ANDROID_JAR" ]]; then
    say "Fetching android.jar (API 30)"
    curl -fsSL -o "$ANDROID_JAR" https://raw.githubusercontent.com/Sable/android-platforms/master/android-30/android.jar
  fi
fi
DX_JAR=""
if [[ -z "$D8" ]]; then
  DX_JAR="$(ls "$CACHE"/dex-tools-v2.4/lib/dx-*.jar 2>/dev/null | head -n1 || true)"
  if [[ -z "$DX_JAR" ]]; then
    say "Fetching the dx dexer (dex2jar 2.4)"
    curl -fsSL -o "$CACHE/dex-tools.zip" https://github.com/pxb1988/dex2jar/releases/download/v2.4/dex-tools-v2.4.zip
    (cd "$CACHE" && unzip -q -o dex-tools.zip)
    DX_JAR="$(ls "$CACHE"/dex-tools-v2.4/lib/dx-*.jar | head -n1)"
  fi
fi

SRC_DIR="android/app/src/main/java/com/archive/files"
mkdir -p "$NAT/classes" "$NAT/dex"
javac -nowarn -source 8 -target 8 -encoding UTF-8 \
  -bootclasspath "$ANDROID_JAR" -cp "tools/native-stubs" \
  -sourcepath "tools/native-stubs" -implicit:none \
  -d "$NAT/classes" "$SRC_DIR"/*.java 2>&1 | grep -v "Picked up JAVA_TOOL_OPTIONS" | grep -v "^warning: \[options\]" | grep -v "^[0-9]* warning" || true
[[ -f "$NAT/classes/com/archive/files/ArchiveFilesPackage.class" ]] || die "javac failed"
# Package only our classes; the React Native classes come from PluginHost.
(cd "$NAT/classes" && jar cf "$NAT/archive-files.jar" com/archive 2>&1 | grep -v "Picked up JAVA_TOOL_OPTIONS" || true)

if [[ -n "$D8" ]]; then
  "$D8" --release --min-api 26 --lib "$ANDROID_JAR" --classpath "tools/native-stubs" --output "$NAT/dex" "$NAT/archive-files.jar"
else
  java -cp "$DX_JAR" com.android.dx.command.Main --dex --min-sdk-version=26 --output="$NAT/dex/classes.dex" "$NAT/archive-files.jar" 2>&1 | grep -v "Picked up JAVA_TOOL_OPTIONS" || true
fi
[[ -s "$NAT/dex/classes.dex" ]] || die "dexing failed"
rm -f "$GEN/app.npk"
(cd "$NAT/dex" && zip -q -X "$GEN/app.npk" classes.dex)

# ---------------------------------------------------------------- config
say "Writing PluginConfig.json"
cp "assets/plugin-icon.png" "$GEN/plugin-icon.png"
node -e '
const fs = require("fs");
const cfg = JSON.parse(fs.readFileSync("PluginConfig.json", "utf8"));
cfg.iconPath = "/plugin-icon.png";
cfg.nativeCodePackage = "/app.npk";
cfg.reactPackages = ["com.archive.files.ArchiveFilesPackage"];
fs.writeFileSync(process.argv[1], JSON.stringify(cfg, null, 2));
' "$GEN/PluginConfig.json"

# ---------------------------------------------------------------- package
say "Packaging"
(cd "$GEN" && zip -q -r -X "$OUT/$NAME.zip" .)
cp "$OUT/$NAME.zip" "$OUT/$NAME.snplg"
rm -f "$OUT/$NAME.zip"

say "Done: build/outputs/$NAME.snplg"
unzip -l "$OUT/$NAME.snplg"
