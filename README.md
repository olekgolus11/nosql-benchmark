# NoSQL Benchmark Tool (TypeScript)

A performance benchmarking tool for comparing MongoDB and PostgreSQL JSON capabilities, implemented in TypeScript and running on Bun.js.

## Features

- Document insertion performance testing
- Complex JSON query performance analysis
- Aggregation and filtering benchmarks
- Full-text search performance comparison
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