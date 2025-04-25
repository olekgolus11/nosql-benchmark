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

  async insertTest(count: number): Promise<void> {
    console.log(`Running insert test with ${count} documents...`);
    const mongoCollection = this.mongoDB.collection('users');

    // MongoDB test
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    for (let i = 0; i < count; i++) {
      const userData = this.generateUserData();
      await mongoCollection.insertOne(userData);
      if (i % 100 === 0) process.stdout.write(`\rMongoDB progress: ${Math.round((i / count) * 100)}%`);
    }
    const mongoTime = (performance.now() - mongoStartTime) / 1000;
    console.log(`\nMongoDB: ${count} documents inserted in ${mongoTime.toFixed(2)} seconds`);
    console.log(`MongoDB average insert speed: ${(count / mongoTime).toFixed(2)} docs/sec`);
    this.logResourceUsage('Insert', 'MongoDB', mongoStartUsage);

    // PostgreSQL test
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    for (let i = 0; i < count; i++) {
      const userData = this.generateUserData();
      await this.pgClient.query('INSERT INTO users (data) VALUES ($1)', [userData]);
      if (i % 100 === 0) process.stdout.write(`\rPostgreSQL progress: ${Math.round((i / count) * 100)}%`);
    }
    const pgTime = (performance.now() - pgStartTime) / 1000;
    console.log(`\nPostgreSQL: ${count} documents inserted in ${pgTime.toFixed(2)} seconds`);
    console.log(`PostgreSQL average insert speed: ${(count / pgTime).toFixed(2)} docs/sec`);
    this.logResourceUsage('Insert', 'PostgreSQL', pgStartUsage);
  }

  async complexQuery(): Promise<void> {
    console.log('Running complex query test...');
    const mongoCollection = this.mongoDB.collection('users');

    // MongoDB test
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    const mongoResult = await mongoCollection.find({
      'preferences.notifications.email': true
    }).explain();
    const mongoTime = (performance.now() - mongoStartTime) / 1000;

    console.log(`\nMongoDB query time: ${mongoTime.toFixed(2)} seconds`);
    console.log('MongoDB query plan:', mongoResult);
    this.logResourceUsage('Query', 'MongoDB', mongoStartUsage);

    // PostgreSQL test
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    const pgResult = await this.pgClient.query(`
      EXPLAIN ANALYZE
      SELECT * FROM users
      WHERE data->'preferences'->'notifications'->>'email' = 'true'
    `);
    const pgTime = (performance.now() - pgStartTime) / 1000;

    console.log(`\nPostgreSQL query time: ${pgTime.toFixed(2)} seconds`);
    console.log('PostgreSQL query plan:');
    pgResult.rows.forEach(row => console.log(row));
    this.logResourceUsage('Query', 'PostgreSQL', pgStartUsage);
  }

  async aggregation(): Promise<void> {
    console.log('Running aggregation test...');
    const mongoCollection = this.mongoDB.collection('users');

    // MongoDB test
    const mongoStartTime = performance.now();
    const mongoStartUsage = this.getResourceUsage();
    await mongoCollection.aggregate([
      { $unwind: '$orders' },
      {
        $group: {
          _id: '$_id',
          total_amount: { $sum: '$orders.amount' }
        }
      }
    ]).toArray();
    const mongoTime = (performance.now() - mongoStartTime) / 1000;

    console.log(`\nMongoDB aggregation time: ${mongoTime.toFixed(2)} seconds`);
    this.logResourceUsage('Aggregation', 'MongoDB', mongoStartUsage);

    // PostgreSQL test
    const pgStartTime = performance.now();
    const pgStartUsage = this.getResourceUsage();
    await this.pgClient.query(`
      SELECT 
        (data->>'_id') as user_id,
        SUM(CAST(order_data->>'amount' AS DECIMAL))
      FROM users,
        jsonb_array_elements(data->'orders') AS order_data
      GROUP BY user_id;
    `);
    const pgTime = (performance.now() - pgStartTime) / 1000;

    console.log(`\nPostgreSQL aggregation time: ${pgTime.toFixed(2)} seconds`);
    this.logResourceUsage('Aggregation', 'PostgreSQL', pgStartUsage);
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
  .action(async (options) => {
    const benchmark = new DatabaseBenchmark();
    try {
      await benchmark.connect();
      await benchmark.setupPostgres();
      await benchmark.insertTest(parseInt(options.count));
    } finally {
      await benchmark.close();
    }
  });

program.command('complex-query')
  .description('Run complex JSON query performance test')
  .action(async () => {
    const benchmark = new DatabaseBenchmark();
    try {
      await benchmark.connect();
      await benchmark.complexQuery();
    } finally {
      await benchmark.close();
    }
  });

program.command('aggregation')
  .description('Run aggregation and filtering test')
  .action(async () => {
    const benchmark = new DatabaseBenchmark();
    try {
      await benchmark.connect();
      await benchmark.aggregation();
    } finally {
      await benchmark.close();
    }
  });

program.parse();