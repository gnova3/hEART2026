#!/bin/bash

# Navigate to the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data/raw"

echo "Downloading hEART 2026 program pages from EasyChair..."
echo "Saving to: $DATA_DIR"

# Create the data directory in the project
mkdir -p "$DATA_DIR"

echo "Fetching Sept 29th..."
curl -s -L -o "$DATA_DIR/heart29.html" "https://easychair.org/smart-program/hEART2026/2026-09-29.html"

echo "Fetching Sept 30th..."
curl -s -L -o "$DATA_DIR/heart30.html" "https://easychair.org/smart-program/hEART2026/2026-09-30.html"

echo "Fetching Oct 1st..."
curl -s -L -o "$DATA_DIR/heart01.html" "https://easychair.org/smart-program/hEART2026/2026-10-01.html"

echo "Fetching Keywords Index..."
curl -s -L -o "$DATA_DIR/heart_keywords.html" "https://easychair.org/smart-program/hEART2026/talk_keyword_index.html"

echo "--------------------------------------------------------"
echo "Done! The HTML files have been downloaded to the data/raw/ folder."
echo "You can now generate your updated papers.json by running:"
echo "python3 scripts/build_paper_data.py data/raw/heart29.html data/raw/heart30.html data/raw/heart01.html --keywords data/raw/heart_keywords.html"
