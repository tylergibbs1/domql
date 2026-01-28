# domql

SQL syntax for DOM querying - Query web pages like databases.

## Installation

```bash
bun install
bun run build
```

## Usage

```bash
# Basic query
domql https://example.com "SELECT text FROM h1"

# Select attributes
domql https://example.com "SELECT text, @href FROM a"

# With WHERE clause
domql https://example.com "SELECT text, @href FROM a WHERE text LIKE '%blog%'"

# Aggregations
domql https://news.ycombinator.com "SELECT COUNT(*) FROM .athing"

# ORDER BY and LIMIT
domql https://example.com "SELECT text, @price FROM .product ORDER BY price DESC LIMIT 10"

# Output formats
domql https://example.com "SELECT text FROM h2" --format json
domql https://example.com "SELECT text FROM h2" --format csv -o output.csv
```

## Query Syntax

### SELECT clause
- `text` - Element text content
- `@attribute` - Element attribute (e.g., `@href`, `@src`, `@data-id`)
- `.selector` - Nested element selector

### FROM clause
- CSS selector for container elements

### WHERE clause
Operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `NOT LIKE`

```sql
SELECT text FROM .item WHERE price > 100
SELECT text FROM a WHERE text LIKE '%keyword%'
```

### Aggregations
- `COUNT(*)`
- `AVG(field)`
- `MIN(field)`
- `MAX(field)`
- `SUM(field)`

### ORDER BY
```sql
SELECT text FROM .item ORDER BY price DESC
```

### LIMIT
```sql
SELECT text FROM .item LIMIT 10
```

## Options

- `-f, --format <type>` - Output format: table, json, csv, jsonl (default: table)
- `-o, --output <file>` - Write output to file
- `--no-headers` - Omit headers in CSV/table output
- `--js` / `--no-js` - Enable/disable JavaScript rendering (default: enabled)
- `--wait <ms>` - Wait time after page load
- `--timeout <ms>` - Page load timeout (default: 30000)
- `--verbose` - Verbose logging

## Examples

```bash
# Get all article titles
domql https://news.ycombinator.com "SELECT text FROM .titleline > a"

# Get product info with prices
domql https://example.com/shop "SELECT text, @href, .price FROM .product"

# Count items
domql https://example.com "SELECT COUNT(*) FROM .item"

# Filter and sort
domql https://example.com "SELECT text, @data-price FROM .product WHERE @data-price > 50 ORDER BY @data-price ASC LIMIT 5"
```
