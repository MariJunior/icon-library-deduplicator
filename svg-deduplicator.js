/**
 * @fileoverview Скрипт для дедупликации SVG-иконок в дизайн-системе
 *
 * Данный скрипт анализирует SVG-иконки в различных стилях (filled, outlined, round, sharp)
 * и находит абсолютно идентичные файлы по содержимому. При обнаружении дубликатов
 * генерируется отчёт с рекомендациями по удалению лишних файлов.
 *
 * Структура директорий:
 * - src/svg/filled/ - заполненные иконки
 * - src/svg/outlined/ - контурные иконки
 * - src/svg/round/ - округлые иконки
 * - src/svg/sharp/ - острые иконки
 *
 * Имена файлов должны быть в формате snake_case с расширением .svg
 *
 */

// Сравниваем только абсолютно идентичные SVG-иконки по стилям
// иконки в src/svg/{filled, outlined, round, sharp}/, имена файлов в snake_case
// two-tone уже удалён на фронте,
// на дизайне все иконки в этом стиле также нужно пометить к удалению!!!

import crypto from "node:crypto";
import fs from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Путь к директории с SVG-иконками
 * @constant {string}
 */
const ICON_DIR = path.join(__dirname, "src/svg");

/**
 * Массив поддерживаемых стилей иконок
 * @constant {string[]}
 */
const STYLES = ["outlined", "filled", "sharp", "round"]; // two-tone уже удалён

/**
 * Путь к файлу отчёта о дедупликации
 * @constant {string}
 */
const OUTPUT_REPORT = path.join(__dirname, "dedup-report.json");

/**
 * Вычисляет MD5-хеш содержимого файла для сравнения идентичности
 *
 * @param {string} filePath - Абсолютный путь к файлу
 * @returns {string} MD5-хеш содержимого файла в шестнадцатеричном формате
 *
 * @example
 * const hash = getFileHash('/path/to/icon.svg');
 * console.log(hash); // "a1b2c3d4e5f6..."
 */
function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(fileBuffer).digest("hex");
}

/**
 * Группирует SVG-файлы по базовому имени иконки и стилю
 *
 * Сканирует все поддерживаемые стили и создаёт структуру данных,
 * где ключом является имя иконки, а значением - объект с путями
 * к файлам для каждого доступного стиля.
 *
 * @returns {Object.<string, Object.<string, string>>} Объект группировки иконок
 * @returns {Object.<string, string>} return.iconName - Объект со стилями для конкретной иконки
 * @returns {string} return.iconName.styleName - Путь к файлу иконки в определённом стиле
 *
 * @example
 * // Возвращаемая структура:
 * {
 *   "add": {
 *     "filled": "/path/to/src/svg/filled/add.svg",
 *     "outlined": "/path/to/src/svg/outlined/add.svg",
 *     "round": "/path/to/src/svg/round/add.svg"
 *   },
 *   "delete": {
 *     "filled": "/path/to/src/svg/filled/delete.svg",
 *     "outlined": "/path/to/src/svg/outlined/delete.svg"
 *   }
 * }
 */
function groupIconsByName() {
  const groups = {}; // { icon_name: { filled: path, outlined: path, ... } }

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

/**
 * Основная функция обработки групп иконок для поиска и анализа дубликатов
 *
 * Выполняет следующие операции:
 * 1. Группирует иконки по именам
 * 2. Вычисляет хеши для каждого файла
 * 3. Находит идентичные файлы (дубликаты)
 * 4. Определяет какие файлы оставить, а какие удалить
 * 5. Генерирует подробный отчёт и статистику
 * 6. Сохраняет отчёт в JSON-файл
 *
 * Логика выбора файлов для сохранения:
 * - Если среди дубликатов есть стиль "outlined" - он сохраняется как приоритетный
 * - Иначе сохраняется первый стиль в алфавитном порядке
 *
 * @returns {void}
 *
 * @example
 * // Структура генерируемого отчёта:
 * {
 *   "icon_name": {
 *     "keep": ["outlined"],           // Стили, которые нужно оставить
 *     "remove": ["filled", "round"]   // Стили, которые нужно удалить
 *   }
 * }
 */
function processIconGroups() {
  const iconGroups = groupIconsByName();
  const report = {};

  let totalIcons = 0;
  let totalIconsAffected = 0;
  let totalFilesRemoved = 0;
  const removedPerStyle = Object.fromEntries(STYLES.map((s) => [s, 0]));

  for (const [iconName, variants] of Object.entries(iconGroups)) {
    totalIcons++;
    const hashes = {};
    const paths = {};

    // Вычисляем хеши для всех вариантов иконки
    for (const [style, filePath] of Object.entries(variants)) {
      const hash = getFileHash(filePath);
      hashes[style] = hash;
      paths[style] = filePath;
    }

    // Группируем стили по совпадающим хешам
    const hashMap = {}; // hash -> [style]
    for (const [style, hash] of Object.entries(hashes)) {
      if (!hashMap[hash]) hashMap[hash] = [];
      hashMap[hash].push(style);
    }

    // Если есть хотя бы один дубликат, добавим в отчёт
    const duplicateClusters = Object.values(hashMap).filter((g) => g.length > 1);
    if (duplicateClusters.length > 0) {
      report[iconName] = {
        keep: [],
        remove: []
      };
      totalIconsAffected++;

      for (const cluster of duplicateClusters) {
        // Приоритет: если в кластере есть outlined — оставляем её, иначе берём алфавитно первую
        const keep = cluster.includes("outlined") ? "outlined" : cluster.sort()[0];
        const remove = cluster.filter((style) => style !== keep);

        report[iconName].keep.push(keep);
        report[iconName].remove.push(...remove);

        totalFilesRemoved += remove.length;
        for (const style of remove) {
          removedPerStyle[style]++;
        }
      }
    }
  }

  // Сохраняем отчёт в JSON-файл
  fs.writeFileSync(OUTPUT_REPORT, JSON.stringify(report, null, 2));

  // Выводим статистику в консоль
  console.log("\n======= СТАТИСТИКА ДЕДУПЛИКАЦИИ =======");
  console.log(`Всего иконок (названий) проверено: ${totalIcons}`);
  console.log("Иконок с удалёнными дубликатами:", totalIconsAffected);
  console.log("Всего файлов к удалению:", totalFilesRemoved);
  for (const style of STYLES) {
    console.log(`Удалено в стиле ${style}:`, removedPerStyle[style]);
  }
  console.log("\nГотово. Отчёт сохранён в:", OUTPUT_REPORT);
}

// Запуск основного процесса дедупликации
processIconGroups();
