# 单词大师

智能英语单词学习应用，支持查词、学习、间隔复习一站式流程。

**[danciwang.pages.dev](https://danciwang.pages.dev)**

## 功能

### 账号系统
- **邮箱验证注册**：QQ SMTP 发送验证链接，必须点击验证后才能登录
- **密码找回**：登录页"忘记密码"入口，通过邮件链接重置密码
- **邮箱格式校验**：前端拦截无效格式和临时邮箱（mailinator 等 12 个域名）
- **管理员系统**：指定邮箱登录后可见"反馈管理"入口，普通用户无权限
- 支持游客登录

### 查单词
- 中/英文输入，自动识别并翻译或查词
- 多级数据源回退：剑桥词典（本地 6,245 词条）→ Free Dictionary API → 牛津词典（4 万词条）→ 已导入的 Anki 词库
- 释义、音标、发音、近义词、例句完整展示
- 数据来源标签（剑桥/Free API/牛津），点击可切换查看不同词典的释义
- **错误反馈**：点击"⚠️ 反馈"按钮可报告释义错误，支持音标、释义、例句等多种错误类型
- **悬浮查词**：点击释义、例句、近义词中的任意单词，弹出可拖拽悬浮窗查看详细释义，支持 700+ 短语动词识别

### 学习
- 单词卡片含完整释义、发音音频、例句、近义词
- 分组筛选 + 排序（默认 / A-Z / Z-A / 随机）
- 学完自动进入 SM-2 复习队列
- 3D 倾斜卡片效果（桌面端，角度可调）
- **错误反馈**：卡片右上角"⚠️ 反馈"按钮
- 中文翻译黑色高亮显示，清晰可读

### 复习
- 基于 SM-2 间隔记忆算法，自动计算下次复习时间
- **选择题模式**：选择正确的中文释义，干扰项智能筛选（同义词优先、中文有效性校验、词典碎片过滤）
- **拼写模式**：根据中文释义写出英文单词
- **翻牌模式**：熟悉的单词直接翻转查看，三档评价（生疏 / 一般 / 熟练），评分后进入详情卡片
- **滑动手势**：详情卡片支持鼠标拖拽/触摸滑动，左滑下一题、右滑上一题，GSAP 飞离/弹回动画（旋转+缩放+淡出）
- **复习记录**：堆叠卡片展示所有已复习单词，按下次复习时间排序，颜色标记紧急程度

### 单词本
- 分组管理，支持折叠展开、删除单词或整组
- **内置词汇表**：中考核心词汇、考研核心词汇、考研拓展词汇、英语四级词汇、2026考研真题核心词汇（总计 7,383 个独特词条）
- **Anki 词库导入**：上传 .apkg 文件自动解析
- **文件导入**：支持 .txt（每行一个单词）或 .json
- 数据导入导出备份

### 反馈管理（管理员专属）
- 导航栏"反馈"入口仅管理员可见
- 所有用户提交的错误报告汇总展示（待处理 / 已解决分类）
- 支持标记已解决、删除单条、清除已解决记录
- 导出 JSON 备份

### 首页
- 三张统计卡片（单词本 / 待学习 / 待复习），3D 倾斜效果
- 今日学习统计 + 分享打卡图片生成
- 快捷入口直达查词、学习、复习

## 安装到桌面（PWA）

应用支持 PWA 渐进式应用，可安装到手机和电脑桌面：

- **Android / 电脑（Chrome/Edge）**：点击导航栏右侧的下载图标，一键安装
- **iOS Safari**：点击下载图标查看安装引导，或点击分享按钮 →「添加到主屏幕」

安装后以独立窗口运行，支持离线访问。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 4 + 毛玻璃设计系统 |
| 图标 | Lucide React |
| 动画 | GSAP 3（入场动画、3D 翻转/倾斜、滑动飞离/弹回动画） |
| 路由 | React Router 7 |
| 间隔算法 | SM-2 |
| 认证 | Supabase Auth（邮箱验证 + QQ SMTP） |
| 剑桥词典 | 6,245 词条本地 JSON（按字母分 6 个文件，按需加载） |
| 牛津词典 | 4 万英汉词条（管道符分隔格式，含样式说明过滤） |
| 词库抓取 | cambridge-dictionary-api（Node 脚本 + 断点续传 + 进度监控） |
| Anki 解析 | sql.js + JSZip |
| 单词 API | Free Dictionary API（8 秒超时保护） |
| 翻译 API | MyMemory API + Baidu Sug API |
| 分享图片 | Canvas 渲染 |
| 存储 | localStorage + Supabase 云同步 |
| PWA | Service Worker + Web App Manifest |
| 部署 | Cloudflare Pages（含 Functions） |

## 本地开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 生产构建

# 抓取剑桥词典词库（可选）
node scripts/fetchCambridgeDict.js
```

## 数据库

### Supabase 认证配置

```sql
-- 邮箱验证码表（可选，配合自定义验证码流程使用）
CREATE TABLE IF NOT EXISTS email_verifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_ver_lookup 
  ON email_verifications(email, code, expires_at);
```

### 认证配置 (Supabase Dashboard)

| 设置项 | 值 | 说明 |
|--------|-----|------|
| Site URL | `https://danciwang.pages.dev` | 站点地址 |
| Confirm email | ✅ 开启 | 强制邮箱验证 |
| Custom SMTP | QQ 邮箱 | smtp.qq.com:465 |
| JWT Expiry | 3600s (1小时) | 登录令牌有效期 |
| OTP Expiry | 600s (10分钟) | 验证码/重置链接有效期 |
| CAPTCHA Provider | Turnstile | 机器人检测 |

### Cloudflare Pages 环境变量

| 变量名 | 说明 |
|--------|------|
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role 密钥 |
| `RESEND_API_KEY` | Resend 邮件 API 密钥（可选） |

```bash
# 设置环境变量
echo "xxx" | npx wrangler pages secret put SUPABASE_URL --project-name=danciwang
echo "xxx" | npx wrangler pages secret put SUPABASE_SERVICE_KEY --project-name=danciwang
```

### Cloudflare Pages Functions

| 文件 | 功能 |
|------|------|
| `functions/api/check-email.ts` | 检查邮箱是否已注册（调用 Supabase Admin API） |

## 部署

```bash
npm run build
npx wrangler pages deploy dist/ --project-name=danciwang --branch=main
```
