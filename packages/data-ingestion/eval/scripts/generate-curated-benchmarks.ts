import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildSnippet, buildChunk, datasetsDir } from './benchmark-builder-utils.js';
import { ENTITY_DISAMBIGUATION_DATA } from './data-generators/entity-disambiguation-data.js';
import { VECTOR_RETRIEVAL_DATA } from './data-generators/vector-retrieval-data.js';
import { GOLDEN_TRIPLES_DATA } from './data-generators/golden-triples-data.js';
import { GOLDEN_CHUNKS_DATA } from './data-generators/golden-chunks-data.js';

console.log('===============================================================');
console.log(' CHRONOVIET MODULE 0 PRODUCTION BENCHMARK DATASET GENERATOR');
console.log(' Target: 15 Epochs Complete | High-Difficulty | Multi-Genre');
console.log('===============================================================\n');

// 1. Entity Disambiguation Benchmark
console.log(`[*] Generating Entity Disambiguation Benchmark (${ENTITY_DISAMBIGUATION_DATA.length} items)...`);
const entityBenchmarkPath = path.resolve(datasetsDir, 'entity-disambiguation-benchmark.json');
fs.writeFileSync(entityBenchmarkPath, JSON.stringify(ENTITY_DISAMBIGUATION_DATA, null, 2), 'utf-8');
console.log(`[+] Saved ${ENTITY_DISAMBIGUATION_DATA.length} items -> file:///${entityBenchmarkPath.replace(/\\/g, '/')}\n`);

// 2. Vector Retrieval Benchmark
console.log(`[*] Generating Vector Retrieval Benchmark (${VECTOR_RETRIEVAL_DATA.length} queries across 15 epochs)...`);
const vectorBenchmarkPath = path.resolve(datasetsDir, 'vector-retrieval-benchmark.json');
fs.writeFileSync(vectorBenchmarkPath, JSON.stringify(VECTOR_RETRIEVAL_DATA, null, 2), 'utf-8');
console.log(`[+] Saved ${VECTOR_RETRIEVAL_DATA.length} queries -> file:///${vectorBenchmarkPath.replace(/\\/g, '/')}\n`);

// 3. Golden Triples Benchmark
console.log(`[*] Validating and generating Golden Triples Benchmark (${GOLDEN_TRIPLES_DATA.length} snippets)...`);
const validatedTriples = GOLDEN_TRIPLES_DATA.map(buildSnippet);
const triplesBenchmarkPath = path.resolve(datasetsDir, 'golden-triples-benchmark.json');
fs.writeFileSync(triplesBenchmarkPath, JSON.stringify(validatedTriples, null, 2), 'utf-8');
console.log(`[+] Saved ${validatedTriples.length} golden snippets -> file:///${triplesBenchmarkPath.replace(/\\/g, '/')}\n`);

// 4. Golden Chunks Benchmark
console.log(`[*] Validating and generating Golden Chunks Benchmark (${GOLDEN_CHUNKS_DATA.length} production chunks)...`);
const validatedChunks = GOLDEN_CHUNKS_DATA.map(buildChunk);
const chunksBenchmarkPath = path.resolve(datasetsDir, 'golden-chunks-benchmark.json');
fs.writeFileSync(chunksBenchmarkPath, JSON.stringify(validatedChunks, null, 2), 'utf-8');
console.log(`[+] Saved ${validatedChunks.length} golden chunks -> file:///${chunksBenchmarkPath.replace(/\\/g, '/')}\n`);

// 5. License Audit Benchmark (Preserve & Ensure existence)
const licenseBenchmarkPath = path.resolve(datasetsDir, 'license-audit-benchmark.json');
if (!fs.existsSync(licenseBenchmarkPath)) {
  const defaultLicenses = [
    { licenseInput: 'CC-BY-4.0', shouldAllow: true },
    { licenseInput: 'CC-BY-SA-4.0', shouldAllow: true },
    { licenseInput: 'Public Domain', shouldAllow: true },
    { licenseInput: 'CC0-1.0', shouldAllow: true },
    { licenseInput: 'GPL-3.0', shouldAllow: false },
    { licenseInput: 'All Rights Reserved', shouldAllow: false },
  ];
  fs.writeFileSync(licenseBenchmarkPath, JSON.stringify(defaultLicenses, null, 2), 'utf-8');
}

console.log('===============================================================');
console.log(' ALL 5 PRODUCTION EVALUATION BENCHMARKS GENERATED SUCCESSFULLY!');
console.log('===============================================================\n');
