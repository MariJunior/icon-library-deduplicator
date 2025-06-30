import fs from "node:fs";
import path from "node:path";

const ICON_DIR = path.join(process.cwd(), "src/svg");

function deleteFilesByHashReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    console.error("Отчёт не найден:", reportPath);
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  let totalDeleted = 0;

  for (const [iconName, entry] of Object.entries(report)) {
    const groups = Array.isArray(entry) ? entry : [entry]; // <= фиксим здесь

    for (const group of groups) {
      const { remove } = group;
      for (const style of remove) {
        const filePath = path.join(ICON_DIR, style, `${iconName}.svg`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          totalDeleted++;
          console.log(`Удалён файл: ${filePath}`);
        }
      }
    }
  }

  console.log(`Всего удалено файлов (хеш-отчёт): ${totalDeleted}`);
}

deleteFilesByHashReport("./dedup-report.json");
