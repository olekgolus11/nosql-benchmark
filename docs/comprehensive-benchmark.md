# Comprehensive Benchmark System

This document describes the comprehensive benchmark system for comparing MongoDB and PostgreSQL JSON capabilities.

## Overview

The comprehensive benchmark system allows you to run a series of tests with various configurations to thoroughly evaluate the performance of MongoDB and PostgreSQL for different operations. The system automatically runs tests with different concurrency levels, document counts, and database states (empty vs. pre-populated).

## Test Types

The system includes the following test types:

1. **Insert Tests**: Evaluate document insertion performance with different document counts and concurrency levels, both on empty and pre-populated databases.
2. **Complex Query Tests**: Evaluate complex JSON query performance with different concurrency levels.
3. **Aggregation Tests**: Evaluate aggregation and filtering performance with different concurrency levels.
4. **Full-Text Search Tests**: Evaluate full-text search capabilities with different search term counts and concurrency levels.

## Directory Structure

The benchmark system uses the following directory structure for outputs:

```
outputs/
├── json/             # JSON result files
└── visualizations/   # Visualization charts
```

## Running the Benchmark

You can run the comprehensive benchmark using the following commands:

### Run All Tests

To run all benchmark tests with various configurations:

```bash
npm run comprehensive-benchmark:all
```

Or directly with Bun:

```bash
bun run src/run-comprehensive-benchmark.ts run-all
```

This will run all test types with different configurations and generate summary visualizations.

### Run Specific Test Types

To run only specific test types:

```bash
# Run only insert tests
npm run comprehensive-benchmark:insert

# Run only complex query tests
npm run comprehensive-benchmark:query

# Run only aggregation tests
npm run comprehensive-benchmark:aggregation

# Run only full-text search tests
npm run comprehensive-benchmark:search
```

Or directly with Bun:

```bash
# Run only insert tests
bun run src/run-comprehensive-benchmark.ts insert-tests

# Run only complex query tests
bun run src/run-comprehensive-benchmark.ts query-tests

# Run only aggregation tests
bun run src/run-comprehensive-benchmark.ts aggregation-tests

# Run only full-text search tests
bun run src/run-comprehensive-benchmark.ts search-tests
```

## Test Configurations

Each test type is run with various configurations:

### Insert Tests
- Document counts: 10,000 and 50,000
- Concurrency levels: 1, 5, 10, 25, 50
- Database states: Empty and pre-populated

### Complex Query Tests
- Concurrency levels: 1, 5, 10, 25, 50

### Aggregation Tests
- Concurrency levels: 1, 5, 10, 25, 50

### Full-Text Search Tests
- Search term counts: 1 and 5
- Concurrency levels: 1, 5, 25

## Results and Visualizations

The benchmark system generates both JSON result files and visualization charts.

### JSON Results

Results are stored in the `outputs/json/` directory in JSON format. Each result file contains detailed information about each test run, including:

- Test type
- Configuration (concurrency, document count, etc.)
- Results for both MongoDB and PostgreSQL (time, operations per second)
- Timestamp

### Visualizations

The system generates several types of visualization charts in the `outputs/visualizations/` directory:

1. **Concurrency Comparison Charts**: Compare MongoDB and PostgreSQL performance across different concurrency levels for each test type.
2. **Database State Comparison Chart**: Compare insert performance between empty and pre-populated databases.
3. **Test Type Comparison Chart**: Compare the best performance of MongoDB and PostgreSQL across all test types.

## Generating Summary Visualizations

You can also generate summary visualizations from existing JSON result files:

```bash
bun run src/summary-visualization.ts generate <path-to-json-file>
```

This will generate all summary visualizations based on the provided JSON result file.

## Extending the Benchmark System

The benchmark system is designed to be extensible. To add new test types or configurations:

1. Add new test methods to the `DatabaseBenchmark` class in `benchmark.ts`.
2. Update the `FullBenchmark` class in `full-benchmark.ts` to include the new test types.
3. Add visualization support for the new test types in `summary-visualization.ts`.
