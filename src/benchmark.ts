import { Command } from 'commander';
import { config } from 'dotenv';
import { MongoClient, Db } from 'mongodb';
import pg from 'pg';
import { faker } from '@faker-js/faker';
import os from 'os';
import { BenchmarkVisualizer } from './visualization';
import { 
  UserData, 
  InsertTestResult, 
  ComplexQueryResult, 
  AggregationResult, 
  FullTextSearchResult,
  ResourceUsage,
  DataPoint
} from './interfaces';

// Load environment variables
config();

// Database connection settings
const MONGO_URI = 'mongodb://root:example@localhost:27017/';
const PG_CONNECTION = 'postgresql://root:example@localhost:5432/benchmark';

export class DatabaseBenchmark {
  public mongoClients: MongoClient[] = [];
  public mongoDbs: Db[] = [];
  public pgClients: pg.Client[] = [];
  private concurrency: number;
  private visualizer: BenchmarkVisualizer;

  constructor(concurrency: number = 25) {
    this.concurrency = concurrency;
    // Initialize arrays of clients
    for (let i = 0; i < concurrency; i++) {
      this.mongoClients.push(new MongoClient(MONGO_URI));
      this.mongoDbs.push(this.mongoClients[i].db('benchmark'));
      this.pgClients.push(new pg.Client(PG_CONNECTION));
    }
    // Initialize visualizer
    this.visualizer = new BenchmarkVisualizer();
    
  }
  async connect(): Promise<void> {
    // Connect all clients in parallel
    await Promise.all([
      ...this.mongoClients.map(client => client.connect()),
      ...this.pgClients.map(client => client.connect())
    ]);
    console.log(`Connected ${this.concurrency} MongoDB and PostgreSQL clients`);
  }

  async setupPostgres(): Promise<void> {
    // Use the first PostgreSQL client to set up the database
    await this.pgClients[0].query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        data JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_user_preferences ON users ((data->'preferences'->'notifications'->>'email'));
      CREATE INDEX IF NOT EXISTS idx_user_name ON users ((data->>'name'));
      
      -- Create GIN index for full-text search on product names
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE INDEX IF NOT EXISTS idx_product_search ON users USING GIN (data jsonb_ops);
    `);

  }

  generateUserData(): UserData {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      preferences: {
        notifications: {
          email: faker.datatype.boolean(),
          push: faker.datatype.boolean()
        }
      },
      orders: Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => ({
        amount: Number(faker.finance.amount({ min: 10, max: 1000, dec: 2 })),
        date: faker.date.recent({ days: 30 }).toISOString(),
        items: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({
          product: faker.word.sample(),
          quantity: faker.number.int({ min: 1, max: 5 })
        }))
      }))
    };
  }

  private getResourceUsage() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memoryUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

    return {
      cpu: {
        user: cpuUsage.user / 1000000, // Convert to seconds
        system: cpuUsage.system / 1000000
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        memoryUsagePercent: Math.round(memoryUsagePercent * 100) / 100
      }
    };
  }

  private logResourceUsage(operation: string, dbType: 'MongoDB' | 'PostgreSQL', startUsage: any) {
    const endUsage = this.getResourceUsage();
    console.log(`\n${dbType} ${operation} Resource Usage:`);
    console.log(`CPU User Time: ${(endUsage.cpu.user - startUsage.cpu.user).toFixed(2)}s`);
    console.log(`CPU System Time: ${(endUsage.cpu.system - startUsage.cpu.system).toFixed(2)}s`);
    console.log(`Memory Usage: ${endUsage.memory.heapUsed}MB (Heap) / ${endUsage.memory.rss}MB (Total)`);
    console.log(`System Memory Usage: ${endUsage.memory.memoryUsagePercent}%`);
  }

  async insertTest(count: number, concurrency: number = 25): Promise<InsertTestResult> {
    // Ensure we're using the correct number of clients
    if (concurrency !== this.concurrency) {
      console.warn(`Warning: Requested concurrency (${concurrency}) differs from initialized client count (${this.concurrency}). Using ${this.concurrency} clients.`);
    }
    
    const docsPerClient = Math.floor(count / this.concurrency);
    const remainder = count % this.concurrency;
    console.log(`Running insert test with ${count} documents using ${this.concurrency} concurrent clients...`);

    // Data points for visualization
    const mongoDataPoints: { time: number; operations: number }[] = [];
    const pgDataPoints: { time: number; operations: number }[] = [];

    // Shared progress counter for MongoDB
    let mongoProgress = 0;
    const updateMongoProgress = () => {
      mongoProgress++;
      // Record data point every 5% of progress or at least 10 points
      const recordInterval = Math.max(Math.floor(count / 20), 100);
      if (mongoProgress % recordInterval === 0 || mongoProgress === count) {
        const currentTime = (performance.now() - mongoStartTime) / 1000;
        mongoDataPoints.push({ time: currentTime, operations: mongoProgress });
        process.stdout.write(`\rMongoDB progress: ${Math.round((mongoProgress / count) * 100)}%`);
      }
    };

    // MongoDB test
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    // Add starting point
    mongoDataPoints.push({ time: 0, operations: 0 });
    
    await Promise.all(this.mongoDbs.map((db, clientIdx) => {
      const mongoCollection = db.collection('users');
      const myCount = docsPerClient + (clientIdx < remainder ? 1 : 0);
      return (async () => {
        for (let i = 0; i < myCount; i++) {
          const userData = this.generateUserData();
          await mongoCollection.insertOne(userData);
          updateMongoProgress();
        }
      })();
    }));
    const mongoTime = (performance.now() - mongoStartTime) / 1000;
    // Ensure we have the final point
    mongoDataPoints.push({ time: mongoTime, operations: count });
    
    console.log(`\n\nMongoDB: ${count} documents inserted in ${mongoTime.toFixed(2)} seconds`);
    console.log(`MongoDB average insert speed: ${(count / mongoTime).toFixed(2)} docs/sec`);
    this.logResourceUsage('Insert', 'MongoDB', mongoStartUsage);

    // PostgreSQL test
    // Shared progress counter for PostgreSQL
    let pgProgress = 0;
    const updatePgProgress = () => {
      pgProgress++;
      // Record data point every 5% of progress or at least 10 points
      const recordInterval = Math.max(Math.floor(count / 20), 100);
      if (pgProgress % recordInterval === 0 || pgProgress === count) {
        const currentTime = (performance.now() - pgStartTime) / 1000;
        pgDataPoints.push({ time: currentTime, operations: pgProgress });
        process.stdout.write(`\rPostgreSQL progress: ${Math.round((pgProgress / count) * 100)}%`);
      }
    };
    
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    // Add starting point
    pgDataPoints.push({ time: 0, operations: 0 });
    
    await Promise.all(this.pgClients.map((client, clientIdx) => {
      const myCount = docsPerClient + (clientIdx < remainder ? 1 : 0);
      return (async () => {
        for (let i = 0; i < myCount; i++) {
          const userData = this.generateUserData();
          await client.query('INSERT INTO users (data) VALUES ($1)', [userData]);
          updatePgProgress();
        }
      })();
    }));
    const pgTime = (performance.now() - pgStartTime) / 1000;
    // Ensure we have the final point
    pgDataPoints.push({ time: pgTime, operations: count });
    
    console.log(`\n\nPostgreSQL: ${count} documents inserted in ${pgTime.toFixed(2)} seconds`);
    console.log(`PostgreSQL average insert speed: ${(count / pgTime).toFixed(2)} docs/sec`);
    this.logResourceUsage('Insert', 'PostgreSQL', pgStartUsage);
    
    // Generate visualization chart with real-time data points
    await this.visualizer.generateInsertChart(mongoTime, pgTime, count, this.concurrency, mongoDataPoints, pgDataPoints);
    
    // Return the results
    return {
      mongoTime,
      pgTime,
      mongoOpsPerSecond: count / mongoTime,
      pgOpsPerSecond: count / pgTime,
      count,
      concurrency: this.concurrency,
      mongoDataPoints,
      pgDataPoints
    };
  }

  async complexQuery(concurrency: number = 25): Promise<ComplexQueryResult> {
    // Ensure we're using the correct number of clients
    if (concurrency !== this.concurrency) {
      console.warn(`Warning: Requested concurrency (${concurrency}) differs from initialized client count (${this.concurrency}). Using ${this.concurrency} clients.`);
    }
    
    console.log('Running complex query test...');

    // Data points for visualization
    const mongoDataPoints: { time: number; operations: number }[] = [];
    const pgDataPoints: { time: number; operations: number }[] = [];
    const totalOperations = this.concurrency; // One query per client

    // MongoDB test
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    // Add starting point
    mongoDataPoints.push({ time: 0, operations: 0 });

    // Track progress for MongoDB queries
    let mongoCompleted = 0;
    const mongoPromises = this.mongoDbs.map(db => {
      const mongoCollection = db.collection('users');
      return (async () => {
        await mongoCollection.find({ 'preferences.notifications.email': true }).explain();
        mongoCompleted++;
        const currentTime = (performance.now() - mongoStartTime) / 1000;
        mongoDataPoints.push({ time: currentTime, operations: mongoCompleted });
      })();
    });

    await Promise.all(mongoPromises);
    const mongoTime = (performance.now() - mongoStartTime) / 1000;
    // Ensure we have the final point
    mongoDataPoints.push({ time: mongoTime, operations: totalOperations });
    
    console.log(`\nMongoDB query time: ${mongoTime.toFixed(2)} seconds`);
    // Only print one plan for brevity
    const mongoResult = await this.mongoDbs[0].collection('users').find({ 'preferences.notifications.email': true }).explain();
    console.log('MongoDB query plan:', mongoResult);
    this.logResourceUsage('Query', 'MongoDB', mongoStartUsage);

    // PostgreSQL test
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    // Add starting point
    pgDataPoints.push({ time: 0, operations: 0 });

    // Track progress for PostgreSQL queries
    let pgCompleted = 0;
    const pgPromises = this.pgClients.map(client => 
      (async () => {
        await client.query(`EXPLAIN ANALYZE SELECT * FROM users WHERE data->'preferences'->'notifications'->>'email' = 'true'`);
        pgCompleted++;
        const currentTime = (performance.now() - pgStartTime) / 1000;
        pgDataPoints.push({ time: currentTime, operations: pgCompleted });
      })()
    );

    await Promise.all(pgPromises);
    const pgTime = (performance.now() - pgStartTime) / 1000;
    // Ensure we have the final point
    pgDataPoints.push({ time: pgTime, operations: totalOperations });
    
    console.log(`\nPostgreSQL query time: ${pgTime.toFixed(2)} seconds`);
    const pgResult = await this.pgClients[0].query(`EXPLAIN ANALYZE SELECT * FROM users WHERE data->'preferences'->'notifications'->>'email' = 'true'`);
    console.log('PostgreSQL query plan:');
    pgResult.rows.forEach(row => console.log(row));
    this.logResourceUsage('Query', 'PostgreSQL', pgStartUsage);
    
    // Generate visualization chart with real-time data points
    await this.visualizer.generateQueryChart(mongoTime, pgTime, this.concurrency, mongoDataPoints, pgDataPoints);
    
    // Return the results
    return {
      mongoTime,
      pgTime,
      mongoOpsPerSecond: this.concurrency / mongoTime,
      pgOpsPerSecond: this.concurrency / pgTime,
      concurrency: this.concurrency,
      mongoDataPoints,
      pgDataPoints
    };
  }

  async aggregation(concurrency: number = 25): Promise<AggregationResult> {
    // Ensure we're using the correct number of clients
    if (concurrency !== this.concurrency) {
      console.warn(`Warning: Requested concurrency (${concurrency}) differs from initialized client count (${this.concurrency}). Using ${this.concurrency} clients.`);
    }
    
    console.log('Running aggregation test...');

    // Data points for visualization
    const mongoDataPoints: { time: number; operations: number }[] = [];
    const pgDataPoints: { time: number; operations: number }[] = [];
    const totalOperations = this.concurrency; // One aggregation per client

    // MongoDB test
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    // Add starting point
    mongoDataPoints.push({ time: 0, operations: 0 });

    // Track progress for MongoDB aggregations
    let mongoCompleted = 0;
    const mongoPromises = this.mongoDbs.map(db => {
      const mongoCollection = db.collection('users');
      return (async () => {
        await mongoCollection.aggregate([
          { $unwind: '$orders' },
          { $group: { _id: '$_id', total_amount: { $sum: '$orders.amount' } } }
        ]).toArray();
        mongoCompleted++;
        const currentTime = (performance.now() - mongoStartTime) / 1000;
        mongoDataPoints.push({ time: currentTime, operations: mongoCompleted });
      })();
    });

    await Promise.all(mongoPromises);
    const mongoTime = (performance.now() - mongoStartTime) / 1000;
    // Ensure we have the final point
    mongoDataPoints.push({ time: mongoTime, operations: totalOperations });
    
    console.log(`\nMongoDB aggregation time: ${mongoTime.toFixed(2)} seconds`);
    this.logResourceUsage('Aggregation', 'MongoDB', mongoStartUsage);

    // PostgreSQL test
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    // Add starting point
    pgDataPoints.push({ time: 0, operations: 0 });

    // Track progress for PostgreSQL aggregations
    let pgCompleted = 0;
    const pgPromises = this.pgClients.map(client => 
      (async () => {
        await client.query(`SELECT (data->>'_id') as user_id, SUM(CAST(order_data->>'amount' AS DECIMAL)) FROM users, jsonb_array_elements(data->'orders') AS order_data GROUP BY user_id;`);
        pgCompleted++;
        const currentTime = (performance.now() - pgStartTime) / 1000;
        pgDataPoints.push({ time: currentTime, operations: pgCompleted });
      })()
    );

    await Promise.all(pgPromises);
    const pgTime = (performance.now() - pgStartTime) / 1000;
    // Ensure we have the final point
    pgDataPoints.push({ time: pgTime, operations: totalOperations });
    
    console.log(`\nPostgreSQL aggregation time: ${pgTime.toFixed(2)} seconds`);
    this.logResourceUsage('Aggregation', 'PostgreSQL', pgStartUsage);
    
    // Generate visualization chart with real-time data points
    await this.visualizer.generateAggregationChart(mongoTime, pgTime, this.concurrency, mongoDataPoints, pgDataPoints);
    
    // Return the results
    return {
      mongoTime,
      pgTime,
      mongoOpsPerSecond: this.concurrency / mongoTime,
      pgOpsPerSecond: this.concurrency / pgTime,
      concurrency: this.concurrency,
      mongoDataPoints,
      pgDataPoints
    };
  }

  async fullTextSearch(concurrency: number = 25, searchCount: number = 1): Promise<FullTextSearchResult> {
    // Ensure we're using the correct number of clients
    if (concurrency !== this.concurrency) {
      console.warn(`Warning: Requested concurrency (${concurrency}) differs from initialized client count (${this.concurrency}). Using ${this.concurrency} clients.`);
    }
    
    console.log(`Running full-text search benchmark with ${searchCount} search terms...`);
    
    // Create index using the first MongoDB client
    try {
      await this.mongoDbs[0].collection('users').createIndex({ "orders.items.product": "text" });
      console.log('MongoDB text index created or already exists');
    } catch (error) {
      console.error('Error creating MongoDB text index:', error);
    }

    // Aggregate results across all search terms
    let totalMongoTime = 0;
    let totalPgTime = 0;
    const allSearchTerms: string[] = [];
    
    // Run multiple searches based on searchCount
    for (let i = 0; i < searchCount; i++) {
      const searchTerm = faker.word.sample();
      allSearchTerms.push(searchTerm);
      console.log(`\nSearch #${i+1} of ${searchCount} - Term: "${searchTerm}"`);
      
      // Data points for visualization
      const mongoDataPoints: { time: number; operations: number }[] = [];
      const pgDataPoints: { time: number; operations: number }[] = [];
      const totalOperations = this.concurrency; // One search per client
      
      // MongoDB test - simple text search
      console.log(`Performing MongoDB text search for term: "${searchTerm}"`);
      const mongoStartTime = performance.now();
      const mongoStartUsage = this.getResourceUsage();
      // Add starting point
      mongoDataPoints.push({ time: 0, operations: 0 });

      // Track progress for MongoDB text searches
      let mongoCompleted = 0;
      const mongoPromises = this.mongoDbs.map(db => {
        const mongoCollection = db.collection('users');
        return (async () => {
          await mongoCollection.find(
            { $text: { $search: searchTerm } },
            { projection: { score: { $meta: "textScore" } } }
          ).sort({ score: { $meta: "textScore" } }).limit(20).toArray();
          mongoCompleted++;
          const currentTime = (performance.now() - mongoStartTime) / 1000;
          mongoDataPoints.push({ time: currentTime, operations: mongoCompleted });
        })();
      });

      await Promise.all(mongoPromises);
      const mongoTime = (performance.now() - mongoStartTime) / 1000;
      totalMongoTime += mongoTime;
      // Ensure we have the final point
      mongoDataPoints.push({ time: mongoTime, operations: totalOperations });
      
      const mongoResult = await this.mongoDbs[0].collection('users').find(
        { $text: { $search: searchTerm } },
        { projection: { score: { $meta: "textScore" } } }
      ).sort({ score: { $meta: "textScore" } }).limit(20).toArray();
      console.log(`MongoDB found ${mongoResult.length} results in ${mongoTime.toFixed(2)} seconds`);
      this.logResourceUsage('Text Search', 'MongoDB', mongoStartUsage);
      
      // PostgreSQL test - full-text search
      console.log(`Performing PostgreSQL text search for term: "${searchTerm}"`);
      const pgStartTime = performance.now();
      const pgStartUsage = this.getResourceUsage();
      // Add starting point
      pgDataPoints.push({ time: 0, operations: 0 });

      // Track progress for PostgreSQL text searches
      let pgCompleted = 0;
      const pgPromises = this.pgClients.map(client => 
        (async () => {
          await client.query(`SELECT id, data FROM users, jsonb_array_elements(data->'orders') as o, jsonb_array_elements(o->'items') as i WHERE i->>'product' ILIKE $1 LIMIT 20`, [`%${searchTerm}%`]);
          pgCompleted++;
          const currentTime = (performance.now() - pgStartTime) / 1000;
          pgDataPoints.push({ time: currentTime, operations: pgCompleted });
        })()
      );

      await Promise.all(pgPromises);
      const pgTime = (performance.now() - pgStartTime) / 1000;
      totalPgTime += pgTime;
      // Ensure we have the final point
      pgDataPoints.push({ time: pgTime, operations: totalOperations });
      
      const pgResult = await this.pgClients[0].query(`SELECT id, data FROM users, jsonb_array_elements(data->'orders') as o, jsonb_array_elements(o->'items') as i WHERE i->>'product' ILIKE $1 LIMIT 20`, [`%${searchTerm}%`]);
      console.log(`PostgreSQL found ${pgResult.rowCount} results in ${pgTime.toFixed(2)} seconds`);
      this.logResourceUsage('Text Search', 'PostgreSQL', pgStartUsage);
      
      // Skip generating individual search charts as requested by user
      // We'll only generate the summary chart at the end
      
      // More complex search patterns (only for the first search term if multiple)
      if (i === 0) {
        console.log('\nRunning complex pattern search...');
        
        // MongoDB regex search
        const mongoRegexStartTime = performance.now();
        const mongoRegexStartUsage = this.getResourceUsage();
        await Promise.all(this.mongoDbs.map(db => {
          const mongoCollection = db.collection('users');
          return mongoCollection.find({ 'orders.items.product': { $regex: new RegExp(searchTerm, 'i') } }).limit(20).toArray();
        }));
        const mongoRegexTime = (performance.now() - mongoRegexStartTime) / 1000;
        const mongoRegexResult = await this.mongoDbs[0].collection('users').find({ 'orders.items.product': { $regex: new RegExp(searchTerm, 'i') } }).limit(20).toArray();
        console.log(`MongoDB regex search found ${mongoRegexResult.length} results in ${mongoRegexTime.toFixed(2)} seconds`);
        this.logResourceUsage('Regex Search', 'MongoDB', mongoRegexStartUsage);
        
        // PostgreSQL trigram similarity search
        const pgSimilarityStartTime = performance.now();
        const pgSimilarityStartUsage = this.getResourceUsage();
        await Promise.all(this.pgClients.map(client => 
          client.query(`SELECT id, data, similarity(i->>'product', $1) as sim_score FROM users, jsonb_array_elements(data->'orders') as o, jsonb_array_elements(o->'items') as i WHERE similarity(i->>'product', $1) > 0.3 ORDER BY sim_score DESC LIMIT 20`, [searchTerm])
        ));
        const pgSimilarityTime = (performance.now() - pgSimilarityStartTime) / 1000;
        const pgSimilarityResult = await this.pgClients[0].query(`SELECT id, data, similarity(i->>'product', $1) as sim_score FROM users, jsonb_array_elements(data->'orders') as o, jsonb_array_elements(o->'items') as i WHERE similarity(i->>'product', $1) > 0.3 ORDER BY sim_score DESC LIMIT 20`, [searchTerm]);
        console.log(`PostgreSQL similarity search found ${pgSimilarityResult.rowCount} results in ${pgSimilarityTime.toFixed(2)} seconds`);
        this.logResourceUsage('Similarity Search', 'PostgreSQL', pgSimilarityStartUsage);
      }
    }
    
    // Generate summary visualization if multiple search terms were used
    if (searchCount > 1) {
      const avgMongoTime = totalMongoTime / searchCount;
      const avgPgTime = totalPgTime / searchCount;
      console.log(`\nSummary: Ran ${searchCount} search terms`);
      console.log(`Average MongoDB search time: ${avgMongoTime.toFixed(2)} seconds`);
      console.log(`Average PostgreSQL search time: ${avgPgTime.toFixed(2)} seconds`);
      
      // Generate a summary chart
      await this.visualizer.generateSearchSummaryChart(
        avgMongoTime,
        avgPgTime,
        this.concurrency,
        searchCount,
        allSearchTerms
      );
    } else {
      // For a single search, we'll still generate a summary chart
      // but we'll skip the individual search chart as requested
      console.log(`\nSummary: Single search term "${allSearchTerms[0]}"`); 
      console.log(`MongoDB search time: ${totalMongoTime.toFixed(2)} seconds`);
      console.log(`PostgreSQL search time: ${totalPgTime.toFixed(2)} seconds`);
      
      // Generate a summary-style chart for the single search
      await this.visualizer.generateSearchSummaryChart(
        totalMongoTime,
        totalPgTime,
        this.concurrency,
        1,
        allSearchTerms
      );
    }
    
    // Return the results
    return {
      mongoTime: totalMongoTime / searchCount, // Average time per search
      pgTime: totalPgTime / searchCount,       // Average time per search
      mongoOpsPerSecond: (this.concurrency * searchCount) / totalMongoTime,
      pgOpsPerSecond: (this.concurrency * searchCount) / totalPgTime,
      concurrency: this.concurrency,
      searchCount,
      searchTerms: allSearchTerms,
      mongoDataPoints: [], // We don't collect these for the summary
      pgDataPoints: []     // We don't collect these for the summary
    };
  }
  
  async close(): Promise<void> {
    // Close all clients in parallel
    await Promise.all([
      ...this.mongoClients.map(client => client.close()),
      ...this.pgClients.map(client => client.end())
    ]);
    console.log(`Closed ${this.concurrency} MongoDB and PostgreSQL clients`);
  }
}

const program = new Command();

program
  .name('nosql-benchmark')
  .description('NoSQL Database Benchmark Tool')
  .version('1.0.0');

program.command('insert-test')
  .description('Run document insert performance test')
  .option('--count <number>', 'Number of documents to insert', '1000000')
  .option('--concurrency <number>', 'Number of concurrent clients', '25')
  .action(async (options) => {
    const concurrency = parseInt(options.concurrency);
    const benchmark = new DatabaseBenchmark(concurrency);
    try {
      await benchmark.connect();
      await benchmark.setupPostgres();
      await benchmark.insertTest(parseInt(options.count), concurrency);
    } finally {
      await benchmark.close();
    }
  });

program.command('complex-query')
  .description('Run complex JSON query performance test')
  .option('--concurrency <number>', 'Number of concurrent clients', '25')
  .action(async (options) => {
    const concurrency = parseInt(options.concurrency);
    const benchmark = new DatabaseBenchmark(concurrency);
    try {
      await benchmark.connect();
      await benchmark.complexQuery(concurrency);
    } finally {
      await benchmark.close();
    }
  });

program.command('aggregation')
  .description('Run aggregation and filtering test')
  .option('--concurrency <number>', 'Number of concurrent clients', '25')
  .action(async (options) => {
    const concurrency = parseInt(options.concurrency);
    const benchmark = new DatabaseBenchmark(concurrency);
    try {
      await benchmark.connect();
      await benchmark.aggregation(concurrency);
    } finally {
      await benchmark.close();
    }
  });

program.command('full-text-search')
  .description('Run full-text search benchmark')
  .option('-c, --concurrency <number>', 'Number of concurrent clients', '25')
  .option('-n, --count <number>', 'Number of search terms to test', '1')
  .action(async (options) => {
    const concurrency = parseInt(options.concurrency);
    const searchCount = parseInt(options.count);
    const benchmark = new DatabaseBenchmark(concurrency);
    try {
      await benchmark.connect();
      await benchmark.setupPostgres(); // Ensure indexes are created
      await benchmark.fullTextSearch(concurrency, searchCount);
    } finally {
      await benchmark.close();
    }
  });

  program.command('wipe-data')
  .description('Wipe all data from MongoDB and PostgreSQL databases')
  .action(async () => {
    const benchmark = new DatabaseBenchmark(1); // Just need one connection
    try {
      await benchmark.connect();
      console.log('Wiping all data from databases...');
      
      // Wipe MongoDB
      const mongoDb = benchmark.mongoDbs[0];
      await mongoDb.collection('users').deleteMany({});
      console.log('MongoDB data wiped successfully');
      
      // Wipe PostgreSQL
      await benchmark.pgClients[0].query('TRUNCATE TABLE users RESTART IDENTITY');
      console.log('PostgreSQL data wiped successfully');
    } catch (error) {
      console.error('Error wiping data:', error);
    } finally {
      await benchmark.close();
    }
  });

  program.command('check-empty')
  .description('Check if MongoDB and PostgreSQL databases are empty')
  .action(async () => {
    const benchmark = new DatabaseBenchmark(1); // Just need one connection
    try {
      await benchmark.connect();
      
      // Check MongoDB
      const mongoDb = benchmark.mongoDbs[0];
      const mongoCount = await mongoDb.collection('users').countDocuments();
      console.log(`MongoDB users collection has ${mongoCount} documents`);
      
      // Check PostgreSQL
      const pgResult = await benchmark.pgClients[0].query('SELECT COUNT(*) FROM users');
      const pgCount = parseInt(pgResult.rows[0].count);
      console.log(`PostgreSQL users table has ${pgCount} rows`);
      
      if (mongoCount === 0 && pgCount === 0) {
        console.log('Both databases are empty');
      } else {
        console.log('One or both databases contain data');
      }
    } catch (error) {
      console.error('Error checking databases:', error);
    } finally {
      await benchmark.close();
    }
  })

program.parse();