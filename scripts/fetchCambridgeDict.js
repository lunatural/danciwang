#!/usr/bin/env node

/**
 * 剑桥词典数据抓取脚本
 *
 * 功能：
 * 1. 从 src/utils/api.ts 提取内置词表
 * 2. 使用 cambridge-dictionary-api 逐词抓取
 * 3. 按字母分文件保存到 public/cambridge_*.json
 * 4. 每次请求间隔 1-2 秒避免被反爬
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 日志文件路径
const logFilePath = path.join(__dirname, '../public/fetch-progress.txt');

// 日志函数
function log(message) {
  console.log(message);
  fs.appendFileSync(logFilePath, message + '\n', 'utf-8');
}

// 清空日志文件
function clearLog() {
  fs.writeFileSync(logFilePath, '', 'utf-8');
}

// 读取 api.ts 中的词表
function extractVocabLists() {
  const apiPath = path.join(__dirname, '../src/utils/api.ts');
  const content = fs.readFileSync(apiPath, 'utf-8');

  // 提取 vocabLists 对象
  const vocabListsMatch = content.match(/const vocabLists: Record<string, string\[\]> = \{([\s\S]*?)\};/);
  if (!vocabListsMatch) {
    throw new Error('无法从 api.ts 中提取词表');
  }

  // 使用 eval 解析（仅用于本地脚本，生产环境不要这样做）
  const vocabListsStr = vocabListsMatch[0].replace('const vocabLists: Record<string, string[]> = ', '').slice(0, -1);
  const vocabLists = eval(`(${vocabListsStr})`);

  // 合并所有词表并去重
  const allWords = new Set();
  for (const list of Object.values(vocabLists)) {
    list.forEach(word => allWords.add(word.toLowerCase()));
  }

  return Array.from(allWords).sort();
}

// 按字母分组
function groupByLetter(words) {
  const groups = {};

  // 定义分组：a-d, e-h, i-l, m-p, q-t, u-z
  const ranges = [
    { name: 'a-d', start: 'a', end: 'd' },
    { name: 'e-h', start: 'e', end: 'h' },
    { name: 'i-l', start: 'i', end: 'l' },
    { name: 'm-p', start: 'm', end: 'p' },
    { name: 'q-t', start: 'q', end: 't' },
    { name: 'u-z', start: 'u', end: 'z' }
  ];

  ranges.forEach(range => {
    groups[range.name] = words.filter(word => {
      const first = word[0].toLowerCase();
      return first >= range.start && first <= range.end;
    });
  });

  return groups;
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 抓取单词
async function fetchWord(word) {
  try {
    // 动态导入 cambridge-dictionary-api
    const { fetchDictionaryWord } = await import('cambridge-dictionary-api');

    const data = await fetchDictionaryWord(word);

    if (!data || !data.word) {
      return null;
    }

    // 转换为我们的数据结构
    const result = {
      word: data.word,
      phonetic: '',
      audio: '',
      meanings: []
    };

    // 提取音标和音频（dialects 是对象 { us: { audio, phonetic }, uk: { audio, phonetic } }）
    if (data.dialects) {
      const us = data.dialects.us || {};
      const uk = data.dialects.uk || {};
      result.phonetic = us.phonetic || uk.phonetic || '';
      result.audio = us.audio || uk.audio || '';
    }

    // 提取词性和释义
    if (data.definitions && data.definitions.length > 0) {
      const groupedByPos = {};

      data.definitions.forEach(def => {
        const pos = def.partOfSpeech || 'other';
        if (!groupedByPos[pos]) {
          groupedByPos[pos] = [];
        }
        groupedByPos[pos].push({
          definition: def.definition || '',
          example: (def.examples && def.examples[0]) || ''
        });
      });

      // 转换为 meanings 格式
      for (const [pos, defs] of Object.entries(groupedByPos)) {
        result.meanings.push({
          partOfSpeech: pos,
          definitions: defs
        });
      }
    }

    return result.meanings.length > 0 ? result : null;
  } catch (error) {
    console.error(`  ❌ 抓取失败: ${error.message}`);
    return null;
  }
}

// 主函数
async function main() {
  // 清空之前的日志
  clearLog();

  log('📚 剑桥词典数据抓取脚本');
  log('='.repeat(50));

  // 1. 提取词表
  log('\n📖 正在从 api.ts 提取词表...');
  let allWords;
  try {
    allWords = extractVocabLists();
    log(`✅ 提取成功，共 ${allWords.length} 个词`);
  } catch (error) {
    log(`❌ 提取失败: ${error.message}`);
    process.exit(1);
  }

  // 2. 按字母分组
  log('\n📂 正在按字母分组...');
  const groups = groupByLetter(allWords);
  for (const [range, words] of Object.entries(groups)) {
    log(`  ${range}: ${words.length} 个词`);
  }

  // 3. 检查是否已安装 cambridge-dictionary-api
  log('\n🔍 检查依赖包...');
  try {
    await import('cambridge-dictionary-api');
    log('✅ cambridge-dictionary-api 已安装');
  } catch (error) {
    log('❌ 未找到 cambridge-dictionary-api');
    log('请先运行: npm install cambridge-dictionary-api');
    process.exit(1);
  }

  // 4. 测试抓取一个词
  log('\n🧪 测试抓取功能...');
  const testWord = 'abandon';
  log(`  测试词: ${testWord}`);
  const testResult = await fetchWord(testWord);

  if (!testResult) {
    log('❌ 测试失败，无法获取数据');
    log('可能原因：');
    log('  1. 网络连接问题');
    log('  2. 剑桥词典网站结构变化');
    log('  3. 被反爬机制拦截');
    process.exit(1);
  }

  log('✅ 测试成功');
  log(`  音标: ${testResult.phonetic}`);
  log(`  释义数: ${testResult.meanings.length}`);
  if (testResult.meanings[0]?.definitions[0]) {
    log(`  第一条: ${testResult.meanings[0].definitions[0].definition.slice(0, 60)}...`);
  }

  // 5. 询问是否继续
  log('\n⚠️  准备开始批量抓取');
  log(`   总词数: ${allWords.length}`);
  log(`   预计耗时: ${Math.ceil(allWords.length * 1.5 / 60)} 分钟（按 1.5 秒/词计算）`);
  log('\n按 Ctrl+C 取消，或等待 5 秒后自动开始...');

  await delay(5000);

  // 6. 开始抓取
  log('\n🚀 开始批量抓取...\n');

  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  for (const [range, words] of Object.entries(groups)) {
    const filename = `cambridge_${range}.json`;
    const filepath = path.join(publicDir, filename);

    // 断点续传：加载已有的数据
    let results = {};
    let skipCount = 0;
    if (fs.existsSync(filepath)) {
      try {
        results = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        skipCount = Object.keys(results).length;
        log(`\n📦 处理分组 ${range} (${words.length} 个词, 已有 ${skipCount} 个, 跳过已完成)`);
      } catch {
        log(`\n📦 处理分组 ${range} (${words.length} 个词, 已有文件损坏, 从头开始)`);
      }
    } else {
      log(`\n📦 处理分组 ${range} (${words.length} 个词)`);
    }

    let successCount = Object.keys(results).length;
    let failCount = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // 断点续传：跳过已抓取的词
      if (results[word]) {
        continue;
      }

      const logLine = `  [${i + 1}/${words.length}] ${word}... `;
      process.stdout.write(logLine);

      const data = await fetchWord(word);
      if (data) {
        results[word] = data;
        successCount++;
        log(logLine + '✅');
      } else {
        failCount++;
        log(logLine + '❌');
      }

      // 每抓取 10 个词就保存一次（防中断丢失）
      if ((successCount + failCount) % 10 === 0) {
        fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf-8');
      }

      // 随机延迟 1-2 秒
      const delayMs = 1000 + Math.random() * 1000;
      await delay(delayMs);
    }

    // 最终保存
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf-8');

    log(`\n✅ ${range} 完成: 成功 ${successCount}, 失败 ${failCount}, 跳过 ${skipCount}`);
    log(`   保存到: ${filename} (${(fs.statSync(filepath).size / 1024).toFixed(2)} KB)`);
  }

  log('\n' + '='.repeat(50));
  log('🎉 所有抓取完成！');
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('\n❌ 未处理的错误:', error);
  process.exit(1);
});

// 运行
main().catch(error => {
  console.error('\n❌ 脚本执行失败:', error);
  process.exit(1);
});
