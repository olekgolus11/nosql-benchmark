# Comprehensive Benchmark TODO

## Phase 1: Setup and Planning

- [X] Define the structure and parameters for the comprehensive test suite.
- [X] Design the test configurations, including variations for:
    - [X] Concurrent clients (e.g., 1, 5, 10)
    - [X] Number of items/texts for operations (e.g., search, insert)
    - [X] Data state for insertion tests (empty DB vs. pre-filled DB)
- [X] Decide on the implementation approach for the overall benchmark runner (e.g., shell script).
- [X] Plan the output management strategy:
    - [X] Directory structure for outputs.
    - [X] Format for visual and JSON outputs.

## Phase 2: Implementation

- [X] Create a directory for storing test outputs (e.g., `benchmark_results`).
- [X] Implement a script/command to clear the database (MongoDB and PostgreSQL). (Switched to using `wipe-data` from `benchmark.ts`)
- [X] Implement the overall benchmark runner (`scripts/run-overall-benchmark.sh`):
    - [X] Script to iterate through test configurations. (Structure and scenarios defined)
    - [X] Logic to execute individual benchmark commands with specified parameters. (Execution in place)
    - [X] Logic to capture and save outputs in the defined formats (visual and JSON). (JSON, log capture, and chart moving implemented)
- [P] Create example test configurations within the runner. (Initial set created, can be expanded by user)

## Phase 3: Testing and Refinement

- [P] Test the overall benchmark runner with a few sample configurations. (Output changed to results.md, headers added)
- [P] Verify that outputs are generated correctly and stored in the designated location. (Checking new results.md format and headers)
- [P] Refine test parameters and configurations based on initial results. (Scenarios made more demanding)
- [X] Ensure clear separation and logging for each test run. (Structure seems effective)

## Phase 4: Documentation (Optional - based on user needs)

- [ ] Document how to run the comprehensive benchmark and interpret the results.
