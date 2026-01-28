#!/usr/bin/env bun
import { Command } from 'commander';
import { executeQuery } from './executor.js';
import { formatOutput } from './formatter.js';

const program = new Command();

program
  .name('domql')
  .description('SQL syntax for DOM querying')
  .version('0.1.0')
  .argument('<url>', 'URL to query')
  .argument('<query>', 'SQL-like query (e.g., "SELECT text, @href FROM a WHERE text LIKE \'%blog%\'")')
  .option('-f, --format <type>', 'Output format: table, json, csv, jsonl', 'table')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('--no-headers', 'Omit headers in CSV/table output', false)
  .option('--js', 'Enable JavaScript rendering', true)
  .option('--no-js', 'Disable JavaScript rendering')
  .option('--wait <ms>', 'Wait time after page load (ms)', '0')
  .option('--timeout <ms>', 'Page load timeout (ms)', '30000')
  .option('--cache', 'Cache page content for repeated queries', false)
  .option('--verbose', 'Verbose logging', false)
  .action(async (url, query, options) => {
    try {
      if (options.verbose) {
        console.error('🔍 Querying:', url);
        console.error('📝 Query:', query);
      }

      const result = await executeQuery(url, query, {
        enableJs: options.js,
        waitMs: parseInt(options.wait),
        timeout: parseInt(options.timeout),
        verbose: options.verbose
      });

      const output = formatOutput(result, {
        format: options.format,
        includeHeaders: options.headers
      });

      if (options.output) {
        await Bun.write(options.output, output);
        if (options.verbose) {
          console.error(`✅ Output written to: ${options.output}`);
        }
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
