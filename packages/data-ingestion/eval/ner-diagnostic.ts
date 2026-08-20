import { loadGoldenTriplesBenchmark } from './ner-runner.js';
import { extractHistoricalCandidateSpans } from '../src/text/vietnamese-ner.js';

const dataset = loadGoldenTriplesBenchmark();
for (const s of dataset) {
  const extracted = extractHistoricalCandidateSpans(s.sourceText);
  const gt = s.groundTruthEntities;
  const gtNames = gt.map(g => g.name);
  const extNames = extracted.map(e => e.text);
  
  const missing = gtNames.filter(name => !extNames.includes(name));
  const extra = extNames.filter(name => !gtNames.includes(name));
  
  if (missing.length > 0 || extra.length > 0) {
    console.log(`\n--- Snippet: ${s.id} ---`);
    console.log(`Text: "${s.sourceText}"`);
    console.log(`GT Entities:  `, gtNames);
    console.log(`Ext Entities: `, extNames);
    if (missing.length > 0) console.log(`❌ Missing:   `, missing);
    if (extra.length > 0) console.log(`➕ Extra:     `, extra);
  }
}
