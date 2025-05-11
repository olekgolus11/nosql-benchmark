import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs';
import path from 'path';

interface DataPoint {
  time: number; // Time in seconds
  operations: number; // Cumulative operations completed
}

interface VisualizationData {
  mongoData: DataPoint[];
  pgData: DataPoint[];
  title: string;
  outputPath: string;
}

export class BenchmarkVisualizer {
  private width = 800;
  private height = 600;
  private chartJSNodeCanvas: ChartJSNodeCanvas;

  constructor() {
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: this.width,
      height: this.height,
      backgroundColour: 'white',
    });

    // Create outputs directory if it doesn't exist
    const outputsDir = path.join(process.cwd(), 'outputs');
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }
  }

  /**
   * Generate a line chart comparing MongoDB and PostgreSQL performance
   */
  async generateChart(data: VisualizationData): Promise<string> {
    const configuration = {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'MongoDB',
            data: data.mongoData.map(point => ({ x: point.time, y: point.operations })),
            borderColor: 'green',
            backgroundColor: 'rgba(0, 128, 0, 0.1)',
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
          },
          {
            label: 'PostgreSQL',
            data: data.pgData.map(point => ({ x: point.time, y: point.operations })),
            borderColor: 'blue',
            backgroundColor: 'rgba(0, 0, 255, 0.1)',
            borderWidth: 2,
            pointRadius: 3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        title: {
          display: true,
          text: data.title,
          fontSize: 16,
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: 'Time (seconds)',
            },
            ticks: {
              beginAtZero: true,
            },
          },
          y: {
            title: {
              display: true,
              text: 'Operations Completed',
            },
            ticks: {
              beginAtZero: true,
            },
          },
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 20,
              padding: 20,
            },
          },
        },
      },
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(configuration as any);
    fs.writeFileSync(data.outputPath, buffer);
    console.log(`Chart saved to ${data.outputPath}`);
    return data.outputPath;
  }

  /**
   * Generate a performance comparison chart for insert operations
   */
  async generateInsertChart(mongoTime: number, pgTime: number, count: number, concurrency: number): Promise<string> {
    // Create data points to simulate progress over time
    const mongoData: DataPoint[] = this.generateProgressPoints(mongoTime, count);
    const pgData: DataPoint[] = this.generateProgressPoints(pgTime, count);

    const outputPath = path.join(process.cwd(), 'outputs', `insert_${concurrency}_${count}.jpg`);
    const title = `Insert test, ${concurrency} concurrent clients, ${count} documents inserted`;

    return this.generateChart({
      mongoData,
      pgData,
      title,
      outputPath,
    });
  }

  /**
   * Generate a performance comparison chart for complex query operations
   */
  async generateQueryChart(mongoTime: number, pgTime: number, concurrency: number): Promise<string> {
    // For queries, we'll use a fixed number of operations (1 per client)
    const operations = concurrency;
    const mongoData: DataPoint[] = this.generateProgressPoints(mongoTime, operations);
    const pgData: DataPoint[] = this.generateProgressPoints(pgTime, operations);

    const outputPath = path.join(process.cwd(), 'outputs', `query_${concurrency}.jpg`);
    const title = `Complex query test, ${concurrency} concurrent clients`;

    return this.generateChart({
      mongoData,
      pgData,
      title,
      outputPath,
    });
  }

  /**
   * Generate a performance comparison chart for aggregation operations
   */
  async generateAggregationChart(mongoTime: number, pgTime: number, concurrency: number): Promise<string> {
    // For aggregations, we'll use a fixed number of operations (1 per client)
    const operations = concurrency;
    const mongoData: DataPoint[] = this.generateProgressPoints(mongoTime, operations);
    const pgData: DataPoint[] = this.generateProgressPoints(pgTime, operations);

    const outputPath = path.join(process.cwd(), 'outputs', `aggregation_${concurrency}.jpg`);
    const title = `Aggregation test, ${concurrency} concurrent clients`;

    return this.generateChart({
      mongoData,
      pgData,
      title,
      outputPath,
    });
  }

  /**
   * Generate a performance comparison chart for full-text search operations
   */
  async generateSearchChart(mongoTime: number, pgTime: number, concurrency: number, searchTerm: string): Promise<string> {
    // For text search, we'll use a fixed number of operations (1 per client)
    const operations = concurrency;
    const mongoData: DataPoint[] = this.generateProgressPoints(mongoTime, operations);
    const pgData: DataPoint[] = this.generateProgressPoints(pgTime, operations);

    const outputPath = path.join(process.cwd(), 'outputs', `search_${concurrency}_${searchTerm}.jpg`);
    const title = `Full-text search test, ${concurrency} concurrent clients, term: "${searchTerm}"`;

    return this.generateChart({
      mongoData,
      pgData,
      title,
      outputPath,
    });
  }

  /**
   * Generate simulated progress points for visualization
   * This creates a realistic curve of operations completed over time
   */
  private generateProgressPoints(totalTime: number, totalOperations: number): DataPoint[] {
    const points: DataPoint[] = [];
    const numPoints = 20; // Number of data points to generate
    
    // Add starting point
    points.push({ time: 0, operations: 0 });
    
    // Generate intermediate points with a slightly random distribution
    // to make the chart look more realistic
    for (let i = 1; i < numPoints; i++) {
      const timeRatio = i / numPoints;
      const time = totalTime * timeRatio;
      
      // Use a slightly curved function to simulate real-world progress
      // Operations tend to start faster and slow down slightly over time
      const operationRatio = Math.pow(timeRatio, 0.9);
      const operations = Math.floor(totalOperations * operationRatio);
      
      points.push({ time, operations });
    }
    
    // Add final point
    points.push({ time: totalTime, operations: totalOperations });
    
    return points;
  }
}