#!/bin/bash

# Ensure the icon directory exists
ICON_DIR="$HOME/.local/share/icons"
mkdir -p "$ICON_DIR"

# Copy the icon
ICON_PATH="$ICON_DIR/monacomeld-icon.svg"
cp "$(dirname "$0")/../public/favico.svg" "$ICON_PATH"

# Create desktop entry
DESKTOP_FILE="$HOME/.local/share/applications/monacomeld.desktop"
cat > "$DESKTOP_FILE" << EOL
[Desktop Entry]
Name=MonacoMeld
Exec=monacomeld %F
Terminal=false
Type=Application
Icon=$ICON_PATH
StartupWMClass=MonacoMeld
Comment=A lightweight diff viewer based on Monaco Editor
Categories=Development;Utility;TextEditor;
MimeType=text/plain;
EOL

chmod +x "$DESKTOP_FILE"
