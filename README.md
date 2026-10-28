# domql

Query web pages with SQL. domql loads a page in headless Chromium (via Playwright), selects elements with CSS selectors, and returns rows you can filter, sort, aggregate, and export as a table, JSON, CSV, or JSONL.

```bash
domql https://news.ycombinator.com "SELECT text, @href FROM .titleline>a LIMIT 10"
```

## Installation

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/tylergibbs1/domql.git
cd domql
bun install
bunx playwright install chromium   # browser used for page loading
bun link                           # makes `domql` available globally
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
domql https://news.ycombinator.com "SELECT COUNT() FROM .titleline>a"

# ORDER BY and LIMIT
domql https://example.com "SELECT text, @data-price FROM .product ORDER BY data-price DESC LIMIT 10"

# Output formats
domql https://example.com "SELECT text FROM h2" -f json
domql https://example.com "SELECT text FROM h2" -f csv -o output.csv
```

## Query syntax

### SELECT clause
- `text` - Element text content
- `@attribute` - Element attribute (e.g., `@href`, `@src`, `@data-id`)
- `.selector` - Nested element selector

### FROM clause
CSS selector for target elements. Use quotes for complex selectors with spaces:

```sql
SELECT text FROM .item
SELECT text FROM "#content .item"
SELECT text FROM [ul > li]
```

### WHERE clause

**Comparison operators:** `=`, `!=`, `>`, `<`, `>=`, `<=`

```sql
SELECT text FROM .item WHERE price > 100
SELECT text FROM .item WHERE @data-price >= 50
```

**LIKE** - Pattern matching (case-insensitive)

```sql
SELECT text FROM a WHERE text LIKE 'A%'       -- starts with A
SELECT text FROM a WHERE text LIKE '%ing'     -- ends with ing
SELECT text FROM a WHERE text LIKE '%key%'    -- contains key
SELECT text FROM a WHERE text NOT LIKE '%ad%' -- does not contain ad
```

**IN** - Match against a list

```sql
SELECT text FROM .item WHERE text IN ('Apple', 'Banana', 'Cherry')
SELECT text FROM .item WHERE @data-price IN (10, 20, 30)
```

**REGEXP / RLIKE** - Regular expression matching

```sql
SELECT text FROM .item WHERE text REGEXP '^[A-Z]'           -- starts with uppercase
SELECT text FROM a WHERE @href REGEXP '\.pdf$'              -- PDF links
SELECT text FROM .item WHERE text REGEXP '(?i)apple'        -- case-insensitive
SELECT text FROM .item WHERE text REGEXP '/pattern/i'       -- alternative flag syntax
SELECT text FROM .item WHERE text NOT REGEXP '\d'           -- no digits
```

**Combining conditions:**

```sql
SELECT text FROM .item WHERE price > 100 AND category = 'electronics'
SELECT text FROM .item WHERE status = 'sale' OR status = 'new'
```

### Aggregations
- `COUNT()` - Count elements
- `AVG(field)` - Average of numeric field
- `MIN(field)` - Minimum value
- `MAX(field)` - Maximum value
- `SUM(field)` - Sum of numeric field

```sql
SELECT COUNT() FROM .item
SELECT AVG(data-price), MIN(data-price), MAX(data-price) FROM .product
```

### ORDER BY

```sql
SELECT text FROM .item ORDER BY price DESC
SELECT text FROM .item ORDER BY text ASC
```

### LIMIT

```sql
SELECT text FROM .item LIMIT 10
```

## Options

| Option | Description |
|--------|-------------|
| `-f, --format <type>` | Output format: table, json, csv, jsonl (default: table) |
| `-o, --output <file>` | Write output to file |
| `--no-headers` | Omit headers in CSV/table output |
| `--js` / `--no-js` | Enable/disable JavaScript rendering (default: enabled; `--no-js` is faster for static pages) |
| `--wait <ms>` | Wait time after page load (default: 0) |
| `--timeout <ms>` | Page load timeout (default: 30000) |
| `--verbose` | Verbose logging |

## Examples

```bash
# Hacker News - top stories
domql https://news.ycombinator.com "SELECT text, @href FROM .titleline>a LIMIT 10"

# Filter stories mentioning AI
domql https://news.ycombinator.com "SELECT text FROM .titleline>a WHERE text REGEXP '(?i)\bAI\b'"

# Only GitHub links
domql https://news.ycombinator.com "SELECT text, @href FROM .titleline>a WHERE @href LIKE '%github.com%'"

# Count stories
domql https://news.ycombinator.com "SELECT COUNT() FROM .titleline>a"

# Wikipedia paragraphs
domql https://en.wikipedia.org/wiki/Web_scraping 'SELECT text FROM "#mw-content-text p" LIMIT 3'

# JSON output for piping
domql https://news.ycombinator.com "SELECT text, @href FROM .titleline>a" -f json | jq '.[0]'

# CSV export
domql https://example.com "SELECT text, @href FROM a" -f csv -o links.csv
```
