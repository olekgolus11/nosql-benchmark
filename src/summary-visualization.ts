import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { TestResult } from './interfaces';

export class SummaryVisualizer {
  private width = 1200;
  private height = 800;
  private chartJSNodeCanvas: ChartJSNodeCanvas;
  private outputDir: string;

  constructor() {
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: this.width,
      height: this.height,
      backgroundColour: 'white',
    });

    this.outputDir = path.join(process.cwd(), 'outputs', 'visualizations');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate a summary chart comparing MongoDB and PostgreSQL performance across different concurrency levels
   */
  async generateConcurrencyComparisonChart(results: TestResult[], testType: string): Promise<string> {
    // Filter results for the specified test type
    const filteredResults = results.filter(result => result.testType === testType);
    
    if (filteredResults.length === 0) {
      console.log(`No results found for test type: ${testType}`);
      return '';
    }
    
    // Group results by concurrency
    const concurrencyGroups = new Map<number, TestResult[]>();
    filteredResults.forEach(result => {
      const concurrency = result.configuration.concurrency;
      if (!concurrencyGroups.has(concurrency)) {
        concurrencyGroups.set(concurrency, []);
      }
      concurrencyGroups.get(concurrency)!.push(result);
    });
    
    // Calculate average performance for each concurrency level
    const concurrencyLevels: number[] = [];
    const mongoAvgOps: number[] = [];
    const pgAvgOps: number[] = [];
    
    concurrencyGroups.forEach((results, concurrency) => {
      concurrencyLevels.push(concurrency);
      
      const mongoOpsSum = results.reduce((sum, result) => sum + result.results.mongodb.opsPerSecond, 0);
      const pgOpsSum = results.reduce((sum, result) => sum + result.results.postgresql.opsPerSecond, 0);
      
      mongoAvgOps.push(mongoOpsSum / results.length);
      pgAvgOps.push(pgOpsSum / results.length);
    });
    
    // Sort data by concurrency level
    const sortedIndices = concurrencyLevels.map((_, i) => i)
      .sort((a, b) => concurrencyLevels[a] - concurrencyLevels[b]);
    
    const sortedConcurrencyLevels = sortedIndices.map(i => concurrencyLevels[i]);
    const sortedMongoAvgOps = sortedIndices.map(i => mongoAvgOps[i]);
    const sortedPgAvgOps = sortedIndices.map(i => pgAvgOps[i]);
    
    // Create a bar chart comparing performance across concurrency levels
    const testTypeLabels: Record<string, string> = {
      'insert': 'Document Insertion',
      'complex-query': 'Complex Query',
      'aggregation': 'Aggregation',
      'full-text-search': 'Full-Text Search'
    };
    
    const title = `${testTypeLabels[testType] || testType} Performance by Concurrency Level`;
    
    const configuration = {
      type: 'bar',
      data: {
        labels: sortedConcurrencyLevels.map(c => `${c} client${c > 1 ? 's' : ''}`),
        datasets: [
          {
            label: 'MongoDB (ops/sec)',
            data: sortedMongoAvgOps,
            backgroundColor: 'rgba(0, 128, 0, 0.6)',
            borderColor: 'green',
            borderWidth: 1
          },
          {
            label: 'PostgreSQL (ops/sec)',
            data: sortedPgAvgOps,
            backgroundColor: 'rgba(0, 0, 255, 0.6)',
            borderColor: 'blue',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: title,
            font: {
              size: 18
            }
          },
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                return `${label}: ${value.toFixed(2)} ops/sec`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Concurrency Level'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Operations per Second'
            },
            beginAtZero: true
          }
        }
      }
    };
    
    const outputPath = path.join(this.outputDir, `${testType}_concurrency_comparison.png`);
    const buffer = await this.chartJSNodeCanvas.renderToBuffer(configuration as any);
    fs.writeFileSync(outputPath, buffer);
    console.log(`Concurrency comparison chart saved to ${outputPath}`);
    
    return outputPath;
  }

  /**
   * Generate a summary chart comparing empty vs. populated database performance for insert tests
   */
  async generateDatabaseStateComparisonChart(results: TestResult[]): Promise<string> {
    // Filter results for insert tests only
    const insertResults = results.filter(result => result.testType === 'insert');
    
    if (insertResults.length === 0) {
      console.log('No insert test results found');
      return '';
    }
    
    // Group results by database state (empty vs. populated)
    const emptyDbResults = insertResults.filter(result => result.configuration.emptyDatabase);
    const populatedDbResults = insertResults.filter(result => !result.configuration.emptyDatabase);
    
    if (emptyDbResults.length === 0 || populatedDbResults.length === 0) {
      console.log('Insufficient data for database state comparison');
      return '';
    }
    
    // Calculate average performance for each database state
    const calculateAvgPerformance = (results: TestResult[]) => {
      const mongoOpsSum = results.reduce((sum, result) => sum + result.results.mongodb.opsPerSecond, 0);
      const pgOpsSum = results.reduce((sum, result) => sum + result.results.postgresql.opsPerSecond, 0);
      
      return {
        mongo: mongoOpsSum / results.length,
        pg: pgOpsSum / results.length
      };
    };
    
    const emptyDbPerformance = calculateAvgPerformance(emptyDbResults);
    const populatedDbPerformance = calculateAvgPerformance(populatedDbResults);
    
    // Create a bar chart comparing performance between empty and populated databases
    const configuration = {
      type: 'bar',
      data: {
        labels: ['Empty Database', 'Populated Database'],
        datasets: [
          {
            label: 'MongoDB (ops/sec)',
            data: [emptyDbPerformance.mongo, populatedDbPerformance.mongo],
            backgroundColor: 'rgba(0, 128, 0, 0.6)',
            borderColor: 'green',
            borderWidth: 1
          },
          {
            label: 'PostgreSQL (ops/sec)',
            data: [emptyDbPerformance.pg, populatedDbPerformance.pg],
            backgroundColor: 'rgba(0, 0, 255, 0.6)',
            borderColor: 'blue',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Insert Performance: Empty vs. Populated Database',
            font: {
              size: 18
            }
          },
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                return `${label}: ${value.toFixed(2)} ops/sec`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Database State'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Operations per Second'
            },
            beginAtZero: true
          }
        }
      }
    };
    
    const outputPath = path.join(this.outputDir, 'insert_database_state_comparison.png');
    const buffer = await this.chartJSNodeCanvas.renderToBuffer(configuration as any);
    fs.writeFileSync(outputPath, buffer);
    console.log(`Database state comparison chart saved to ${outputPath}`);
    
    return outputPath;
  }

  /**
   * Generate a summary chart comparing all test types with their best configurations
   */
  async generateTestTypeComparisonChart(results: TestResult[]): Promise<string> {
    const testTypes = ['insert', 'complex-query', 'aggregation', 'full-text-search'];
    const testTypeLabels: Record<string, string> = {
      'insert': 'Document Insertion',
      'complex-query': 'Complex Query',
      'aggregation': 'Aggregation',
      'full-text-search': 'Full-Text Search'
    };
    
    // Find the best configuration (highest ops/sec) for each test type
    const bestConfigs: Record<string, { mongo: number, pg: number }> = {};
    
    testTypes.forEach(testType => {
      const typeResults = results.filter(result => result.testType === testType);
      
      if (typeResults.length > 0) {
        // Find the best MongoDB configuration
        const bestMongoResult = typeResults.reduce((best, current) => 
          current.results.mongodb.opsPerSecond > best.results.mongodb.opsPerSecond ? current : best
        , typeResults[0]);
        
        // Find the best PostgreSQL configuration
        const bestPgResult = typeResults.reduce((best, current) => 
          current.results.postgresql.opsPerSecond > best.results.postgresql.opsPerSecond ? current : best
        , typeResults[0]);
        
        bestConfigs[testType] = {
          mongo: bestMongoResult.results.mongodb.opsPerSecond,
          pg: bestPgResult.results.postgresql.opsPerSecond
        };
      }
    });
    
    // Prepare data for the chart
    const labels = Object.keys(bestConfigs).map(type => testTypeLabels[type] || type);
    const mongoData = Object.values(bestConfigs).map(config => config.mongo);
    const pgData = Object.values(bestConfigs).map(config => config.pg);
    
    if (labels.length === 0) {
      console.log('No test results found');
      return '';
    }
    
    // Create a bar chart comparing best performance across test types
    const configuration = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'MongoDB (ops/sec)',
            data: mongoData,
            backgroundColor: 'rgba(0, 128, 0, 0.6)',
            borderColor: 'green',
            borderWidth: 1
          },
          {
            label: 'PostgreSQL (ops/sec)',
            data: pgData,
            backgroundColor: 'rgba(0, 0, 255, 0.6)',
            borderColor: 'blue',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Best Performance by Test Type',
            font: {
              size: 18
            }
          },
          legend: {
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                return `${label}: ${value.toFixed(2)} ops/sec`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Test Type'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Operations per Second'
            },
            beginAtZero: true
          }
        }
      }
    };
    
    const outputPath = path.join(this.outputDir, 'test_type_comparison.png');
    const buffer = await this.chartJSNodeCanvas.renderToBuffer(configuration as any);
    fs.writeFileSync(outputPath, buffer);
    console.log(`Test type comparison chart saved to ${outputPath}`);
    
    return outputPath;
  }

  /**
   * Generate all summary visualizations from the test results
   */
  async generateAllSummaryVisualizations(resultsFilePath: string): Promise<void> {
    console.log(`Generating summary visualizations from ${resultsFilePath}...`);
    
    // Load test results from JSON file
    const resultsJson = fs.readFileSync(resultsFilePath, 'utf8');
    const results: TestResult[] = JSON.parse(resultsJson);
    
    if (results.length === 0) {
      console.log('No test results found');
      return;
    }
    
    // Generate all summary visualizations
    await this.generateConcurrencyComparisonChart(results, 'insert');
    await this.generateConcurrencyComparisonChart(results, 'complex-query');
    await this.generateConcurrencyComparisonChart(results, 'aggregation');
    await this.generateConcurrencyComparisonChart(results, 'full-text-search');
    await this.generateDatabaseStateComparisonChart(results);
    await this.generateTestTypeComparisonChart(results);
    
    console.log('All summary visualizations generated successfully');
  }
}

// Command line interface for generating summary visualizations
if (require.main === module) {
  const program = new Command();
  
  program
    .name('summary-visualization')
    .description('Generate summary visualizations from benchmark results')
    .version('1.0.0');
  
  program.command('generate')
    .description('Generate summary visualizations from a results JSON file')
    .argument('<file>', 'Path to the results JSON file')
    .action(async (file: string) => {
      const visualizer = new SummaryVisualizer();
      await visualizer.generateAllSummaryVisualizations(file);
    });
  
  program.parse();
}
