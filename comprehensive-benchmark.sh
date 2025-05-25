#!/bin/bash

# Comprehensive Benchmark Runner Script
# This script provides a simple way to run the comprehensive benchmark system

# Set the base directory to the location of this script
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to display usage information
function show_usage {
  echo "Comprehensive NoSQL Benchmark Suite"
  echo ""
  echo "Usage: ./comprehensive-benchmark.sh [command]"
  echo ""
  echo "Commands:"
  echo "  run-all             Run all benchmark tests with various configurations"
  echo "  insert-tests        Run only insert tests with various configurations"
  echo "  query-tests         Run only complex query tests with various configurations"
  echo "  aggregation-tests   Run only aggregation tests with various configurations"
  echo "  search-tests        Run only full-text search tests with various configurations"
  echo "  help                Display this help message"
  echo ""
}

# Parse command line arguments
if [ $# -eq 0 ]; then
  show_usage
  exit 0
fi

COMMAND=$1
shift

case $COMMAND in
  run-all)
    echo "Running all comprehensive benchmark tests..."
    bun run "$BASE_DIR/src/run-comprehensive-benchmark.ts" run-all "$@"
    ;;
  insert-tests)
    echo "Running insert tests with various configurations..."
    bun run "$BASE_DIR/src/run-comprehensive-benchmark.ts" insert-tests "$@"
    ;;
  query-tests)
    echo "Running complex query tests with various configurations..."
    bun run "$BASE_DIR/src/run-comprehensive-benchmark.ts" query-tests "$@"
    ;;
  aggregation-tests)
    echo "Running aggregation tests with various configurations..."
    bun run "$BASE_DIR/src/run-comprehensive-benchmark.ts" aggregation-tests "$@"
    ;;
  search-tests)
    echo "Running full-text search tests with various configurations..."
    bun run "$BASE_DIR/src/run-comprehensive-benchmark.ts" search-tests "$@"
    ;;
  help)
    show_usage
    ;;
  *)
    echo "Unknown command: $COMMAND"
    show_usage
    exit 1
    ;;
esac
