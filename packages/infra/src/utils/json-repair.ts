/**
 * JSON Self-Healing Recovery & Extraction Engine
 * Multi-stage repair for LLM completions, handling unescaped quotes,
 * markdown fences, raw newlines, trailing commas, and truncated objects.
 */

/**
 * Safely extracts and cleans JSON content from raw LLM output strings,
 * handling markdown code fences (```json ... ``` or ``` ... ```) and leading/trailing chatter.
 */
export function extractJsonFromText(rawText: string): string {
  if (!rawText) return '{}';
  let cleaned = rawText.trim();

  // 1. Unwrap markdown code fence if present
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match?.[1]) {
    cleaned = match[1].trim();
  }

  // 2. Slice from first opening { or [ to last closing } or ] if closing exists
  const first = Math.min(...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter((i) => i >= 0));
  const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (first >= 0 && last > first) {
    cleaned = cleaned.slice(first, last + 1).trim();
  } else if (first >= 0) {
    // Truncated payload: keep everything from first opening brace/bracket
    cleaned = cleaned.slice(first).trim();
  }

  // 3. Remove trailing commas before closing braces/brackets (common LLM JSON syntax error)
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  return cleaned;
}

/**
 * Repairs unescaped quotes inside JSON strings using lookahead delimiter analysis.
 */
export function repairJsonUnescapedQuotes(json: string): string {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < json.length; i++) {
    const char = json[i];

    if (isEscaped) {
      result += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      isEscaped = true;
      continue;
    }

    if (inString) {
      if (char === '\n') {
        result += '\\n';
        continue;
      }
      if (char === '\r') {
        result += '\\r';
        continue;
      }
      if (char === '\t') {
        result += '\\t';
        continue;
      }
    }

    if (char === '"') {
      if (!inString) {
        inString = true;
        result += char;
      } else {
        // Check if this quote is legitimately terminating the string.
        // A valid closing quote in JSON is followed (after optional whitespace/comments) by:
        // 1. Colon ':' (if object key)
        // 2. Closing brace '}' or bracket ']'
        // 3. Comma followed by the next object key: `,"key":` or `,"key" :`
        // 4. Comma followed by the next array element: `,"...",` or `,{...}` or `,[...]` or `,true`, `,false`, `,null`, `,-123`
        // 5. End of input
        const rest = json.slice(i + 1);
        const isTerminator =
          /^\s*:/.test(rest) ||
          /^\s*[}\]]/.test(rest) ||
          /^\s*,\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*"(?:[^"\\\r\n]+)"\s*:/.test(rest) ||
          /^\s*,\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*(?:true\b|false\b|null\b|-?\d+(?:\.\d+)?|["{\[])/i.test(rest) ||
          /^\s*$/.test(rest);

        if (isTerminator) {
          inString = false;
          result += char;
        } else {
          // Interior unescaped quote -> escape it safely
          result += '\\"';
        }
      }
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Tracks open brackets/braces in order to correctly close truncated JSON structures.
 */
function closeTruncatedJson(s: string): string {
  const stack: string[] = [];
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (isEscaped) {
      isEscaped = false;
      continue;
    }
    if (c === '\\') {
      isEscaped = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (c === '{' || c === '[') {
      stack.push(c);
    } else if (c === '}') {
      if (stack.length > 0 && stack[stack.length - 1] === '{') {
        stack.pop();
      }
    } else if (c === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === '[') {
        stack.pop();
      }
    }
  }

  // If ended inside a string, close quote first
  let closing = inString ? '"' : '';
  // Close remaining in reverse order
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === '{') closing += '}';
    if (top === '[') closing += ']';
  }

  return s + closing;
}

/**
 * Parses raw text from LLM completion into JSON with automatic codeblock stripping and multi-stage self-healing repair.
 */
export function parseLlmJson<T = any>(rawText: string): T {
  const jsonStr = extractJsonFromText(rawText);
  try {
    return JSON.parse(jsonStr) as T;
  } catch (err: any) {
    // Multi-stage self-healing recovery for common LLM JSON syntax anomalies
    try {
      let s = jsonStr;

      // 0. Strip JavaScript comments (single-line and multi-line)
      s = s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

      // 1. Convert Python-style single quoted JSON keys/values if single quotes are used
      if (s.startsWith("{'") || s.startsWith("['") || s.includes("': '") || s.includes("': [")) {
        s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
      }

      // 2. Remove trailing commas before closing braces/brackets
      s = s.replace(/,\s*([}\]])/g, '$1');

      // 3. Token-based unescaped quotes and raw control character repair
      s = repairJsonUnescapedQuotes(s);

      // 4. Remove trailing commas again after quote repair
      s = s.replace(/,\s*([}\]])/g, '$1');

      // 5. Fix any remaining unescaped newlines/tabs inside string values
      s = s.replace(/(?<=:\s*"[^"]*)\n([^"]*")/g, '\\n$1');

      // 6. Stack-based auto-closing for truncated JSON objects and arrays
      s = closeTruncatedJson(s);

      return JSON.parse(s) as T;
    } catch {
      throw err;
    }
  }
}

export const parseLlmJsonCompletion = parseLlmJson;
