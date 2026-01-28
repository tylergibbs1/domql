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
  .option('--no-headers', 'Omit headers in CSV/table output')
  .option('--js', 'Enable JavaScript rendering', true)
  .option('--no-js', 'Disable JavaScript rendering')
  .option('--wait <ms>', 'Wait time after page load (ms)', '0')
  .option('--timeout <ms>', 'Page load timeout (ms)', '30000')
  .option('--verbose', 'Verbose logging', false)
  .action(async (url, query, options) => {
    try {
      const validFormats = ['table', 'json', 'csv', 'jsonl'];
      if (!validFormats.includes(options.format)) {
        console.error(`Error: Invalid format '${options.format}'. Use one of: ${validFormats.join(', ')}`);
        process.exit(1);
      }

      if (options.verbose) {
        console.error('[INFO] Querying:', url);
        console.error('[INFO] Query:', query);
      }

      const result = await executeQuery(url, query, {
        enableJs: options.js,
        waitMs: parseInt(options.wait, 10),
        timeout: parseInt(options.timeout, 10),
        verbose: options.verbose
      });

      const output = formatOutput(result, {
        format: options.format,
        includeHeaders: options.headers
      });

      if (options.output) {
        await Bun.write(options.output, output);
        if (options.verbose) {
          console.error(`[INFO] Output written to: ${options.output}`);
        }
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
