#!/bin/env sh

declare -A lookup


while read -r file; do
  dir="${file%/Dockerfile}"          # ./apps/property-tree
  IFS='/' read -ra parts <<< "$dir"  # split path

  n=${#parts[@]}

  if (( n >= 4 )); then
    # ./deeply/nested/project  -> ["." "deeply" "nested" "project"]
    key="${parts[n-2]}/${parts[n-1]}"
  else
    # ./proj-name or ./apps/property-tree
    key="${parts[n-1]}"
  fi

  lookup["$key"]="$dir"
done < <(find . -name Dockerfile -not -path '*/node_modules/*')


if [[ ! -v lookup["$1"] ]]; then
  echo "Usage: local-test-build.sh <project-name>"
  echo "projects: $(printf "%s\n" "${!lookup[@]}" | sort | awk '{printf "%s%s", sep, $0; sep=", "} END {print ""}')"
  exit 2
else
  DOCKERFILE="${lookup["$1"]}/Dockerfile"
  echo "$DOCKERFILE"
  docker build -f "$DOCKERFILE" -t onecore-test/"$1" .
fi
