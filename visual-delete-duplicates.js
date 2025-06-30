function deleteFilesByVisualReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    console.error("Отчёт не найден:", reportPath);
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  let totalDeleted = 0;

  for (const [iconName, data] of Object.entries(report)) {
    const { remove } = data;
    for (const style of remove) {
      const filePath = path.join(ICON_DIR, style, `${iconName}.svg`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        totalDeleted++;
        console.log(`Удалён файл: ${filePath}`);
      }
    }
  }

  console.log(`Всего удалено файлов (визуальный отчёт): ${totalDeleted}`);
}

deleteFilesByVisualReport("./visual-dedup-report.json");
