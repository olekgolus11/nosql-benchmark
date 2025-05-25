/**
 * Common interfaces for the NoSQL Benchmark tool
 */

// Data point for visualization
export interface DataPoint {
  time: number; // Time in seconds
  operations: number; // Cumulative operations completed
}

// Visualization data structure
export interface VisualizationData {
  mongoData: DataPoint[];
  pgData: DataPoint[];
  title: string;
  outputPath: string;
}

// User data structure for generating test data
export interface UserData {
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

// Resource usage information
export interface ResourceUsage {
  cpu: {
    user: number;
    system: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    memoryUsagePercent: number;
  };
}

// Result interfaces for benchmark tests
export interface InsertTestResult {
  mongoTime: number;
  pgTime: number;
  mongoOpsPerSecond: number;
  pgOpsPerSecond: number;
  count: number;
  concurrency: number;
  mongoDataPoints: DataPoint[];
  pgDataPoints: DataPoint[];
}

export interface ComplexQueryResult {
  mongoTime: number;
  pgTime: number;
  mongoOpsPerSecond: number;
  pgOpsPerSecond: number;
  concurrency: number;
  mongoDataPoints: DataPoint[];
  pgDataPoints: DataPoint[];
}

export interface AggregationResult {
  mongoTime: number;
  pgTime: number;
  mongoOpsPerSecond: number;
  pgOpsPerSecond: number;
  concurrency: number;
  mongoDataPoints: DataPoint[];
  pgDataPoints: DataPoint[];
}

export interface FullTextSearchResult {
  mongoTime: number;
  pgTime: number;
  mongoOpsPerSecond: number;
  pgOpsPerSecond: number;
  concurrency: number;
  searchCount: number;
  searchTerms: string[];
  mongoDataPoints: DataPoint[];
  pgDataPoints: DataPoint[];
}

// Test result for comprehensive benchmark
export interface TestResult {
  testType: string;
  configuration: {
    concurrency: number;
    count?: number;
    searchTerms?: string[];
    emptyDatabase: boolean;
  };
  results: {
    mongodb: {
      time: number;
      opsPerSecond: number;
      resourceUsage?: any;
    };
    postgresql: {
      time: number;
      opsPerSecond: number;
      resourceUsage?: any;
    };
  };
  timestamp: string;
}
