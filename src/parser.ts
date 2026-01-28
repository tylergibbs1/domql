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

  // Extract FROM selector (supports quoted selectors for spaces)
  const fromMatch = query.match(/FROM\s+"([^"]+)"|FROM\s+\[([^\]]+)\]|FROM\s+([^\s]+)/i);
  if (!fromMatch) {
    throw new Error('Invalid query: missing FROM clause');
  }
  const selector = fromMatch[1] || fromMatch[2] || fromMatch[3];

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
  // Normalize field name: strip @ prefix, allow hyphens
  const normalizeField = (f: string) => f.replace(/^@/, '');

  // Handle IN operator separately to return array
  const inMatch = condition.match(/@?([\w-]+)\s+IN\s+\(([^)]+)\)/i);
  if (inMatch) {
    const values = inMatch[2].split(',').map(v => {
      let val = v.trim().replace(/^['"]|['"]$/g, '');
      if (/^\d+$/.test(val)) return parseInt(val);
      if (/^\d+\.\d+$/.test(val)) return parseFloat(val);
      return val;
    });
    return { field: normalizeField(inMatch[1]), operator: 'IN', value: values };
  }

  // Handle REGEXP/RLIKE operators
  const notRegexpMatch = condition.match(/@?([\w-]+)\s+NOT\s+(?:REGEXP|RLIKE)\s+'([^']+)'/i);
  if (notRegexpMatch) {
    return { field: normalizeField(notRegexpMatch[1]), operator: 'NOT REGEXP', value: notRegexpMatch[2] };
  }

  const regexpMatch = condition.match(/@?([\w-]+)\s+(?:REGEXP|RLIKE)\s+'([^']+)'/i);
  if (regexpMatch) {
    return { field: normalizeField(regexpMatch[1]), operator: 'REGEXP', value: regexpMatch[2] };
  }

  // Handle LIKE operators separately
  const notLikeMatch = condition.match(/@?([\w-]+)\s+NOT\s+LIKE\s+'([^']+)'/i);
  if (notLikeMatch) {
    return { field: normalizeField(notLikeMatch[1]), operator: 'NOT LIKE', value: notLikeMatch[2] };
  }

  const likeMatch = condition.match(/@?([\w-]+)\s+LIKE\s+'([^']+)'/i);
  if (likeMatch) {
    return { field: normalizeField(likeMatch[1]), operator: 'LIKE', value: likeMatch[2] };
  }

  // Match: field operator value (comparisons)
  const compMatch = condition.match(/@?([\w-]+)\s*(=|!=|>=|<=|>|<)\s*(.+)/);
  if (compMatch) {
    let value: any = compMatch[3].replace(/^['"]|['"]$/g, '').trim();

    if (/^\d+$/.test(value)) {
      value = parseInt(value);
    } else if (/^\d+\.\d+$/.test(value)) {
      value = parseFloat(value);
    }

    return { field: normalizeField(compMatch[1]), operator: compMatch[2], value };
  }

  return null;
}
