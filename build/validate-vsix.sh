#!/bin/bash
#
# VSIX Validation Script
# Validates a VSIX package: size check and structure check
#
# Usage: ./validate-vsix.sh <path-to-vsix>
#
# Exit codes:
#   0 - Validation passed
#   1 - Validation failed
#   2 - File not found

set -e

VSIX_FILE="$1"
MAX_SIZE_MB=5
MAX_SIZE_BYTES=$((MAX_SIZE_MB * 1024 * 1024))

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$VSIX_FILE" ]; then
    echo -e "${RED}❌ Error: No VSIX file specified${NC}"
    echo "Usage: $0 <path-to-vsix>"
    exit 1
fi

if [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}❌ Error: VSIX file not found: $VSIX_FILE${NC}"
    exit 2
fi

echo "🔍 Validating VSIX: $VSIX_FILE"
echo ""

# ── Size check ──────────────────────────────────────
if command -v stat &> /dev/null; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        SIZE=$(stat -f%z "$VSIX_FILE")
    else
        SIZE=$(stat -c%s "$VSIX_FILE")
    fi

    SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc 2>/dev/null || echo "unknown")

    if [ "$SIZE" -gt "$MAX_SIZE_BYTES" ]; then
        echo -e "${YELLOW}⚠️  Warning: VSIX size (${SIZE_MB} MB) exceeds ${MAX_SIZE_MB} MB limit${NC}"
    else
        echo -e "${GREEN}✓ File size: ${SIZE_MB} MB (under ${MAX_SIZE_MB} MB limit)${NC}"
    fi
fi

# ── Structure check ─────────────────────────────────
echo ""
echo "📋 Checking VSIX structure..."

if command -v unzip &> /dev/null; then
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT

    unzip -q "$VSIX_FILE" -d "$TEMP_DIR" 2>/dev/null || {
        echo -e "${RED}❌ Failed to unzip VSIX${NC}"
        exit 1
    }

    if [ -f "$TEMP_DIR/extension/package.json" ]; then
        echo -e "${GREEN}✓ extension/package.json found${NC}"
    else
        echo -e "${RED}❌ Missing: extension/package.json${NC}"
        exit 1
    fi

    if [ -f "$TEMP_DIR/extension.vsixmanifest" ]; then
        echo -e "${GREEN}✓ extension.vsixmanifest found${NC}"
    else
        echo -e "${RED}❌ Missing: extension.vsixmanifest${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  unzip not found, skipping structure check${NC}"
fi

echo ""
echo -e "${GREEN}✅ VSIX validation passed${NC}"
