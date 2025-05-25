import { DatabaseBenchmark } from './benchmark';
import { SummaryVisualizer } from './summary-visualization';
import { TestResult } from './interfaces';
import fs from 'fs';
import path from 'path';

export class FullBenchmark {
  private results: TestResult[] = [];
  private outputDir: string;
  private jsonOutputDir: string;
  private visualizationsOutputDir: string;
  private summaryVisualizer: SummaryVisualizer;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'outputs');
    this.jsonOutputDir = path.join(this.outputDir, 'json');
    this.visualizationsOutputDir = path.join(this.outputDir, 'visualizations');
    
    // Ensure output directories exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    if (!fs.existsSync(this.jsonOutputDir)) {
      fs.mkdirSync(this.jsonOutputDir, { recursive: true });
    }
    if (!fs.existsSync(this.visualizationsOutputDir)) {
      fs.mkdirSync(this.visualizationsOutputDir, { recursive: true });
    }
    
    // Initialize the summary visualizer
    this.summaryVisualizer = new SummaryVisualizer();
  }

  async runInsertTests(emptyFirst: boolean = true): Promise<void> {
    console.log('\n========== RUNNING INSERT TESTS ==========\n');
    
    // Different document counts and concurrency levels to test
    const configurations = [
      { count: 10000, concurrency: 1 },    // Single client, small count
      { count: 10000, concurrency: 5 },    // Few clients, small count
      { count: 10000, concurrency: 25 },   // Many clients, small count
      { count: 50000, concurrency: 1 },    // Single client, medium count
      { count: 50000, concurrency: 10 },   // Medium clients, medium count
      { count: 50000, concurrency: 50 }    // Many clients, medium count
    ];
    
    for (const config of configurations) {
      // Empty the database if needed
      if (emptyFirst) {
        await this.emptyDatabases();
      }
      
      console.log(`\nRunning insert test with ${config.count} documents and ${config.concurrency} concurrent clients...`);
      console.log(`Database state: ${emptyFirst ? 'Empty' : 'Pre-populated'}`);
      
      const benchmark = new DatabaseBenchmark(config.concurrency);
      try {
        await benchmark.connect();
        await benchmark.setupPostgres();
        
        // Capture the results from the insert test
        const result = await benchmark.insertTest(config.count, config.concurrency);
        
        // Store the results
        this.results.push({
          testType: 'insert',
          configuration: {
            concurrency: config.concurrency,
            count: config.count,
            emptyDatabase: emptyFirst
          },
          results: {
            mongodb: {
              time: result.mongoTime,
              opsPerSecond: result.mongoOpsPerSecond
            },
            postgresql: {
              time: result.pgTime,
              opsPerSecond: result.pgOpsPerSecond
            }
          },
          timestamp: new Date().toISOString()
        });
        
        // Save results to JSON file
        this.saveResultsToJson();
        
      } finally {
        await benchmark.close();
      }
      
      // If we're testing with pre-populated database, we only need to empty it once at the beginning
      emptyFirst = false;
    }
  }

  async runComplexQueryTests(): Promise<void> {
    console.log('\n========== RUNNING COMPLEX QUERY TESTS ==========\n');
    
    // Different concurrency levels to test
    const concurrencyLevels = [1, 5, 10, 25, 50];
    
    for (const concurrency of concurrencyLevels) {
      console.log(`\nRunning complex query test with ${concurrency} concurrent clients...`);
      
      const benchmark = new DatabaseBenchmark(concurrency);
      try {
        await benchmark.connect();
        
        // Capture the results from the complex query test
        const result = await benchmark.complexQuery(concurrency);
        
        // Store the results
        this.results.push({
          testType: 'complex-query',
          configuration: {
            concurrency: concurrency,
            emptyDatabase: false // Query tests always run on populated database
          },
          results: {
            mongodb: {
              time: result.mongoTime,
              opsPerSecond: result.mongoOpsPerSecond
            },
            postgresql: {
              time: result.pgTime,
              opsPerSecond: result.pgOpsPerSecond
            }
          },
          timestamp: new Date().toISOString()
        });
        
        // Save results to JSON file
        this.saveResultsToJson();
        
      } finally {
        await benchmark.close();
      }
    }
  }

  async runAggregationTests(): Promise<void> {
    console.log('\n========== RUNNING AGGREGATION TESTS ==========\n');
    
    // Different concurrency levels to test
    const concurrencyLevels = [1, 5, 10, 25, 50];
    
    for (const concurrency of concurrencyLevels) {
      console.log(`\nRunning aggregation test with ${concurrency} concurrent clients...`);
      
      const benchmark = new DatabaseBenchmark(concurrency);
      try {
        await benchmark.connect();
        
        // Capture the results from the aggregation test
        const result = await benchmark.aggregation(concurrency);
        
        // Store the results
        this.results.push({
          testType: 'aggregation',
          configuration: {
            concurrency: concurrency,
            emptyDatabase: false // Aggregation tests always run on populated database
          },
          results: {
            mongodb: {
              time: result.mongoTime,
              opsPerSecond: result.mongoOpsPerSecond
            },
            postgresql: {
              time: result.pgTime,
              opsPerSecond: result.pgOpsPerSecond
            }
          },
          timestamp: new Date().toISOString()
        });
        
        // Save results to JSON file
        this.saveResultsToJson();
        
      } finally {
        await benchmark.close();
      }
    }
  }

  async runFullTextSearchTests(): Promise<void> {
    console.log('\n========== RUNNING FULL-TEXT SEARCH TESTS ==========\n');
    
    // Different configurations to test
    const configurations = [
      { concurrency: 1, searchCount: 1 },    // Single client, single search
      { concurrency: 1, searchCount: 5 },    // Single client, multiple searches
      { concurrency: 5, searchCount: 1 },    // Few clients, single search
      { concurrency: 5, searchCount: 5 },    // Few clients, multiple searches
      { concurrency: 25, searchCount: 1 },   // Many clients, single search
      { concurrency: 25, searchCount: 5 }    // Many clients, multiple searches
    ];
    
    for (const config of configurations) {
      console.log(`\nRunning full-text search test with ${config.concurrency} concurrent clients and ${config.searchCount} search terms...`);
      
      const benchmark = new DatabaseBenchmark(config.concurrency);
      try {
        await benchmark.connect();
        await benchmark.setupPostgres(); // Ensure indexes are created
        
        // Capture the results from the full-text search test
        const result = await benchmark.fullTextSearch(config.concurrency, config.searchCount);
        
        // Store the results
        this.results.push({
          testType: 'full-text-search',
          configuration: {
            concurrency: config.concurrency,
            count: config.searchCount,
            searchTerms: result.searchTerms,
            emptyDatabase: false // Search tests always run on populated database
          },
          results: {
            mongodb: {
              time: result.mongoTime,
              opsPerSecond: result.mongoOpsPerSecond
            },
            postgresql: {
              time: result.pgTime,
              opsPerSecond: result.pgOpsPerSecond
            }
          },
          timestamp: new Date().toISOString()
        });
        
        // Save results to JSON file
        this.saveResultsToJson();
        
      } finally {
        await benchmark.close();
      }
    }
  }

  async runAllTests(): Promise<void> {
    console.log('Starting comprehensive benchmark suite...');
    
    // First, ensure we have data to work with
    await this.ensureDataExists();
    
    // Run insert tests with empty databases
    await this.runInsertTests(true);
    
    // Run insert tests with pre-populated databases
    await this.runInsertTests(false);
    
    // Run complex query tests
    await this.runComplexQueryTests();
    
    // Run aggregation tests
    await this.runAggregationTests();
    
    // Run full-text search tests
    await this.runFullTextSearchTests();
    
    // Generate summary visualizations
    await this.generateSummaryVisualizations();
    
    console.log('\nAll benchmark tests completed!');
    console.log(`Results saved to ${this.jsonOutputDir}`);
    console.log(`Visualizations saved to ${this.visualizationsOutputDir}`);
  }

  async ensureDataExists(): Promise<void> {
    console.log('Checking if databases have data...');
    
    const benchmark = new DatabaseBenchmark(1);
    try {
      await benchmark.connect();
      
      // Check MongoDB
      const mongoDb = benchmark.mongoDbs[0];
      const mongoCount = await mongoDb.collection('users').countDocuments();
      
      // Check PostgreSQL
      const pgResult = await benchmark.pgClients[0].query('SELECT COUNT(*) FROM users');
      const pgCount = parseInt(pgResult.rows[0].count);
      
      if (mongoCount === 0 || pgCount === 0) {
        console.log('One or both databases are empty. Inserting initial data...');
        await benchmark.setupPostgres();
        await benchmark.insertTest(10000, 10); // Insert a reasonable amount of data
      } else {
        console.log('Both databases have data. Proceeding with tests...');
      }
    } finally {
      await benchmark.close();
    }
  }

  async emptyDatabases(): Promise<void> {
    console.log('Emptying databases...');
    
    const benchmark = new DatabaseBenchmark(1);
    try {
      await benchmark.connect();
      
      // Wipe MongoDB
      const mongoDb = benchmark.mongoDbs[0];
      await mongoDb.collection('users').deleteMany({});
      
      // Wipe PostgreSQL
      await benchmark.pgClients[0].query('TRUNCATE TABLE users RESTART IDENTITY');
      
      console.log('Databases emptied successfully');
    } catch (error) {
      console.error('Error emptying databases:', error);
    } finally {
      await benchmark.close();
    }
  }

  private saveResultsToJson(): string {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `benchmark_results_${timestamp}.json`;
    const filePath = path.join(this.jsonOutputDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(this.results, null, 2));
    return filePath;
  }

  async generateSummaryVisualizations(): Promise<void> {
    console.log('Generating summary visualizations...');
    
    if (this.results.length === 0) {
      console.log('No test results to visualize');
      return;
    }
    
    // Save the current results to a JSON file
    const resultsFilePath = this.saveResultsToJson();
    
    // Generate all summary visualizations
    await this.summaryVisualizer.generateAllSummaryVisualizations(resultsFilePath);
    
    console.log('Summary visualizations generated successfully');
  }
}
