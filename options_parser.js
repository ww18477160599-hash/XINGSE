const fs = require('fs');
const path = require('path');

const optionsFilePath = path.join(__dirname, 'xingse_extracted', 'skills', 'xingse', 'options.txt');
const outputPath = path.join(__dirname, 'data', 'options_default.json');

const content = fs.readFileSync(optionsFilePath, 'utf8');
const lines = content.split(/\r?\n/);

const groupsMap = new Map();
const fields = [];

for (let line of lines) {
  line = line.trim();
  if (!line || line.startsWith('#')) continue;

  const parts = line.split('|');
  if (parts.length < 6) continue;

  const groupId = parts[0].trim();
  const groupName = parts[1].trim();
  const fieldId = parts[2].trim();
  const fieldName = parts[3].trim();
  const type = parts[4].trim(); // single | multi | text
  const extraStr = parts[5].trim();
  let extra = {};
  try {
    extra = extraStr ? JSON.parse(extraStr) : {};
  } catch (e) {
    console.warn(`JSON parse error on field ${fieldId}:`, e.message);
  }

  const optionsRaw = parts.slice(6).join('|').trim();
  const options = optionsRaw ? optionsRaw.split('/').map(s => s.trim()).filter(Boolean) : [];

  if (!groupsMap.has(groupId)) {
    groupsMap.set(groupId, {
      id: groupId,
      name: groupName,
      fields: []
    });
  }

  const fieldObj = {
    id: fieldId,
    name: fieldName,
    groupId,
    groupName,
    type,
    note: extra.note || '',
    activeWhen: extra.active_when || null,
    minimum: extra.minimum,
    options: options,
    customOptions: []
  };

  groupsMap.get(groupId).fields.push(fieldObj);
  fields.push(fieldObj);
}

const groups = Array.from(groupsMap.values());

const result = {
  version: '0.62.7',
  groups,
  totalGroups: groups.length,
  totalFields: fields.length,
  totalDefaultOptions: fields.reduce((acc, f) => acc + f.options.length, 0)
};

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
console.log(`Parsed ${result.totalGroups} groups, ${result.totalFields} fields, ${result.totalDefaultOptions} options.`);
