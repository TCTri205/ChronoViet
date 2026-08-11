import fs from 'fs';
import path from 'path';

interface Scene {
  id?: string;
  text?: string;
}

interface TestcaseJson {
  title?: string;
  videoType?: string;
  timeline?: Scene[];
}

interface DatasetSentence {
  id: string;
  text: string;
  domainCategory: string;
  targetWordsCount: number;
}

function extractDatasetFromRemotionTestcases() {
  const remotionTestcasesDir = path.resolve(process.cwd(), 'packages/remotion-engine/eval/test-cases');
  const targetDatasetDir = path.resolve(process.cwd(), 'services/vieneu-tts/eval/datasets');
  const targetDatasetPath = path.join(targetDatasetDir, 'remotion_script_sentences.json');

  if (!fs.existsSync(remotionTestcasesDir)) {
    console.error(`❌ Directory not found: ${remotionTestcasesDir}`);
    process.exit(1);
  }

  // Target single script scenario (biography_quang_trung.json) as requested
  const targetFile = 'biography_quang_trung.json';
  const filePath = path.join(remotionTestcasesDir, targetFile);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Testcase file not found: ${filePath}`);
    process.exit(1);
  }

  const dataset: DatasetSentence[] = [];
  let totalWords = 0;

  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    const data: TestcaseJson = JSON.parse(content);
    const domainCategory = data.videoType || 'BIOGRAPHY';
    const timeline = data.timeline || [];

    let sceneCount = 0;
    for (let i = 0; i < timeline.length; i++) {
      const scene = timeline[i];
      if (scene.text && scene.text.trim().length > 0) {
        sceneCount++;
        const text = scene.text.trim();
        const wordCount = text.split(/\s+/).length;
        totalWords += wordCount;

        const filePrefix = targetFile.replace('.json', '');
        dataset.push({
          id: `${filePrefix}_s${i + 1}`,
          text,
          domainCategory,
          targetWordsCount: wordCount,
        });
      }
    }
    console.log(`  ✓ ${targetFile}: Extracted ${sceneCount} scene sentences.`);
  } catch (err: any) {
    console.error(`❌ Failed to parse ${targetFile}: ${err.message}`);
  }

  if (!fs.existsSync(targetDatasetDir)) {
    fs.mkdirSync(targetDatasetDir, { recursive: true });
  }

  fs.writeFileSync(targetDatasetPath, JSON.stringify(dataset, null, 2), 'utf-8');
  console.log(`✅ Successfully extracted ${dataset.length} sentences (${totalWords} words) for scenario '${targetFile}' into ${targetDatasetPath}`);
}

extractDatasetFromRemotionTestcases();
