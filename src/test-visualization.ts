import { BenchmarkVisualizer } from './visualization';

async function testVisualization() {
  console.log('Testing visualization module...');
  
  const visualizer = new BenchmarkVisualizer();
  
  // Test with sample data for insert operation
  const mongoTime = 5.2; // 5.2 seconds
  const pgTime = 4.8; // 4.8 seconds
  const count = 1000;
  const concurrency = 25;
  
  try {
    // Generate insert chart
    console.log('Generating insert chart...');
    const insertChartPath = await visualizer.generateInsertChart(mongoTime, pgTime, count, concurrency);
    console.log(`Insert chart generated successfully at: ${insertChartPath}`);
    
    // Generate query chart
    console.log('\nGenerating query chart...');
    const queryChartPath = await visualizer.generateQueryChart(mongoTime, pgTime, concurrency);
    console.log(`Query chart generated successfully at: ${queryChartPath}`);
    
    // Generate aggregation chart
    console.log('\nGenerating aggregation chart...');
    const aggregationChartPath = await visualizer.generateAggregationChart(mongoTime, pgTime, concurrency);
    console.log(`Aggregation chart generated successfully at: ${aggregationChartPath}`);
    
    // Generate search chart
    console.log('\nGenerating search chart...');
    const searchTerm = 'test';
    const searchChartPath = await visualizer.generateSearchChart(mongoTime, pgTime, concurrency, searchTerm);
    console.log(`Search chart generated successfully at: ${searchChartPath}`);
    
    console.log('\nAll charts generated successfully!');
  } catch (error) {
    console.error('Error generating charts:', error);
  }
}

testVisualization();