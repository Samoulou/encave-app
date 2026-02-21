#!/bin/bash
###############################################################################
# run-backlog.sh — Automated backlog runner for Claude Code
#
# Processes each User Story from backlog-stories.json sequentially:
#   1. Claude implements the US (fresh context)
#   2. Claude runs QA: tests + build + review (fresh context)
#   3. Build check (+ auto-fix if needed)
#   4. Commit & push directly on main
#   5. Moves to the next US (fresh context)
#
# Usage:
#   ./scripts/run-backlog.sh                  # Run all stories from the start
#   ./scripts/run-backlog.sh --from BUG-003   # Resume from a specific story
#   ./scripts/run-backlog.sh --phase 2        # Run only stories from phase 2
#   ./scripts/run-backlog.sh --dry-run        # Preview what would be executed
#   ./scripts/run-backlog.sh --only BUG-001   # Run a single story
###############################################################################

set -euo pipefail

# --- Config ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKLOG_JSON="$SCRIPT_DIR/backlog-stories.json"
BACKLOG_MD="$PROJECT_DIR/_bmad-output/backlog-complet.md"
LOG_DIR="$PROJECT_DIR/scripts/logs"
BRANCH="main"
MODEL="claude-opus-4-6"        # claude-sonnet-4-6 for faster/cheaper, claude-opus-4-6 for complex
QA_MODEL="claude-sonnet-4-6"   # QA can use a faster model
MAX_TURNS=50                   # Max agentic turns per invocation

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- Parse args ---
START_FROM=""
PHASE_FILTER=""
DRY_RUN=false
ONLY_STORY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --from)    START_FROM="$2"; shift 2 ;;
    --phase)   PHASE_FILTER="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --only)    ONLY_STORY="$2"; shift 2 ;;
    --model)   MODEL="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 [--from STORY_ID] [--phase N] [--only STORY_ID] [--dry-run] [--model MODEL]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# --- Setup ---
mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

# Ensure we're on main
git checkout "$BRANCH" 2>/dev/null
git pull origin "$BRANCH" 2>/dev/null || true

# Count stories
TOTAL=$(jq length "$BACKLOG_JSON")
echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}  EnCave Backlog Runner${NC}"
echo -e "${CYAN}  $TOTAL stories | commit direct on main${NC}"
echo -e "${CYAN}=======================================${NC}"
echo ""

# --- Filter stories ---
SKIP=true
[ -z "$START_FROM" ] && SKIP=false

COMPLETED=0
FAILED=0
SKIPPED=0

for i in $(seq 0 $(($TOTAL - 1))); do
  ID=$(jq -r ".[$i].id" "$BACKLOG_JSON")
  PHASE=$(jq -r ".[$i].phase" "$BACKLOG_JSON")
  TITLE=$(jq -r ".[$i].title" "$BACKLOG_JSON")

  # --from: skip until we reach the target
  if [ "$SKIP" = true ]; then
    if [ "$ID" = "$START_FROM" ]; then
      SKIP=false
    else
      echo -e "${YELLOW}[SKIP]${NC} $ID — $TITLE (before --from $START_FROM)"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi

  # --phase: filter by phase
  if [ -n "$PHASE_FILTER" ] && [ "$PHASE" != "$PHASE_FILTER" ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # --only: filter single story
  if [ -n "$ONLY_STORY" ] && [ "$ID" != "$ONLY_STORY" ]; then
    continue
  fi

  echo -e ""
  echo -e "${BLUE}=========================================${NC}"
  echo -e "${BLUE}  [$((i+1))/$TOTAL] $ID — $TITLE${NC}"
  echo -e "${BLUE}  Phase: $PHASE | on: $BRANCH${NC}"
  echo -e "${BLUE}=========================================${NC}"

  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN]${NC} Would process $ID"
    continue
  fi

  # --- Step 1: IMPLEMENT (fresh context) ---
  echo -e "${CYAN}[1/4]${NC} Claude is implementing $ID..."
  IMPLEMENT_LOG="$LOG_DIR/${ID}_implement.log"

  IMPLEMENT_PROMPT=$(cat <<PROMPT_EOF
Tu es un dev senior qui travaille sur le projet EnCave (Next.js 14, TypeScript, Prisma, Stripe, next-intl).

## Ta mission
Implemente la User Story suivante du backlog. Lis d'abord le backlog complet pour le contexte, puis implemente.

## Story a implementer: $ID — $TITLE

Lis le fichier _bmad-output/backlog-complet.md et trouve la section pour "$ID". Implemente EXACTEMENT ce qui est decrit dans les criteres d'acceptation.

## Regles
- Lis et comprends le code existant AVANT de modifier quoi que ce soit
- Suis les patterns existants du projet (next-intl pour i18n, Prisma pour DB, etc.)
- Les 3 locales sont: en, fr, de — mets a jour les 3 fichiers messages si besoin
- Ne cree pas de fichiers inutiles
- Ne sur-ingenierie pas : fais exactement ce qui est demande
- Utilise le logger existant (src/lib/logger.ts) au lieu de console.log
- Teste ton travail en lancant les tests unitaires: npm run test:run
- Si des tests echouent A CAUSE de tes changements, corrige-les
- NE COMMITE PAS. Laisse les changements non commites.
PROMPT_EOF
  )

  if claude -p "$IMPLEMENT_PROMPT" \
    --model "$MODEL" \
    --max-turns "$MAX_TURNS" \
    --dangerously-skip-permissions \
    2>&1 | tee "$IMPLEMENT_LOG"; then
    echo -e "${GREEN}  Implementation done.${NC}"
  else
    echo -e "${RED}  Implementation failed! Check $IMPLEMENT_LOG${NC}"
    echo -e "${YELLOW}  Reverting uncommitted changes...${NC}"
    git checkout -- . 2>/dev/null
    git clean -fd 2>/dev/null
    FAILED=$((FAILED + 1))
    continue
  fi

  # --- Step 2: QA (fresh context) ---
  echo -e "${CYAN}[2/4]${NC} QA: tests + build + review..."
  TEST_LOG="$LOG_DIR/${ID}_qa.log"

  TEST_PROMPT=$(cat <<PROMPT_EOF
Tu es un agent QA sur le projet EnCave (Next.js 14, TypeScript, Prisma, next-intl).

## Ta mission
Verifier que les changements pour la story $ID ($TITLE) sont corrects.

## Etapes
1. Regarde les fichiers modifies: git diff --name-only HEAD
2. Lance les tests: npm run test:run
3. Si des tests echouent A CAUSE des changements recents (pas des tests pre-existants qui echouaient deja), corrige-les
4. Lance le build: npm run build
5. Si le build echoue, corrige les erreurs
6. Relis les criteres d'acceptation dans _bmad-output/backlog-complet.md pour "$ID"
7. Verifie que chaque critere est satisfait

## Regles
- NE COMMITE PAS
- Si tu corriges des choses, assure-toi que tests + build passent ensuite
- Les tests pre-existants qui echouent (prisma/seed.ts, context next-intl) ne sont PAS ta responsabilite
- Reponds avec un resume: PASSED ou FAILED + details
PROMPT_EOF
  )

  if claude -p "$TEST_PROMPT" \
    --model "$QA_MODEL" \
    --max-turns 30 \
    --dangerously-skip-permissions \
    2>&1 | tee "$TEST_LOG"; then
    echo -e "${GREEN}  QA passed.${NC}"
  else
    echo -e "${RED}  QA failed! Check $TEST_LOG${NC}"
    echo -e "${YELLOW}  Reverting uncommitted changes...${NC}"
    git checkout -- . 2>/dev/null
    git clean -fd 2>/dev/null
    FAILED=$((FAILED + 1))
    continue
  fi

  # --- Step 3: FINAL BUILD CHECK ---
  echo -e "${CYAN}[3/4]${NC} Final build check..."
  BUILD_LOG="$LOG_DIR/${ID}_build.log"
  if npm run build 2>&1 | tee "$BUILD_LOG"; then
    echo -e "${GREEN}  Build OK.${NC}"
  else
    echo -e "${RED}  Build failed! Attempting auto-fix...${NC}"

    FIX_PROMPT=$(cat <<PROMPT_EOF
Le build Next.js a echoue. Corrige les erreurs de build.
Lis le log de build dans scripts/logs/${ID}_build.log, identifie les erreurs, et corrige-les.
Ne change pas la logique metier, corrige uniquement les erreurs TypeScript/ESLint/import.
Apres correction, verifie avec: npm run build
PROMPT_EOF
    )

    claude -p "$FIX_PROMPT" \
      --model "$QA_MODEL" \
      --max-turns 15 \
      --dangerously-skip-permissions \
      2>&1 | tee "$LOG_DIR/${ID}_buildfix.log"

    # Re-check build
    if npm run build 2>&1 > /dev/null; then
      echo -e "${GREEN}  Build fixed and OK.${NC}"
    else
      echo -e "${RED}  Build still failing after fix attempt! Reverting $ID.${NC}"
      git checkout -- . 2>/dev/null
      git clean -fd 2>/dev/null
      FAILED=$((FAILED + 1))
      continue
    fi
  fi

  # --- Step 4: COMMIT & PUSH on main ---
  echo -e "${CYAN}[4/4]${NC} Committing and pushing on $BRANCH..."

  # Determine commit prefix
  if [[ "$ID" == BUG-* ]]; then
    COMMIT_PREFIX="fix"
  elif [[ "$ID" == US-TECH-* ]]; then
    COMMIT_PREFIX="refactor"
  elif [[ "$ID" == US-I18N-* ]]; then
    COMMIT_PREFIX="feat(i18n)"
  elif [[ "$ID" == US-UX-* ]]; then
    COMMIT_PREFIX="fix(ux)"
  else
    COMMIT_PREFIX="feat"
  fi

  # Stage all changes
  git add -A

  # Check if there are changes to commit
  if git diff --cached --quiet; then
    echo -e "${YELLOW}  No changes to commit for $ID. Skipping.${NC}"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # Commit
  git commit -m "$(cat <<EOF
$COMMIT_PREFIX: $ID $TITLE

Automated implementation from backlog-complet.md
Story: $ID | Phase: $PHASE

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
  )"

  # Push to main
  git push origin "$BRANCH"

  COMPLETED=$((COMPLETED + 1))
  echo -e "${GREEN}  $ID committed and pushed to $BRANCH!${NC}"
done

# --- Summary ---
echo ""
echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}  BACKLOG RUN COMPLETE${NC}"
echo -e "${CYAN}=======================================${NC}"
echo -e "  ${GREEN}Completed: $COMPLETED${NC}"
echo -e "  ${RED}Failed:    $FAILED${NC}"
echo -e "  ${YELLOW}Skipped:   $SKIPPED${NC}"
echo -e "  Total:     $TOTAL"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Some stories failed. Check logs in $LOG_DIR${NC}"
  exit 1
fi
