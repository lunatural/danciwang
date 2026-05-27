# 单词大师

智能英语单词学习应用，支持查词、学习、间隔复习一站式流程。

**[danciwang.pages.dev](https://danciwang.pages.dev)**

## 功能

### 查单词
- 中/英文输入，自动识别并翻译或查词
- 多级数据源回退：Free Dictionary API → 内置 ECDICT（5.9 万词条）→ 已导入的 Anki 词库
- 释义、音标、发音、近义词、例句完整展示
- **悬浮查词**：点击释义、例句、近义词中的任意单词，弹出可拖拽悬浮窗查看详细释义，支持 700+ 短语动词识别

### 学习
- 单词卡片含完整释义、发音音频、例句、近义词
- 分组筛选 + 排序（默认 / A-Z / Z-A / 随机）
- 学完自动进入 SM-2 复习队列
- 3D 倾斜卡片效果（桌面端）

### 复习
- 基于 SM-2 间隔记忆算法，自动计算下次复习时间
- 3D 翻转卡片：正面单词，背面释义 + 例句 + 近义词
- 三档评价（生疏 / 一般 / 熟练），动态调整间隔
- **复习记录**：堆叠卡片展示所有已复习单词，按下次复习时间排序，颜色标记紧急程度（过期/今天/数天后）
- 点击记录中的单词可弹出悬浮窗查看释义

### 单词本
- 分组管理，支持折叠展开、删除单词或整组
- **内置词汇表**：中考、高考、四级、六级、考研、托福、雅思、GRE、GMAT、SAT、专四、专八、BEC
- **Anki 词库导入**：上传 .apkg 文件自动解析
- **文件导入**：支持 .txt（每行一个单词）或 .json
- 数据导入导出备份

### 首页
- 三张统计卡片（单词本 / 待学习 / 待复习），3D 倾斜效果
- 今日学习统计 + 分享打卡图片生成
- 快捷入口直达查词、学习、复习

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 4 + 毛玻璃设计系统 |
| 图标 | Lucide React |
| 动画 | GSAP 3（入场动画、3D 翻转/倾斜） |
| 路由 | React Router 7 |
| 间隔算法 | SM-2 |
| 本地词典 | ECDICT（5.9 万英汉双语词条） |
| Anki 解析 | sql.js + JSZip |
| 单词 API | Free Dictionary API |
| 翻译 API | MyMemory API |
| 分享图片 | Canvas 渲染 |
| 存储 | localStorage |
| 部署 | Cloudflare Pages |

## 本地开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 生产构建
```

## 部署

```bash
npm run build
npx wrangler pages deploy dist/ --project-name=danciwang
```
