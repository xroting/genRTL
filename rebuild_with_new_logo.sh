#!/usr/bin/env bash
set -ex

echo "=== Rebuilding genRTL with new logo ==="

# 1. Clean old build
echo "Step 1: Cleaning old build..."
rm -rf VSCode-win32-x64
rm -rf vscode

# 2. Convert logo to all needed formats
echo "Step 2: Converting logo to all formats..."
python convert_logo.py

# 3. Update SVG icons with black color (matching av_logo.png)
echo "Step 3: Creating black SVG icons..."
cat > icons/stable/codium_cnl.svg <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g fill="#000000">
    <!-- Based on av_logo.png: black triangular/diamond shape -->
    <polygon points="50,10 85,50 50,90 15,50"/>
  </g>
</svg>
EOF

cat > icons/stable/codium_clt.svg <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g fill="#000000">
    <polygon points="50,10 85,50 50,90 15,50"/>
  </g>
</svg>
EOF

# 4. Rebuild everything
echo "Step 4: Rebuilding genRTL..."
./build.sh

# 5. Update exe icon after build
echo "Step 5: Updating exe icon..."
node update_exe_icon.js

echo "=== Build complete! ==="
echo "The exe icon has been updated."
echo "NOTE: The Welcome page logo may still show the old icon because it's"
echo "compiled into the JavaScript code. To fix this, you would need to modify"
echo "the source code before compilation."
