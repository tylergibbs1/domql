import { chromium } from 'playwright';
import { parseQuery, type ParsedQuery, type Field, type WhereClause } from './parser.js';

export interface ExecutorOptions {
  enableJs: boolean;
  waitMs: number;
  timeout: number;
  verbose: boolean;
}

export interface QueryResult {
  fields: string[];
  rows: any[][];
  query: ParsedQuery;
}

export async function executeQuery(url: string, queryStr: string, options: ExecutorOptions): Promise<QueryResult> {
  const query = parseQuery(queryStr);
  
  if (options.verbose) {
    console.error('Parsed query:', JSON.stringify(query, null, 2));
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: options.enableJs ? 'networkidle' : 'domcontentloaded',
      timeout: options.timeout
    });

    if (options.waitMs > 0) {
      await page.waitForTimeout(options.waitMs);
    }

    // Execute query in browser context
    const result = await page.evaluate(({ query }) => {
      const elements = Array.from(document.querySelectorAll(query.selector));
      const rows: any[][] = [];

      elements.forEach((el) => {
        const row: any[] = [];
        
        query.fields.forEach((field) => {
          let value: any = null;

          if (field.type === 'text') {
            value = el.textContent?.trim() || '';
          } else if (field.type === 'attr' && field.attr) {
            value = el.getAttribute(field.attr) || '';
          } else if (field.type === 'nested' && field.nested) {
            const nested = el.querySelector(field.nested);
            value = nested?.textContent?.trim() || '';
          }

          row.push(value);
        });

        rows.push(row);
      });

      return {
        fields: query.fields.map(f => f.name),
        rows
      };
    }, { query });

    // Apply WHERE filter
    let filteredRows = result.rows;
    if (query.where) {
      filteredRows = filterRows(filteredRows, result.fields, query.where);
    }

    // Apply aggregations
    if (query.aggregations && query.aggregations.length > 0) {
      return executeAggregations(filteredRows, result.fields, query);
    }

    // Apply ORDER BY
    if (query.orderBy) {
      const fieldIndex = result.fields.indexOf(query.orderBy.field);
      if (fieldIndex !== -1) {
        filteredRows.sort((a, b) => {
          const aVal = coerceValue(a[fieldIndex]);
          const bVal = coerceValue(b[fieldIndex]);
          const compare = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          return query.orderBy!.direction === 'DESC' ? -compare : compare;
        });
      }
    }

    // Apply LIMIT
    if (query.limit) {
      filteredRows = filteredRows.slice(0, query.limit);
    }

    return {
      fields: result.fields,
      rows: filteredRows,
      query
    };
  } finally {
    await browser.close();
  }
}

function filterRows(rows: any[][], fields: string[], where: WhereClause): any[][] {
  return rows.filter(row => evaluateWhere(row, fields, where));
}

function evaluateWhere(row: any[], fields: string[], where: WhereClause): boolean {
  const fieldIndex = fields.indexOf(where.field);
  if (fieldIndex === -1) return true;

  const value = coerceValue(row[fieldIndex]);
  const compareValue = coerceValue(where.value);

  let result = false;

  switch (where.operator) {
    case '=':
      result = value === compareValue;
      break;
    case '!=':
      result = value !== compareValue;
      break;
    case '>':
      result = value > compareValue;
      break;
    case '<':
      result = value < compareValue;
      break;
    case '>=':
      result = value >= compareValue;
      break;
    case '<=':
      result = value <= compareValue;
      break;
    case 'LIKE': {
      const pattern = String(compareValue);
      const str = String(value).toLowerCase();
      const search = pattern.toLowerCase();

      if (search.startsWith('%') && search.endsWith('%')) {
        result = str.includes(search.slice(1, -1));
      } else if (search.startsWith('%')) {
        result = str.endsWith(search.slice(1));
      } else if (search.endsWith('%')) {
        result = str.startsWith(search.slice(0, -1));
      } else {
        result = str === search;
      }
      break;
    }
    case 'NOT LIKE': {
      const pattern = String(compareValue);
      const str = String(value).toLowerCase();
      const search = pattern.toLowerCase();

      if (search.startsWith('%') && search.endsWith('%')) {
        result = !str.includes(search.slice(1, -1));
      } else if (search.startsWith('%')) {
        result = !str.endsWith(search.slice(1));
      } else if (search.endsWith('%')) {
        result = !str.startsWith(search.slice(0, -1));
      } else {
        result = str !== search;
      }
      break;
    }
    case 'IN': {
      const inValues = Array.isArray(compareValue)
        ? compareValue
        : String(compareValue).split(',').map(v => coerceValue(v.trim()));
      result = inValues.some(v => v === value);
      break;
    }
    case 'REGEXP': {
      try {
        const regex = parseRegex(String(compareValue));
        result = regex.test(String(value));
      } catch {
        result = false;
      }
      break;
    }
    case 'NOT REGEXP': {
      try {
        const regex = parseRegex(String(compareValue));
        result = !regex.test(String(value));
      } catch {
        result = false;
      }
      break;
    }
  }

  if (where.next) {
    const nextResult = evaluateWhere(row, fields, where.next);
    if (where.next.logic === 'AND') {
      result = result && nextResult;
    } else if (where.next.logic === 'OR') {
      result = result || nextResult;
    }
  }

  return result;
}

function parseRegex(pattern: string): RegExp {
  // Support /pattern/flags syntax
  const slashMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
  if (slashMatch) {
    return new RegExp(slashMatch[1], slashMatch[2]);
  }

  // Support (?flags) prefix (convert to JS flags)
  const flagMatch = pattern.match(/^\(\?([gimsuy]+)\)(.+)$/);
  if (flagMatch) {
    return new RegExp(flagMatch[2], flagMatch[1]);
  }

  return new RegExp(pattern);
}

function coerceValue(value: any): any {
  if (typeof value === 'string') {
    // Try number
    if (/^\d+$/.test(value)) {
      return parseInt(value);
    }
    if (/^\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    // Only parse ISO-ish date formats to avoid false positives
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  return value;
}

function executeAggregations(rows: any[][], fields: string[], query: ParsedQuery): QueryResult {
  const results: any[] = [];
  const aggFields: string[] = [];

  query.aggregations!.forEach(agg => {
    aggFields.push(agg.alias || agg.function.toLowerCase());

    if (agg.function === 'COUNT') {
      results.push(rows.length);
    } else if (agg.field) {
      const fieldIndex = fields.indexOf(agg.field);
      if (fieldIndex !== -1) {
        const values = rows.map(r => coerceValue(r[fieldIndex])).filter(v => typeof v === 'number');
        
        switch (agg.function) {
          case 'AVG':
            results.push(values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null);
            break;
          case 'MIN':
            results.push(values.length > 0 ? values.reduce((a, b) => Math.min(a, b)) : null);
            break;
          case 'MAX':
            results.push(values.length > 0 ? values.reduce((a, b) => Math.max(a, b)) : null);
            break;
          case 'SUM':
            results.push(values.length > 0 ? values.reduce((a, b) => a + b, 0) : null);
            break;
        }
      } else {
        results.push(null);
      }
    }
  });

  return {
    fields: aggFields,
    rows: [results],
    query
  };
}
