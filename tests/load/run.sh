#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Load Test Runner Script
# Production-ready artillery load testing orchestration
#
# Usage:
#   ./tests/load/run.sh              # Run default load test
#   ./tests/load/run.sh smoke        # Run smoke test
#   ./tests/load/run.sh stress       # Run stress test
#   ./tests/load/run.sh soak         # Run soak test
#   ./tests/load/run.sh custom.yml   # Run custom config
#
# Environment Variables:
#   TARGET_URL    - Target URL (default: http://localhost:4000)
#   OUTPUT_DIR    - Report output directory (default: tests/load/reports)
#   WORKERS       - Number of artillery workers (default: auto)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPORT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/reports}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helper Functions ──────────────────────────────────────────────────────
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ── Pre-flight Checks ─────────────────────────────────────────────────────
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if artillery is installed
    if ! command -v artillery &> /dev/null; then
        log_error "Artillery is not installed globally."
        log_info "Installing artillery globally..."
        npm install -g artillery@latest
    fi

    # Check if target is reachable
    local target_url="${TARGET_URL:-http://localhost:4000}"
    log_info "Checking target: ${target_url}"

    if ! curl -s -o /dev/null -w "%{http_code}" "${target_url}/api/v1/auth/login" -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"123456"}' &> /dev/null; then
        log_warning "Target ${target_url} may not be reachable. Ensure the server is running."
        log_info "Start the server with: npm run dev"
    fi

    # Remind about database seeding
    log_info "Reminder: Ensure database is seeded with: npm run db:seed"

    # Create report directory
    mkdir -p "${REPORT_DIR}"

    log_success "Prerequisites check complete"
}

# ── Run Load Test ─────────────────────────────────────────────────────────
run_test() {
    local config_file="${1:-api.yml}"
    local config_path="${SCRIPT_DIR}/${config_file}"

    if [[ ! -f "${config_path}" ]]; then
        log_error "Config file not found: ${config_path}"
        exit 1
    fi

    local report_name="${config_file%.yml}_${TIMESTAMP}"
    local report_path="${REPORT_DIR}/${report_name}"

    log_info "Starting load test with config: ${config_file}"
    log_info "Target: ${TARGET_URL:-http://localhost:4000}"
    log_info "Report will be saved to: ${report_path}.*"

    # Export environment variables for artillery (with defaults)
    export TARGET_URL="${TARGET_URL:-http://localhost:4000}"
    export ARTILLERY_WORKERS="${WORKERS:-}"

    # Run artillery with JSON and HTML reports
    artillery run \
        "${config_path}" \
        --output "${report_path}.json" \
        2>&1 | tee "${report_path}.log"

    local exit_code=${PIPESTATUS[0]}

    # Generate HTML report if JSON report exists
    if [[ -f "${report_path}.json" ]]; then
        log_info "Generating HTML report..."
        artillery report "${report_path}.json" --output "${report_path}.html" 2>/dev/null || true
    fi

    if [[ ${exit_code} -eq 0 ]]; then
        log_success "Load test completed successfully"
        log_info "Reports available at:"
        log_info "  - JSON: ${report_path}.json"
        log_info "  - HTML: ${report_path}.html"
        log_info "  - Log:  ${report_path}.log"
    else
        log_error "Load test failed with exit code: ${exit_code}"
        exit ${exit_code}
    fi
}

# ── Compare Results ───────────────────────────────────────────────────────
compare_results() {
    local baseline="${1:-}"
    local current="${2:-}"

    if [[ -z "${baseline}" || -z "${current}" ]]; then
        log_warning "Both baseline and current report paths are required for comparison"
        return
    fi

    log_info "Comparing results..."
    log_info "Baseline: ${baseline}"
    log_info "Current:  ${current}"

    # This could be extended with custom comparison logic
    # For now, just display both reports
    echo ""
    echo "Baseline Summary:"
    cat "${baseline}" | jq '.aggregate' 2>/dev/null || cat "${baseline}"
    echo ""
    echo "Current Summary:"
    cat "${current}" | jq '.aggregate' 2>/dev/null || cat "${current}"
}

# ── Main ──────────────────────────────────────────────────────────────────
main() {
    local test_type="${1:-default}"

    echo "══════════════════════════════════════════════════════════════"
    echo "           Artillery Load Test Runner"
    echo "══════════════════════════════════════════════════════════════"
    echo ""

    check_prerequisites

    case "${test_type}" in
        smoke)
            log_info "Running SMOKE test (quick validation)"
            run_test "smoke.yml"
            ;;
        stress)
            log_info "Running STRESS test (high intensity)"
            run_test "stress.yml"
            ;;
        soak)
            log_info "Running SOAK test (long duration)"
            run_test "soak.yml"
            ;;
        default|api)
            log_info "Running DEFAULT load test"
            run_test "api.yml"
            ;;
        *)
            if [[ -f "${SCRIPT_DIR}/${test_type}" ]]; then
                log_info "Running CUSTOM test: ${test_type}"
                run_test "${test_type}"
            else
                log_error "Unknown test type: ${test_type}"
                log_info "Available options: smoke, stress, soak, default, or custom config file"
                exit 1
            fi
            ;;
    esac
}

# Run main function with all arguments
main "$@"
