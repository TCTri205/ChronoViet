const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const dataDir = path.join(projectRoot, 'src/data');
const docsDir = path.join(projectRoot, '../docs');

function checkFileExists(relPath) {
  const fullPath = path.join(publicDir, relPath);
  if (!fs.existsSync(fullPath)) {
    return { ok: false, reason: `File missing at ${fullPath}` };
  }
  const stat = fs.statSync(fullPath);
  if (stat.size === 0) {
    return { ok: false, reason: `File is 0 bytes at ${fullPath}` };
  }
  return { ok: true, size: stat.size };
}

function verifyTimelineJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(raw);
  const name = path.basename(filePath);
  console.log(`\n🔍 Auditing timeline JSON: ${name}`);
  console.log(`   Title: "${json.title}"`);
  console.log(`   Subtitle: "${json.subtitle || ''}"`);
  console.log(`   Aspect Ratio: ${json.aspectRatio}`);
  console.log(`   Total Scenes: ${json.timeline.length}`);

  let errors = 0;
  let missingAssets = 0;

  if (json.aspectRatio !== '16:9') {
    console.error(`   ✗ Aspect ratio is "${json.aspectRatio}". Only "16:9" is permitted for ChronoViet videos!`);
    errors++;
  }

  let prevEndTime = 0;
  json.timeline.forEach((scene, index) => {
    if (scene.startTime >= scene.endTime) {
      console.error(`   ✗ [Scene ${scene.id}] Invalid timestamps: startTime (${scene.startTime}) >= endTime (${scene.endTime})`);
      errors++;
    }
    if (scene.startTime < prevEndTime && index > 0) {
      console.warn(`   ⚠️ [Scene ${scene.id}] Overlapping scene timestamp: startTime (${scene.startTime}) < prevEndTime (${prevEndTime})`);
    }
    prevEndTime = scene.endTime;

    if (scene.assetUrl) {
      const res = checkFileExists(scene.assetUrl);
      if (!res.ok) {
        console.error(`   ✗ [Scene ${scene.id}] Asset error: ${res.reason}`);
        missingAssets++;
      }
    }
  });

  if (errors === 0 && missingAssets === 0) {
    console.log(`   ✅ ${name}: 100% Passed. All ${json.timeline.length} scenes valid & assets present.`);
  } else {
    console.error(`   ❌ ${name}: ${errors} errors, ${missingAssets} missing assets.`);
  }

  return { errors, missingAssets, totalScenes: json.timeline.length };
}

function verifyDocs() {
  console.log('\n📄 Auditing Project Documentation integrity in docs/...');
  const docFiles = [
    { name: 'SystemOverview.md', sub: '' },
    { name: 'TEMPLATE_GUIDE_VIDEO_ESSAY.md', sub: '' },
    { name: 'KICH_BAN_QUANG_TRUNG.md', sub: 'script_examples' },
    { name: 'KICH_BAN_MONG_CO_DAI_VIET_LAN_2.md', sub: 'script_examples' },
    { name: 'KICH_BAN_HAI_BA_TRUNG.md', sub: 'script_examples' }
  ];

  docFiles.forEach(doc => {
    const fullPath = doc.sub
      ? path.join(docsDir, doc.sub, doc.name)
      : path.join(docsDir, doc.name);
    if (fs.existsSync(fullPath)) {
      const size = fs.statSync(fullPath).size;
      console.log(`   ✅ docs/${doc.sub ? doc.sub + '/' : ''}${doc.name} (${size} bytes) - OK`);
    } else {
      console.error(`   ❌ docs/${doc.sub ? doc.sub + '/' : ''}${doc.name} - MISSING`);
    }
  });
}

function main() {
  console.log('=============== CHRONOVIET SYSTEM AUDIT & INTEGRITY CHECK ===============');

  verifyDocs();

  const jsonFiles = [
    path.join(dataDir, 'quang-trung/quangTrungTimeline.json'),
    path.join(dataDir, 'mongol-viet-2/mongolViet2Timeline.json'),
    path.join(dataDir, 'hai-ba-trung/haiBaTrungTimeline.json'),
    path.join(dataDir, 'biographyTimeline.json'),
    path.join(dataDir, 'battleTimeline.json'),
    path.join(dataDir, 'dynastyTimeline.json'),
    path.join(dataDir, 'mysteryTimeline.json'),
    path.join(dataDir, 'artifactTimeline.json')
  ];

  let totalErrors = 0;
  let totalMissing = 0;

  jsonFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const res = verifyTimelineJson(file);
      totalErrors += res.errors;
      totalMissing += res.missingAssets;
    } else {
      console.error(`❌ Timeline file missing: ${file}`);
      totalErrors++;
    }
  });

  console.log('\n========================================================================');
  if (totalErrors === 0 && totalMissing === 0) {
    console.log('🎉 AUDIT COMPLETE: ALL COMPOSITIONS & ASSETS PASSED WITH 100% INTEGRITY!');
  } else {
    console.error(`⚠️ AUDIT ISSUES FOUND: ${totalErrors} logic errors, ${totalMissing} missing assets.`);
  }
}

main();
