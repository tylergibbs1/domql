import Table from 'cli-table3';
import type { QueryResult } from './executor.js';

export interface FormatOptions {
  format: 'table' | 'json' | 'csv' | 'jsonl';
  includeHeaders: boolean;
}

export function formatOutput(result: QueryResult, options: FormatOptions): string {
  switch (options.format) {
    case 'json':
      return formatJson(result);
    case 'csv':
      return formatCsv(result, options.includeHeaders);
    case 'jsonl':
      return formatJsonl(result);
    case 'table':
    default:
      return formatTable(result, options.includeHeaders);
  }
}

function formatTable(result: QueryResult, includeHeaders: boolean): string {
  const table = new Table({
    head: includeHeaders ? result.fields : undefined,
    style: { head: ['cyan'] }
  });

  result.rows.forEach(row => {
    table.push(row);
  });

  return table.toString();
}

function formatJson(result: QueryResult): string {
  const objects = result.rows.map(row => {
    const obj: any = {};
    result.fields.forEach((field, idx) => {
      obj[field] = row[idx];
    });
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

function formatCsv(result: QueryResult, includeHeaders: boolean): string {
  const lines: string[] = [];
  
  if (includeHeaders) {
    lines.push(result.fields.map(f => escapeCsv(f)).join(','));
  }

  result.rows.forEach(row => {
    lines.push(row.map(v => escapeCsv(String(v))).join(','));
  });

  return lines.join('\n');
}

function formatJsonl(result: QueryResult): string {
  const lines: string[] = [];
  
  result.rows.forEach(row => {
    const obj: any = {};
    result.fields.forEach((field, idx) => {
      obj[field] = row[idx];
    });
    lines.push(JSON.stringify(obj));
  });

  return lines.join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
