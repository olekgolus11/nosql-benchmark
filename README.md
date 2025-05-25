# NoSQL Benchmark Tool (TypeScript)

A performance benchmarking tool for comparing MongoDB and PostgreSQL JSON capabilities, implemented in TypeScript and running on Bun.js.

## Features

- Document insertion performance testing
- Complex JSON query performance analysis
- Aggregation and filtering benchmarks
- Full-text search performance comparison
- Comprehensive benchmarking with various configurations
- Performance visualization and comparison charts
- Type-safe implementation with TypeScript
- High-performance execution with Bun.js runtime

## Prerequisites

- [Bun](https://bun.sh) (latest version)
- MongoDB
- PostgreSQL
- Docker (optional, for running databases)

## Setup

1. Install dependencies:
```bash
bun install
```

2. Configure environment variables (optional):
Create a `.env` file with your database connection settings:
```env
MONGO_URI=mongodb://root:example@localhost:27017/
PG_CONNECTION=postgresql://root:example@localhost:5432/benchmark
```

## Usage

Run the benchmark tool using the following commands:

### Insert Test
Test document insertion performance:
```bash
bun run src/benchmark.ts insert-test --count 1000000
```

### Complex Query Test
Test complex JSON query performance:
```bash
bun run src/benchmark.ts complex-query
```

### Aggregation Test
Test aggregation and filtering performance:
```bash
bun run src/benchmark.ts aggregation
```

### Full-Text Search Test
Test full-text search capabilities and performance:
```bash
# Basic usage
bun run src/benchmark.ts full-text-search

# With custom concurrency and multiple search terms
bun run src/benchmark.ts full-text-search -c 10 -n 5
```

Options:
- `-c, --concurrency <number>`: Number of concurrent clients (default: 25)
- `-n, --count <number>`: Number of search terms to test (default: 1)

## Development

- Build the project:
```bash
bun run build
```

- Run in development mode with watch:
```bash
bun run dev
```

## Docker Support

Use the included `docker-compose.yml` to spin up the required databases:

```bash
docker-compose up -d
```

## Comprehensive Benchmark Suite

The tool includes a comprehensive benchmark suite that runs all tests with various configurations. You can use the following npm scripts to run the benchmark suite:

```bash
# Run all benchmark tests with various configurations
npm run comprehensive-benchmark:all

# Run only specific test types
npm run comprehensive-benchmark:insert
npm run comprehensive-benchmark:query
npm run comprehensive-benchmark:aggregation
npm run comprehensive-benchmark:search
```

Or you can run the benchmark directly:

```bash
# Run all benchmark tests with various configurations
bun run src/run-comprehensive-benchmark.ts run-all

# Run only specific test types
bun run src/run-comprehensive-benchmark.ts insert-tests
bun run src/run-comprehensive-benchmark.ts query-tests
bun run src/run-comprehensive-benchmark.ts aggregation-tests
bun run src/run-comprehensive-benchmark.ts search-tests
```

If you make the script executable, you can also run it directly:

```bash
chmod +x src/run-comprehensive-benchmark.ts
./src/run-comprehensive-benchmark.ts run-all

# Run only specific test types
./src/run-comprehensive-benchmark.ts insert-tests
./src/run-comprehensive-benchmark.ts query-tests
./src/run-comprehensive-benchmark.ts aggregation-tests
./src/run-comprehensive-benchmark.ts search-tests
```

The comprehensive benchmark suite:

- Runs tests with different concurrency levels (1, 5, 10, 25, 50)
- Tests insert operations on both empty and pre-populated databases
- Varies document counts and search term counts
- Generates JSON result files and visualization charts
- Creates summary visualizations comparing performance across configurations

Results and visualizations are stored in the `outputs` directory:

```
outputs/
├── json/             # JSON result files
└── visualizations/   # Visualization charts
```

For more details, see the [comprehensive benchmark documentation](docs/comprehensive-benchmark.md).