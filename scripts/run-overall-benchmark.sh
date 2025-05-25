#!/bin/bash

# Comprehensive Benchmark Runner

# --- Configuration ---
# MONGO_CONTAINER_NAME="nosql-benchmark-mongodb-1" # No longer needed for direct docker exec
# POSTGRES_CONTAINER_NAME="nosql-benchmark-postgres-1" # No longer needed

# MONGO_DB_NAME="benchmark" # Handled by benchmark.ts
# POSTGRES_DB_NAME="benchmark" # Handled by benchmark.ts
# POSTGRES_USER="root" # Handled by benchmark.ts
# POSTGRES_PASSWORD="example" # Handled by benchmark.ts
# MONGO_USER="root" # Handled by benchmark.ts
# MONGO_PASSWORD="example" # Handled by benchmark.ts

PROJECT_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd .. && pwd)" # Get project root
BASE_OUTPUT_DIR="${PROJECT_ROOT_DIR}/benchmark_results"
CHART_SOURCE_DIR="${PROJECT_ROOT_DIR}/outputs" # Directory where benchmark.ts saves charts

# --- Helper Functions ---

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to clear databases using benchmark.ts wipe-data command
clear_databases() {
  log "Clearing databases using 'bun run src/benchmark.ts wipe-data'..."
  if bun run src/benchmark.ts wipe-data; then
    log "Databases cleared successfully via wipe-data command."
  else
    log "ERROR: Failed to clear databases using wipe-data command. Check output above."
    # Optionally exit here or handle error
    exit 1 # Exit if clearing fails, as it impacts subsequent tests
  fi
}

# --- Main Test Execution Logic ---

RUN_TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
CURRENT_RUN_OUTPUT_DIR="${BASE_OUTPUT_DIR}/${RUN_TIMESTAMP}"

mkdir -p "${CURRENT_RUN_OUTPUT_DIR}"
log "Created run output directory: ${CURRENT_RUN_OUTPUT_DIR}"

# Define Test Scenarios
# Format: "SCENARIO_NAME|BENCHMARK_COMMAND|COMMAND_OPTIONS|CLEAR_DB_BEFORE_TEST(true/false)"
# Note: For commands that need pre-filled data, ensure a preceding insert runs and CLEAR_DB_BEFORE_TEST is false for the test.

TEST_SCENARIOS=(
  "insert_1k_1c_empty|insert-test|--count 1000 --concurrency 1|true"
  "insert_10k_5c_empty|insert-test|--count 10000 --concurrency 5|true"
  
  # Scenario to pre-fill database for subsequent tests
  "prefill_db_100k_10c|insert-test|--count 100000 --concurrency 10|true" 
  
  "insert_1k_1c_prefilled|insert-test|--count 1000 --concurrency 1|false"
  "search_10terms_1c_prefilled|full-text-search|--count 10 --concurrency 1|false"
  "search_100terms_5c_prefilled|full-text-search|--count 100 --concurrency 5|false"
  "complex_query_5c_prefilled|complex-query|--concurrency 5|false"
  "aggregation_5c_prefilled|aggregation|--concurrency 5|false"
)

log "Starting comprehensive benchmark run..."

cd "${PROJECT_ROOT_DIR}" || exit # Ensure commands run from project root

for scenario in "${TEST_SCENARIOS[@]}"; do
  IFS='|' read -r SCENARIO_NAME COMMAND OPTIONS CLEAR_DB <<< "$scenario"

  log "------------------------------------------------------------"
  log "Starting Scenario: ${SCENARIO_NAME}"
  log "Command: ${COMMAND}"
  log "Options: ${OPTIONS}"
  log "Clear DB before test: ${CLEAR_DB}"

  SCENARIO_OUTPUT_DIR="${CURRENT_RUN_OUTPUT_DIR}/${SCENARIO_NAME}"
  mkdir -p "${SCENARIO_OUTPUT_DIR}"
  log "Created scenario output directory: ${SCENARIO_OUTPUT_DIR}"

  if [ "$CLEAR_DB" == "true" ]; then
    clear_databases # Use the new function
  else
    log "Skipping database clearing for this scenario."
  fi

  log "Executing benchmark: bun run src/benchmark.ts ${COMMAND} ${OPTIONS}"
  
  # Ensure the chart source directory exists before running the benchmark
  mkdir -p "${CHART_SOURCE_DIR}"

  # Execute and capture output
  if bun run src/benchmark.ts ${COMMAND} ${OPTIONS} > "${SCENARIO_OUTPUT_DIR}/results.json" 2> "${SCENARIO_OUTPUT_DIR}/error.log"; then
    log "Benchmark completed successfully for ${SCENARIO_NAME}."
  else
    log "ERROR: Benchmark failed for ${SCENARIO_NAME}. Check error.log."
  fi
  
  log "Moving any generated charts (e.g., *.jpg, *.png) from ${CHART_SOURCE_DIR} to scenario directory..."
  # Move any .jpg or .png files from CHART_SOURCE_DIR to scenario directory
  find "${CHART_SOURCE_DIR}" -maxdepth 1 \( -name '*.jpg' -o -name '*.png' \) -exec mv {} "${SCENARIO_OUTPUT_DIR}/" \;
  if ls "${SCENARIO_OUTPUT_DIR}"/*.jpg > /dev/null 2>&1 || ls "${SCENARIO_OUTPUT_DIR}"/*.png > /dev/null 2>&1; then
    log "Charts moved."
  else
    log "No charts found to move from ${CHART_SOURCE_DIR} or error moving charts."
  fi
  
  log "Scenario ${SCENARIO_NAME} finished."
done

log "------------------------------------------------------------"
log "Comprehensive benchmark run finished."
log "Results are in: ${CURRENT_RUN_OUTPUT_DIR}"

# Ensure the script is executable: chmod +x scripts/run-overall-benchmark.sh
