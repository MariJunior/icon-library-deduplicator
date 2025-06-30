import fs from "node:fs";
import { createRequire } from "node:module";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const looksSame = require("looks-same");
const sharp = require("sharp");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ICON_DIR = path.join(__dirname, "src/svg");
const STYLES = ["outlined", "filled", "sharp", "round"];
const TEMP_DIR = path.join(__dirname, "temp-png");
const REPORT_FILE = path.join(__dirname, "visual-dedup-report.json");

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

function groupIconsByName() {
  const groups = {};

  for (const style of STYLES) {
    const dir = path.join(ICON_DIR, style);
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".svg")) continue;
      const iconName = path.basename(file, ".svg");
      if (!groups[iconName]) groups[iconName] = {};
      groups[iconName][style] = path.join(dir, file);
    }
  }

  return groups;
}

async function renderSvgToPng(svgPath, outputPath) {
  const svgBuffer = fs.readFileSync(svgPath);
  await sharp(svgBuffer).resize(64, 64).png().toFile(outputPath);
}

async function visuallyCompare(file1, file2) {
  const result = await looksSame(file1, file2, { strict: true });
  return result.equal;
}

async function processVisualDeduplication() {
  const iconGroups = groupIconsByName();
  const report = {};

  let totalIcons = 0;
  let iconsWithDuplicates = 0;
  let totalFilesToRemove = 0;
  const removalByStyle = { outlined: 0, filled: 0, sharp: 0, round: 0 };

  for (const [iconName, styles] of Object.entries(iconGroups)) {
    totalIcons++;
    const styleEntries = Object.entries(styles);
    if (styleEntries.length < 2) continue;

    const pngPaths = {};
    for (const [style, svgPath] of styleEntries) {
      const pngPath = path.join(TEMP_DIR, `${iconName}_${style}.png`);
      await renderSvgToPng(svgPath, pngPath);
      pngPaths[style] = pngPath;
    }

    const visualDuplicates = new Map();

    for (let i = 0; i < styleEntries.length; i++) {
      const [styleA] = styleEntries[i];
      for (let j = i + 1; j < styleEntries.length; j++) {
        const [styleB] = styleEntries[j];
        const equal = await visuallyCompare(pngPaths[styleA], pngPaths[styleB]);
        if (equal) {
          if (!visualDuplicates.has(styleA)) visualDuplicates.set(styleA, new Set());
          if (!visualDuplicates.has(styleB)) visualDuplicates.set(styleB, new Set());
          visualDuplicates.get(styleA).add(styleB);
          visualDuplicates.get(styleB).add(styleA);
        }
      }
    }

    if (visualDuplicates.size > 0) {
      iconsWithDuplicates++;
      const allInvolved = new Set([...visualDuplicates.keys()]);
      for (const s of visualDuplicates.values()) {
        for (const val of s) allInvolved.add(val);
      }
      const cluster = Array.from(allInvolved);
      const keep = cluster.includes("outlined") ? "outlined" : cluster.sort()[0];
      const remove = cluster.filter((s) => s !== keep);

      remove.forEach((style) => {
        if (removalByStyle[style] !== undefined) {
          removalByStyle[style]++;
          totalFilesToRemove++;
        }
      });

      report[iconName] = { keep, remove };
    }
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

  console.log("\n=== Визуальное сравнение завершено ===");
  console.log(`Всего иконок (названий) проверено: ${totalIcons}`);
  console.log(`Иконок с дубликатами: ${iconsWithDuplicates}`);
  console.log(`Всего файлов помечено к удалению: ${totalFilesToRemove}`);
  console.log("Удаление по стилям:");
  for (const [style, count] of Object.entries(removalByStyle)) {
    console.log(`  ${style}: ${count}`);
  }
  console.log("Отчёт сохранён в:", REPORT_FILE);
}

processVisualDeduplication();
