figma.showUI(__html__, { width: 300, height: 100 });

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/⚠️/g, "")
    .replace(/[^a-z0-9_]/g, "") // убираем всё, кроме латиницы, цифр и "_"
    .trim();
}

function extractStyleFromVariantName(variantName) {
  // Извлекаем значение после "Style=" и нормализуем
  const match = variantName.match(/Style=(.+)/);
  if (match) {
    return match[1].toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  return variantName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function markVariantForDeletion(variant, reason) {
  console.log(`✅ Помечаем к удалению: ${variant.name} (${reason})`);

  // Добавляем ⚠️ к названию если его еще нет
  if (!variant.name.includes("⚠️")) {
    variant.name = `${variant.name} ⚠️`;
  }

  // Добавляем красную рамку вокруг варианта
  try {
    variant.strokes = [
      {
        type: "SOLID",
        color: { r: 1, g: 0, b: 0 }, // красный цвет
        opacity: 1
      }
    ];
    variant.strokeWeight = 3; // толщина рамки
    variant.strokeAlign = "OUTSIDE"; // рамка снаружи

    return true;
  } catch (err) {
    console.warn(`⚠️ Не удалось добавить рамку к: ${variant.name}`, err);
    return false;
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "load-json") {
    const report = JSON.parse(msg.content);

    const componentSets = figma.currentPage.findAll((node) => node.type === "COMPONENT_SET");
    console.log("🔍 Найдено ComponentSet:", componentSets.length);

    let markedCount = 0;

    for (const set of componentSets) {
      const iconName = normalizeName(set.name);
      console.log("Анализируем:", set.name, "-> нормализованное:", iconName);

      // Ищем все компоненты (варианты) внутри ComponentSet
      const variants = set.children.filter((child) => child.type === "COMPONENT");

      for (const variant of variants) {
        const styleName = extractStyleFromVariantName(variant.name);
        console.log(`🔍 Проверяем вариант: "${variant.name}" -> извлеченный стиль: "${styleName}"`);

        let shouldMark = false;
        let reason = "";

        // Проверяем, является ли это Two Tone вариантом (помечаем всегда)
        if (styleName === "twotone") {
          shouldMark = true;
          reason = "Two Tone стиль (удаляется по умолчанию)";
        }
        // Проверяем, есть ли иконка в отчете и нужно ли удалить этот стиль
        else if (report[iconName]) {
          const remove = (report[iconName].remove || []).map((s) => s.toLowerCase());
          if (remove.includes(styleName)) {
            shouldMark = true;
            reason = "указан в отчете для удаления";
          }
        }

        if (shouldMark) {
          if (markVariantForDeletion(variant, reason)) {
            markedCount++;
          }
        } else {
          console.log(`⏭️ Вариант остается: ${styleName}`);
        }
      }
    }

    figma.closePlugin(`✅ Помечено иконок: ${markedCount}`);
  }
};
