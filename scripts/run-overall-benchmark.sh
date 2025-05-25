#!/bin/bash

# Comprehensive Benchmark Runner

# --- Configuration ---
MONGO_CONTAINER_NAME="nosql-benchmark-mongodb-1"
POSTGRES_CONTAINER_NAME="nosql-benchmark-postgres-1"

MONGO_DB_NAME="benchmark"
POSTGRES_DB_NAME="benchmark"
POSTGRES_USER="root"
POSTGRES_PASSWORD="example"
MONGO_USER="root"
MONGO_PASSWORD="example"

PROJECT_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd .. && pwd)" # Get project root
BASE_OUTPUT_DIR="${PROJECT_ROOT_DIR}/benchmark_results"

# --- Helper Functions ---

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to clear MongoDB
clear_mongodb() {
  log "Clearing MongoDB (database: $MONGO_DB_NAME)..."
  docker exec -i "$MONGO_CONTAINER_NAME" mongo -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin "$MONGO_DB_NAME" --eval "db.dropDatabase()" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    log "MongoDB cleared successfully."
  else
    log "ERROR: Failed to clear MongoDB."
    # Optionally exit here or handle error
  fi
}

# Function to clear PostgreSQL
clear_postgres() {
  log "Clearing PostgreSQL (database: $POSTGRES_DB_NAME)..."
  PGPASSWORD="$POSTGRES_PASSWORD" docker exec -i "$POSTGRES_CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    log "PostgreSQL cleared successfully."
  else
    log "ERROR: Failed to clear PostgreSQL."
    # Optionally exit here or handle error
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
    clear_mongodb
    clear_postgres
  else
    log "Skipping database clearing for this scenario."
  fi

  log "Executing benchmark: bun run src/benchmark.ts ${COMMAND} ${OPTIONS}"
  
  # Execute and capture output
  # Assuming benchmark.ts prints JSON to stdout and saves charts to CWD
  if bun run src/benchmark.ts ${COMMAND} ${OPTIONS} > "${SCENARIO_OUTPUT_DIR}/results.json" 2> "${SCENARIO_OUTPUT_DIR}/error.log"; then
    log "Benchmark completed successfully for ${SCENARIO_NAME}."
  else
    log "ERROR: Benchmark failed for ${SCENARIO_NAME}. Check error.log."
  fi
  
  # Capture all stdout/stderr to a general log as well for easier debugging
  # This is redundant if results.json captures all primary output, but good for full trace
  # bun run src/benchmark.ts ${COMMAND} ${OPTIONS} > "${SCENARIO_OUTPUT_DIR}/output.log" 2>&1

  log "Moving any generated charts (e.g., *.png) to scenario directory..."
  # Move any .png files from project root to scenario directory
  # Adjust if charts are saved elsewhere by benchmark.ts
  find . -maxdepth 1 -name '*.png' -exec mv {} "${SCENARIO_OUTPUT_DIR}/" \;
  if ls "${SCENARIO_OUTPUT_DIR}"/*.png > /dev/null 2>&1; then
    log "Charts moved."
  else
    log "No charts found to move or error moving charts."
  fi
  
  log "Scenario ${SCENARIO_NAME} finished."
done

log "------------------------------------------------------------"
log "Comprehensive benchmark run finished."
log "Results are in: ${CURRENT_RUN_OUTPUT_DIR}"

# Ensure the script is executable: chmod +x scripts/run-overall-benchmark.sh
