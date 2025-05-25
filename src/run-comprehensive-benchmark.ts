#!/usr/bin/env bun
import { Command } from 'commander';
import { FullBenchmark } from './full-benchmark-core';

// Create a command line interface with a specific name for the comprehensive benchmark tool
const program = new Command('comprehensive-benchmark');

program
  .description('Comprehensive NoSQL Benchmark Suite')
  .version('1.0.0');

program.command('run-all')
  .description('Run all benchmark tests with various configurations')
  .action(async () => {
    const benchmark = new FullBenchmark();
    await benchmark.runAllTests();
  });

program.command('insert-tests')
  .description('Run only insert tests with various configurations')
  .option('--empty-first', 'Empty databases before each test', true)
  .action(async (options) => {
    const benchmark = new FullBenchmark();
    await benchmark.ensureDataExists();
    await benchmark.runInsertTests(options.emptyFirst);
  });

program.command('query-tests')
  .description('Run only complex query tests with various configurations')
  .action(async () => {
    const benchmark = new FullBenchmark();
    await benchmark.ensureDataExists();
    await benchmark.runComplexQueryTests();
  });

program.command('aggregation-tests')
  .description('Run only aggregation tests with various configurations')
  .action(async () => {
    const benchmark = new FullBenchmark();
    await benchmark.ensureDataExists();
    await benchmark.runAggregationTests();
  });

program.command('search-tests')
  .description('Run only full-text search tests with various configurations')
  .action(async () => {
    const benchmark = new FullBenchmark();
    await benchmark.ensureDataExists();
    await benchmark.runFullTextSearchTests();
  });

// Parse command line arguments
program.parse(process.argv);
