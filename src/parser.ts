export interface ParsedQuery {
  fields: Field[];
  selector: string;
  where?: WhereClause;
  orderBy?: OrderBy;
  limit?: number;
  aggregations?: Aggregation[];
}

export interface Field {
  name: string;
  type: 'text' | 'attr' | 'nested';
  attr?: string;
  nested?: string;
}

export interface WhereClause {
  field: string;
  operator: string;
  value: any;
  logic?: 'AND' | 'OR';
  next?: WhereClause;
}

export interface OrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface Aggregation {
  function: 'COUNT' | 'AVG' | 'MIN' | 'MAX' | 'SUM';
  field?: string;
  alias?: string;
}

export function parseQuery(query: string): ParsedQuery {
  // Normalize whitespace
  query = query.replace(/\s+/g, ' ').trim();

  // Extract SELECT fields
  const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
  if (!selectMatch) {
    throw new Error('Invalid query: missing SELECT clause');
  }

  const fieldsStr = selectMatch[1];
  const fields = parseFields(fieldsStr);

  // Check for aggregations
  const aggregations = parseAggregations(fieldsStr);

  // Extract FROM selector
  const fromMatch = query.match(/FROM\s+([^\s]+)/i);
  if (!fromMatch) {
    throw new Error('Invalid query: missing FROM clause');
  }
  const selector = fromMatch[1];

  // Extract WHERE clause (optional)
  const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|$)/i);
  const where = whereMatch ? parseWhere(whereMatch[1]) : undefined;

  // Extract ORDER BY (optional)
  const orderMatch = query.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
  const orderBy = orderMatch ? {
    field: orderMatch[1],
    direction: (orderMatch[2]?.toUpperCase() || 'ASC') as 'ASC' | 'DESC'
  } : undefined;

  // Extract LIMIT (optional)
  const limitMatch = query.match(/LIMIT\s+(\d+)/i);
  const limit = limitMatch ? parseInt(limitMatch[1]) : undefined;

  return {
    fields,
    selector,
    where,
    orderBy,
    limit,
    aggregations: aggregations.length > 0 ? aggregations : undefined
  };
}

function parseFields(fieldsStr: string): Field[] {
  const fields: Field[] = [];
  const parts = fieldsStr.split(',').map(s => s.trim());

  for (const part of parts) {
    // Check for aggregations (skip them here, handle separately)
    if (/^(COUNT|AVG|MIN|MAX|SUM)\(/i.test(part)) {
      continue;
    }

    // Special keyword: text
    if (part.toLowerCase() === 'text') {
      fields.push({
        name: 'text',
        type: 'text'
      });
    }
    // Attribute selector: @href, @src, etc.
    else if (part.startsWith('@')) {
      fields.push({
        name: part.substring(1),
        type: 'attr',
        attr: part.substring(1)
      });
    }
    // Nested selector: .className or tagName (but not single lowercase word)
    else if (part.startsWith('.')) {
      fields.push({
        name: part,
        type: 'nested',
        nested: part
      });
    }
    // Text content by default
    else {
      fields.push({
        name: part,
        type: 'text'
      });
    }
  }

  return fields;
}

function parseAggregations(fieldsStr: string): Aggregation[] {
  const aggregations: Aggregation[] = [];
  const aggRegex = /(COUNT|AVG|MIN|MAX|SUM)\(([^)]*)\)(?:\s+AS\s+(\w+))?/gi;
  let match;

  while ((match = aggRegex.exec(fieldsStr)) !== null) {
    aggregations.push({
      function: match[1].toUpperCase() as any,
      field: match[2] || undefined,
      alias: match[3] || match[1].toLowerCase()
    });
  }

  return aggregations;
}

function parseWhere(whereStr: string): WhereClause | undefined {
  // Simple WHERE parser - supports basic comparisons
  // Format: field operator value [AND/OR field operator value]*
  
  const parts = whereStr.split(/\s+(AND|OR)\s+/i);
  let root: WhereClause | undefined;
  let current: WhereClause | undefined;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    
    if (part.toUpperCase() === 'AND' || part.toUpperCase() === 'OR') {
      continue;
    }

    const clause = parseWhereCondition(part);
    if (!clause) continue;

    if (!root) {
      root = clause;
      current = root;
    } else {
      current!.next = clause;
      clause.logic = parts[i - 1]?.toUpperCase() as 'AND' | 'OR' || 'AND';
      current = clause;
    }
  }

  return root;
}

function parseWhereCondition(condition: string): WhereClause | null {
  // Match: field operator value
  const patterns = [
    /(\w+)\s*(=|!=|>|<|>=|<=)\s*(.+)/,
    /(\w+)\s+LIKE\s+'([^']+)'/i,
    /(\w+)\s+NOT\s+LIKE\s+'([^']+)'/i,
    /(\w+)\s+IN\s+\(([^)]+)\)/i
  ];

  for (const pattern of patterns) {
    const match = condition.match(pattern);
    if (match) {
      const field = match[1];
      const operator = match[2] || (condition.includes('NOT') ? 'NOT LIKE' : 'LIKE');
      let value: any = match[3] || match[2];

      // Clean up value
      value = value.replace(/^['"]|['"]$/g, '').trim();

      // Try to coerce type
      if (/^\d+$/.test(value)) {
        value = parseInt(value);
      } else if (/^\d+\.\d+$/.test(value)) {
        value = parseFloat(value);
      }

      return { field, operator, value };
    }
  }

  return null;
}
