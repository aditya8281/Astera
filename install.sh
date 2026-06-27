#!/usr/bin/env bash
set -euo pipefail

# Astera installer — builds release binary and installs to ~/.cargo/bin

INSTALL_DIR="${INSTALL_DIR:-$HOME/.cargo/bin}"
BINARY_NAME="astera"

echo "Building Astera release binary..."
cargo build --release

echo "Installing to $INSTALL_DIR/$BINARY_NAME"
mkdir -p "$INSTALL_DIR"
cp "target/release/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo "Done! Run 'astera --version' to verify."
echo ""
echo "Make sure $INSTALL_DIR is in your PATH:"
echo "  export PATH=\"\$HOME/.cargo/bin:\$PATH\""
