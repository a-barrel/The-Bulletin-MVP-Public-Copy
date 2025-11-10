#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: scripts/process-seed-images.sh [--start-index N] [--cleanup] <source_dir> <category>

Converts every image in <source_dir> to a centered 512x512 JPG and writes it into
server/uploads/images/<category>/ as <category>-NN.jpg. Categories should be one of:
  background | discussion | event

Options:
  --start-index N   Override the next sequence number (default = highest existing file + 1)
  --cleanup         Delete the original file after it has been converted
USAGE
}

START_INDEX=""
CLEANUP=false

POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --start-index)
      START_INDEX="$2"
      shift 2
      ;;
    --cleanup)
      CLEANUP=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [[ ${#POSITIONAL[@]} -ne 2 ]]; then
  usage >&2
  exit 1
fi

SOURCE_DIR="${POSITIONAL[0]}"
CATEGORY="${POSITIONAL[1]}"

case "$CATEGORY" in
  background|discussion|event) ;;
  *)
    echo "Category must be background, discussion, or event (got '$CATEGORY')." >&2
    exit 1
    ;;
esac

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory '$SOURCE_DIR' does not exist." >&2
  exit 1
fi

if ! command -v convert >/dev/null 2>&1; then
  echo "ImageMagick 'convert' is required for this script." >&2
  exit 1
fi

TARGET_DIR="server/uploads/images/$CATEGORY"
mkdir -p "$TARGET_DIR"

if [[ -z "$START_INDEX" ]]; then
  LAST=$(ls "$TARGET_DIR" 2>/dev/null | grep -E "^${CATEGORY}-[0-9]+\.jpg$" | sed -E "s/${CATEGORY}-([0-9]+)\.jpg/\1/" | sort -n | tail -n1)
  if [[ -z "$LAST" ]]; then
    LAST=0
  fi
  START_INDEX=$((LAST + 1))
else
  if ! [[ "$START_INDEX" =~ ^[0-9]+$ ]]; then
    echo "--start-index must be numeric." >&2
    exit 1
  fi
fi

mapfile -d '' FILES < <(find "$SOURCE_DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.heic' \) -print0 | sort -z)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No image files found in $SOURCE_DIR" >&2
  exit 1
fi

INDEX=$START_INDEX
for FILE in "${FILES[@]}"; do
  [[ -z "$FILE" ]] && continue
  PADDED=$(printf "%02d" "$INDEX")
  DEST="$TARGET_DIR/${CATEGORY}-$PADDED.jpg"
  echo "[$CATEGORY] $(basename "$FILE") -> $(basename "$DEST")"
  convert "$FILE" -auto-orient -resize 512x512^ -gravity center -extent 512x512 -quality 85 "$DEST"
  if $CLEANUP; then
    rm -f "$FILE"
  fi
  INDEX=$((INDEX + 1))
done

printf "Converted %d asset(s) into %s\n" $((INDEX - START_INDEX)) "$TARGET_DIR"
