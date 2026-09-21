#!/usr/bin/env bash
# raigal installer for macOS and Linux
# Usage: curl -fsSL https://raigal.dev/install.sh | sh
set -euo pipefail

BINARY_NAME="raigal"
DL_BASE="https://dl.raigal.dev/latest"

# ---------------------------------------------------------------------------
# Detect platform
# ---------------------------------------------------------------------------
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64)   PLATFORM="macos-arm64" ;;
      x86_64)  PLATFORM="macos-x64"   ;;
      *)
        echo "error: unsupported macOS architecture: $ARCH" >&2
        exit 1
        ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64)
        PLATFORM="linux-x64"
        ;;
      aarch64|arm64)
        echo "error: Linux ARM64 binary is not yet available." >&2
        echo "       Install via npm instead:  npm install -g raigal" >&2
        exit 1
        ;;
      *)
        echo "error: unsupported Linux architecture: $ARCH" >&2
        exit 1
        ;;
    esac
    ;;
  *)
    echo "error: unsupported OS: $OS" >&2
    echo "       On Windows run:  iwr https://raigal.dev/install.ps1 | iex" >&2
    exit 1
    ;;
esac

ASSET="${BINARY_NAME}-${PLATFORM}"
DOWNLOAD_URL="${DL_BASE}/${ASSET}"
CHECKSUM_URL="${DL_BASE}/checksums.txt"

# ---------------------------------------------------------------------------
# Choose install directory
# ---------------------------------------------------------------------------
if [ -w "/usr/local/bin" ]; then
  INSTALL_DIR="/usr/local/bin"
elif [ -d "$HOME/.local/bin" ]; then
  INSTALL_DIR="$HOME/.local/bin"
else
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
fi

INSTALL_PATH="${INSTALL_DIR}/${BINARY_NAME}"

# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading raigal (${PLATFORM})..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP/raigal"
  curl -fsSL "$CHECKSUM_URL" -o "$TMP/checksums.txt" 2>/dev/null || true
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TMP/raigal" "$DOWNLOAD_URL"
  wget -qO "$TMP/checksums.txt" "$CHECKSUM_URL" 2>/dev/null || true
else
  echo "error: curl or wget is required" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Verify checksum
# ---------------------------------------------------------------------------
if [ -f "$TMP/checksums.txt" ]; then
  EXPECTED="$(grep "$ASSET" "$TMP/checksums.txt" 2>/dev/null | awk '{print $1}' || true)"
  if [ -n "$EXPECTED" ]; then
    if command -v sha256sum >/dev/null 2>&1; then
      ACTUAL="$(sha256sum "$TMP/raigal" | awk '{print $1}')"
    elif command -v shasum >/dev/null 2>&1; then
      ACTUAL="$(shasum -a 256 "$TMP/raigal" | awk '{print $1}')"
    else
      ACTUAL=""
    fi

    if [ -n "$ACTUAL" ] && [ "$EXPECTED" != "$ACTUAL" ]; then
      echo "error: checksum mismatch" >&2
      echo "  expected: $EXPECTED" >&2
      echo "  got:      $ACTUAL" >&2
      exit 1
    fi
    [ -n "$ACTUAL" ] && echo "Checksum verified."
  fi
fi

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
chmod +x "$TMP/raigal"
mv "$TMP/raigal" "$INSTALL_PATH"

echo ""
echo "raigal installed to $INSTALL_PATH"

# Remind about PATH if we installed to ~/.local/bin
if [ "$INSTALL_DIR" = "$HOME/.local/bin" ]; then
  if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo ""
    echo "Add the following to your shell profile (~/.zshrc or ~/.bashrc):"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi
fi

echo ""
if "$INSTALL_PATH" --version >/dev/null 2>&1; then
  "$INSTALL_PATH" --version
  echo "Installation complete."
else
  echo "Binary installed. Run: raigal --version"
fi
