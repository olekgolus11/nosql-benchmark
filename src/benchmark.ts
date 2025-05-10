import { Command } from 'commander';
import { config } from 'dotenv';
import { MongoClient, Db } from 'mongodb';
import pg from 'pg';
import { faker } from '@faker-js/faker';
import os from 'os';

// Load environment variables
config();

// Database connection settings
const MONGO_URI = 'mongodb://root:example@localhost:27017/';
const PG_CONNECTION = 'postgresql://root:example@localhost:5432/benchmark';

interface UserData {
  name: string;
  email: string;
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
    };
  };
  orders: Array<{
    amount: number;
    date: string;
    items: Array<{
      product: string;
      quantity: number;
    }>;
  }>;
}

class DatabaseBenchmark {
  private mongoClient: MongoClient;
  private mongoDB: Db;
  private pgClient: pg.Client;

  constructor() {
    this.mongoClient = new MongoClient(MONGO_URI);
    this.mongoDB = this.mongoClient.db('benchmark');
    this.pgClient = new pg.Client(PG_CONNECTION);
  }

  async connect(): Promise<void> {
    await this.mongoClient.connect();
    await this.pgClient.connect();
  }

  async setupPostgres(): Promise<void> {
    await this.pgClient.query(`
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

  async insertTest(count: number, concurrency: number = 25): Promise<void> {
    const CONCURRENCY = concurrency;
    const docsPerClient = Math.floor(count / CONCURRENCY);
    const remainder = count % CONCURRENCY;
    console.log(`Running insert test with ${count} documents using ${CONCURRENCY} concurrent clients...`);
    const mongoCollection = this.mongoDB.collection('users');

    // MongoDB test
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, (_, clientIdx) => {
      const myCount = docsPerClient + (clientIdx < remainder ? 1 : 0);
      return (async () => {
        for (let i = 0; i < myCount; i++) {
          const userData = this.generateUserData();
          await mongoCollection.insertOne(userData);
        }
      })();
    }));
    const mongoTime = (performance.now() - mongoStartTime) / 1000;
    console.log(`\nMongoDB: ${count} documents inserted in ${mongoTime.toFixed(2)} seconds`);
    console.log(`MongoDB average insert speed: ${(count / mongoTime).toFixed(2)} docs/sec`);
    this.logResourceUsage('Insert', 'MongoDB', mongoStartUsage);

    // PostgreSQL test
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, (_, clientIdx) => {
      const myCount = docsPerClient + (clientIdx < remainder ? 1 : 0);
      return (async () => {
        for (let i = 0; i < myCount; i++) {
          const userData = this.generateUserData();
          await this.pgClient.query('INSERT INTO users (data) VALUES ($1)', [userData]);
        }
      })();
    }));
    const pgTime = (performance.now() - pgStartTime) / 1000;
    console.log(`\nPostgreSQL: ${count} documents inserted in ${pgTime.toFixed(2)} seconds`);
    console.log(`PostgreSQL average insert speed: ${(count / pgTime).toFixed(2)} docs/sec`);
    this.logResourceUsage('Insert', 'PostgreSQL', pgStartUsage);
  }

  async complexQuery(concurrency: number = 25): Promise<void> {
    const CONCURRENCY = concurrency;
    console.log('Running complex query test...');
    const mongoCollection = this.mongoDB.collection('users');

    // MongoDB test
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, () =>
      mongoCollection.find({ 'preferences.notifications.email': true }).explain()
    ));
    const mongoTime = (performance.now() - mongoStartTime) / 1000;
    console.log(`\nMongoDB query time: ${mongoTime.toFixed(2)} seconds`);
    // Only print one plan for brevity
    const mongoResult = await mongoCollection.find({ 'preferences.notifications.email': true }).explain();
    console.log('MongoDB query plan:', mongoResult);
    this.logResourceUsage('Query', 'MongoDB', mongoStartUsage);

    // PostgreSQL test
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, () =>
      this.pgClient.query(`EXPLAIN ANALYZE SELECT * FROM users WHERE data->'preferences'->'notifications'->>'email' = 'true'`)
    ));
    const pgTime = (performance.now() - pgStartTime) / 1000;
    console.log(`\nPostgreSQL query time: ${pgTime.toFixed(2)} seconds`);
    const pgResult = await this.pgClient.query(`EXPLAIN ANALYZE SELECT * FROM users WHERE data->'preferences'->'notifications'->>'email' = 'true'`);
    console.log('PostgreSQL query plan:');
    pgResult.rows.forEach(row => console.log(row));
    this.logResourceUsage('Query', 'PostgreSQL', pgStartUsage);
  }

  async aggregation(concurrency: number = 25): Promise<void> {
    const CONCURRENCY = concurrency;
    console.log('Running aggregation test...');
    const mongoCollection = this.mongoDB.collection('users');

    // MongoDB test
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, () =>
      mongoCollection.aggregate([
        { $unwind: '$orders' },
        { $group: { _id: '$_id', total_amount: { $sum: '$orders.amount' } } }
      ]).toArray()
    ));
    const mongoTime = (performance.now() - mongoStartTime) / 1000;
    console.log(`\nMongoDB aggregation time: ${mongoTime.toFixed(2)} seconds`);
    this.logResourceUsage('Aggregation', 'MongoDB', mongoStartUsage);

    // PostgreSQL test
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, () =>
      this.pgClient.query(`SELECT (data->>'_id') as user_id, SUM(CAST(order_data->>'amount' AS DECIMAL)) FROM users, jsonb_array_elements(data->'orders') AS order_data GROUP BY user_id;`)
    ));
    const pgTime = (performance.now() - pgStartTime) / 1000;
    console.log(`\nPostgreSQL aggregation time: ${pgTime.toFixed(2)} seconds`);
    this.logResourceUsage('Aggregation', 'PostgreSQL', pgStartUsage);
  }

  async fullTextSearch(concurrency: number = 25): Promise<void> {
    const CONCURRENCY = concurrency;
    console.log('Running full-text search benchmark...');
    const mongoCollection = this.mongoDB.collection('users');
    const searchTerm = faker.word.sample();
    try {
      await mongoCollection.createIndex({ "orders.items.product": "text" });
      console.log('MongoDB text index created or already exists');
    } catch (error) {
      console.error('Error creating MongoDB text index:', error);
    }
    // MongoDB test - simple text search
    console.log(`\nPerforming MongoDB text search for term: "${searchTerm}"`);
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, () =>
      mongoCollection.find(
        { $text: { $search: searchTerm } },
        { projection: { score: { $meta: "textScore" } } }
      ).sort({ score: { $meta: "textScore" } }).limit(20).toArray()
    ));
    const mongoTime = (performance.now() - mongoStartTime) / 1000;
    const mongoResult = await mongoCollection.find(
      { $text: { $search: searchTerm } },
      { projection: { score: { $meta: "textScore" } } }
    ).sort({ score: { $meta: "textScore" } }).limit(20).toArray();
    console.log(`MongoDB found ${mongoResult.length} results in ${mongoTime.toFixed(2)} seconds`);
    this.logResourceUsage('Text Search', 'MongoDB', mongoStartUsage);
    // PostgreSQL test - full-text search
    console.log(`\nPerforming PostgreSQL text search for term: "${searchTerm}"`);
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, () =>
      this.pgClient.query(`SELECT id, data FROM users, jsonb_array_elements(data->'orders') as o, jsonb_array_elements(o->'items') as i WHERE i->>'product' ILIKE $1 LIMIT 20`, [`%${searchTerm}%`])
    ));
    const pgTime = (performance.now() - pgStartTime) / 1000;
    const pgResult = await this.pgClient.query(`SELECT id, data FROM users, jsonb_array_elements(data->'orders') as o, jsonb_array_elements(o->'items') as i WHERE i->>'product' ILIKE $1 LIMIT 20`, [`%${searchTerm}%`]);
    console.log(`PostgreSQL found ${pgResult.rowCount} results in ${pgTime.toFixed(2)} seconds`);
    this.logResourceUsage('Text Search', 'PostgreSQL', pgStartUsage);
    // More complex search patterns
    console.log('\nRunning complex pattern search...');
    // MongoDB regex search
    const mongoRegexStartTime = performance.now();
    const mongoRegexStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, () =>
      mongoCollection.find({ 'orders.items.product': { $regex: new RegExp(searchTerm, 'i') } }).limit(20).toArray()
    ));
    const mongoRegexTime = (performance.now() - mongoRegexStartTime) / 1000;
    const mongoRegexResult = await mongoCollection.find({ 'orders.items.product': { $regex: new RegExp(searchTerm, 'i') } }).limit(20).toArray();
    console.log(`MongoDB regex search found ${mongoRegexResult.length} results in ${mongoRegexTime.toFixed(2)} seconds`);
    this.logResourceUsage('Regex Search', 'MongoDB', mongoRegexStartUsage);
    // PostgreSQL trigram similarity search
    const pgSimilarityStartTime = performance.now();
    const pgSimilarityStartUsage = this.getResourceUsage();
    await Promise.all(Array.from({ length: CONCURRENCY }, () =>
      this.pgClient.query(`SELECT id, data, similarity(i->>'product', $1) as sim_score FROM users, jsonb_array_elements(data->'orders') as o, jsonb_array_elements(o->'items') as i WHERE similarity(i->>'product', $1) > 0.3 ORDER BY sim_score DESC LIMIT 20`, [searchTerm])
    ));
    const pgSimilarityTime = (performance.now() - pgSimilarityStartTime) / 1000;
    const pgSimilarityResult = await this.pgClient.query(`SELECT id, data, similarity(i->>'product', $1) as sim_score FROM users, jsonb_array_elements(data->'orders') as o, jsonb_array_elements(o->'items') as i WHERE similarity(i->>'product', $1) > 0.3 ORDER BY sim_score DESC LIMIT 20`, [searchTerm]);
    console.log(`PostgreSQL similarity search found ${pgSimilarityResult.rowCount} results in ${pgSimilarityTime.toFixed(2)} seconds`);
    this.logResourceUsage('Similarity Search', 'PostgreSQL', pgSimilarityStartUsage);
  }
  
  async close(): Promise<void> {
    await this.mongoClient.close();
    await this.pgClient.end();
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
    const benchmark = new DatabaseBenchmark();
    try {
      await benchmark.connect();
      await benchmark.setupPostgres();
      await benchmark.insertTest(parseInt(options.count), parseInt(options.concurrency));
    } finally {
      await benchmark.close();
    }
  });

program.command('complex-query')
  .description('Run complex JSON query performance test')
  .option('--concurrency <number>', 'Number of concurrent clients', '25')
  .action(async (options) => {
    const benchmark = new DatabaseBenchmark();
    try {
      await benchmark.connect();
      await benchmark.complexQuery(parseInt(options.concurrency));
    } finally {
      await benchmark.close();
    }
  });

program.command('aggregation')
  .description('Run aggregation and filtering test')
  .option('--concurrency <number>', 'Number of concurrent clients', '25')
  .action(async (options) => {
    const benchmark = new DatabaseBenchmark();
    try {
      await benchmark.connect();
      await benchmark.aggregation(parseInt(options.concurrency));
    } finally {
      await benchmark.close();
    }
  });

program.command('full-text-search')
  .description('Run full-text search performance test')
  .option('--concurrency <number>', 'Number of concurrent clients', '25')
  .action(async (options) => {
    const benchmark = new DatabaseBenchmark();
    try {
      await benchmark.connect();
      await benchmark.setupPostgres(); // Ensure indexes are created
      await benchmark.fullTextSearch(parseInt(options.concurrency));
    } finally {
      await benchmark.close();
    }
  });

program.parse();