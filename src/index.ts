#!/usr/bin/env bun
import { Command } from 'commander';
import { executeQuery } from './executor.js';
import { formatOutput } from './formatter.js';

const program = new Command();

program
  .name('domql')
  .description(`SQL syntax for DOM querying - Query web pages like databases.

domql lets you extract data from any webpage using familiar SQL syntax.
It uses CSS selectors in the FROM clause and supports filtering, sorting,
and aggregation operations.`)
  .version('0.1.0')
  .argument('<url>', 'URL to query (https://, http://, or file://)')
  .argument('<query>', 'SQL query (see syntax below)')
  .option('-f, --format <type>', 'Output format: table, json, csv, jsonl', 'table')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('--no-headers', 'Omit headers in CSV/table output')
  .option('--js', 'Enable JavaScript rendering', true)
  .option('--no-js', 'Disable JavaScript rendering (faster for static pages)')
  .option('--wait <ms>', 'Wait time after page load in ms (for dynamic content)', '0')
  .option('--timeout <ms>', 'Page load timeout in ms', '30000')
  .option('--verbose', 'Verbose logging', false)
  .addHelpText('after', `
Query Syntax:
  SELECT <fields> FROM <selector> [WHERE <conditions>] [ORDER BY <field> [ASC|DESC]] [LIMIT <n>]

SELECT Fields:
  text              Element text content
  @attr             Attribute value (@href, @src, @data-id, @class, etc.)
  .selector         Nested element text (.price, .title, etc.)

FROM Selector:
  CSS selector for target elements. Use quotes for complex selectors:
    FROM .item                    Simple class selector
    FROM "#content .item"         Selector with spaces (quoted)
    FROM [ul > li]                Selector with spaces (bracketed)

WHERE Operators:
  =, !=, >, <, >=, <=            Comparison (numeric or string)
  LIKE 'pattern'                  Pattern match: % = wildcard
                                    'A%' = starts with A
                                    '%z' = ends with z
                                    '%word%' = contains word
  NOT LIKE 'pattern'              Negated pattern match
  IN (val1, val2, ...)            Match any value in list
  REGEXP 'pattern'                Regular expression match
                                    REGEXP '^[A-Z]' = starts with uppercase
                                    REGEXP '(?i)word' = case-insensitive
                                    REGEXP '/pattern/i' = alternate flag syntax
  NOT REGEXP 'pattern'            Negated regex match
  AND, OR                         Combine conditions

Aggregations:
  COUNT()                         Count matching elements
  AVG(field)                      Average of numeric values
  MIN(field), MAX(field)          Min/max values
  SUM(field)                      Sum of numeric values

Examples:
  # Get all links from a page
  domql https://example.com "SELECT text, @href FROM a"

  # Get Hacker News titles and URLs
  domql https://news.ycombinator.com "SELECT text, @href FROM .titleline>a LIMIT 10"

  # Filter with LIKE
  domql https://news.ycombinator.com "SELECT text FROM .titleline>a WHERE text LIKE '%AI%'"

  # Filter with regex (case-insensitive)
  domql https://news.ycombinator.com "SELECT text FROM .titleline>a WHERE text REGEXP '(?i)\\brust\\b'"

  # Get GitHub links only
  domql https://news.ycombinator.com "SELECT text, @href FROM .titleline>a WHERE @href LIKE '%github.com%'"

  # Count elements
  domql https://news.ycombinator.com "SELECT COUNT() FROM .titleline>a"

  # Complex selector with spaces
  domql https://en.wikipedia.org/wiki/Web_scraping 'SELECT text FROM "#mw-content-text p" LIMIT 3'

  # JSON output for piping
  domql https://example.com "SELECT text, @href FROM a" -f json

  # Save to CSV file
  domql https://example.com "SELECT text, @href FROM a" -f csv -o links.csv
`)
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
