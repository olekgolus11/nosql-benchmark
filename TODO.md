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
- [P] Implement a script/command to clear the database (MongoDB and PostgreSQL). (Initial functions created in `run-overall-benchmark.sh`)
- [P] Implement the overall benchmark runner (`scripts/run-overall-benchmark.sh`):
    - [P] Script to iterate through test configurations. (Initial structure and scenarios defined)
    - [P] Logic to execute individual benchmark commands with specified parameters. (Basic execution in place)
    - [P] Logic to capture and save outputs in the defined formats (visual and JSON). (JSON and log capture, basic chart moving)
- [ ] Create example test configurations within the runner. (Initial set created, can be expanded)

## Phase 3: Testing and Refinement

- [ ] Test the overall benchmark runner with a few sample configurations.
- [ ] Verify that outputs are generated correctly and stored in the designated location.
- [ ] Refine test parameters and configurations based on initial results.
- [ ] Ensure clear separation and logging for each test run.

## Phase 4: Documentation (Optional - based on user needs)

- [ ] Document how to run the comprehensive benchmark and interpret the results.
