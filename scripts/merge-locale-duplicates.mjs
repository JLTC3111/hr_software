/**
 * Merge duplicate keys in src/translations/*.js
 *
 * Rules:
 * - Keep the last property for each key (runtime later-wins).
 * - Strings: prefer more phrases; fix leaked languages from earlier non-leaked values;
 *   if earlier has words later lacks and is not thinner, prefer earlier.
 * - Objects: deep-merge earlier keys missing from later into later; overlaps use string rules.
 * - String vs object: keep the object (structured translations).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import _generate from '@babel/generator';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

const generate = _generate.default || _generate;
const traverse = traverseModule.default || traverseModule;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'src/translations');

function phraseCount(str) {
  return String(str)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function words(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function isLeaked(lang, str) {
  if (typeof str !== 'string' || !str.trim()) return false;
  if (lang === 'en' && /Weiterleitung/i.test(str)) return true;
  if (lang === 'th' && /[àâäéèêëïîôùûüçŒœ]/i.test(str) && /\b(Général|Créativité|Adaptabilité|Résolution|Travail|Pensée|Intelligence)\b/i.test(str)) {
    return true;
  }
  if (lang === 'th' && /Dư̄an|Đỗ/.test(str)) return true;
  if (lang === 'ru' && /Đỗ/.test(str)) return true;
  // Script mismatches
  if (lang === 'en' && /[\u0E00-\u0E7F\u0400-\u04FF\uAC00-\uD7AF\u3040-\u30ff]/.test(str)) return true;
  if (!['jp'].includes(lang) && /[\u3040-\u30ff]/.test(str) && lang !== 'jp') {
    /* ignore chinese-heavy for now */
  }
  return false;
}

function propKeyName(prop) {
  if (!t.isObjectProperty(prop) || prop.computed) return null;
  if (t.isIdentifier(prop.key)) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  return null;
}

function cloneNode(node) {
  return t.cloneNode(node, true, true);
}

function mergeStrings(lang, earlier, later) {
  if (isLeaked(lang, later) && !isLeaked(lang, earlier)) return earlier;
  if (isLeaked(lang, earlier) && !isLeaked(lang, later)) return later;

  const pe = phraseCount(earlier);
  const pl = phraseCount(later);
  const earlierWords = words(earlier);
  const laterWords = words(later);
  const laterSet = new Set(laterWords);
  const earlierSet = new Set(earlierWords);

  // Later has fewer phrases → prefer earlier (richer)
  if (pe > pl) return earlier;

  // Same or more phrases: prefer earlier only if it is a clear superset
  // (later's words all appear in earlier, and earlier adds at least one word)
  const laterSubsetOfEarlier = laterWords.every((w) => earlierSet.has(w));
  const earlierAddsWords = earlierWords.some((w) => !laterSet.has(w));
  if (pe >= pl && laterSubsetOfEarlier && earlierAddsWords) return earlier;

  if (/_/.test(earlier) && !/_/.test(later) && pl >= pe) return later;
  if (/_/.test(later) && !/_/.test(earlier) && pe >= pl) return earlier;

  return later;
}

function mergeValues(lang, earlierNode, laterNode) {
  if (t.isObjectExpression(laterNode) && t.isStringLiteral(earlierNode)) {
    return cloneNode(laterNode);
  }
  if (t.isStringLiteral(laterNode) && t.isObjectExpression(earlierNode)) {
    return cloneNode(earlierNode);
  }

  if (t.isStringLiteral(earlierNode) && t.isStringLiteral(laterNode)) {
    return t.stringLiteral(mergeStrings(lang, earlierNode.value, laterNode.value));
  }

  if (t.isObjectExpression(earlierNode) && t.isObjectExpression(laterNode)) {
    return mergeObjects(lang, earlierNode, laterNode);
  }

  return cloneNode(laterNode);
}

function mergeObjects(lang, earlierObj, laterObj) {
  const resultProps = laterObj.properties.map((p) => cloneNode(p));
  const indexByKey = new Map();
  for (let i = 0; i < resultProps.length; i++) {
    const k = propKeyName(resultProps[i]);
    if (k != null) indexByKey.set(k, i);
  }

  for (const prop of earlierObj.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) continue;
    const key = propKeyName(prop);
    if (key == null) continue;

    if (!indexByKey.has(key)) {
      resultProps.push(cloneNode(prop));
      indexByKey.set(key, resultProps.length - 1);
    } else {
      const idx = indexByKey.get(key);
      const existing = resultProps[idx];
      if (t.isObjectProperty(existing)) {
        const mergedVal = mergeValues(lang, prop.value, existing.value);
        resultProps[idx] = t.objectProperty(
          cloneNode(existing.key),
          mergedVal,
          existing.computed,
          existing.shorthand
        );
      }
    }
  }

  return t.objectExpression(resultProps);
}

/** Remove duplicate keys in a single object (not nested walk). */
function dedupeObjectExpression(lang, objNode) {
  const groups = new Map();
  objNode.properties.forEach((prop, i) => {
    const key = propKeyName(prop);
    if (key == null) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });

  let changed = false;
  const remove = new Set();

  for (const [, indices] of groups) {
    if (indices.length < 2) continue;
    changed = true;
    let merged = cloneNode(objNode.properties[indices[indices.length - 1]]);
    for (let j = 0; j < indices.length - 1; j++) {
      const earlier = objNode.properties[indices[j]];
      if (!t.isObjectProperty(merged) || !t.isObjectProperty(earlier)) continue;
      const mergedVal = mergeValues(lang, earlier.value, merged.value);
      merged = t.objectProperty(cloneNode(merged.key), mergedVal, merged.computed, merged.shorthand);
      remove.add(indices[j]);
    }
    objNode.properties[indices[indices.length - 1]] = merged;
  }

  if (remove.size) {
    objNode.properties = objNode.properties.filter((_, i) => !remove.has(i));
  }
  return changed;
}

function processFile(file) {
  const lang = file.replace(/\.js$/, '');
  const full = path.join(DIR, file);
  const code = fs.readFileSync(full, 'utf8');
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  let changed = false;

  // Bottom-up: exit handlers run after children
  traverse(ast, {
    ObjectExpression: {
      exit(path) {
        if (dedupeObjectExpression(lang, path.node)) changed = true;
      },
    },
  });

  if (!changed) {
    return { file, changed: false };
  }

  const output = generate(ast, {
    jsescOption: { minimal: true },
    comments: true,
  }).code;

  fs.writeFileSync(full, output.endsWith('\n') ? output : output + '\n');
  return { file, changed: true };
}

const args = process.argv.slice(2);
const files = args.length
  ? args
  : fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).sort();

for (const file of files) {
  const result = processFile(file);
  console.log(`${result.file}: ${result.changed ? 'merged & wrote' : 'no changes'}`);
}
