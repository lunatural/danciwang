// 兼容旧浏览器：ctx.roundRect 方法在部分版本不支持，手动实现
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

const quotes = [
  "学而不思则罔，思而不学则殆。",
  "不积跬步，无以至千里。",
  "业精于勤，荒于嬉。",
  "温故而知新，可以为师矣。",
  "敏而好学，不耻下问。",
  "千里之行，始于足下。",
  "书山有路勤为径，学海无涯苦作舟。",
  "知之者不如好之者，好之者不如乐之者。",
];

export interface ShareStats {
  learnedCount: number;
  reviewedCount: number;
  totalCount: number;
}

export function generateShareImage(stats: ShareStats): Promise<Blob> {
  const W = 750;
  const H = 1000;
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W * 0.7, H);
  bg.addColorStop(0, "#6366f1");
  bg.addColorStop(0.5, "#4F46E5");
  bg.addColorStop(1, "#3730a3");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative circles
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.beginPath();
  ctx.arc(W - 60, 120, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, H - 100, 140, 0, Math.PI * 2);
  ctx.fill();

  // Main glass card
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.beginPath();
  roundRect(ctx,30, 35, W - 60, H - 70, 28);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx,30, 35, W - 60, H - 70, 28);
  ctx.stroke();

  // Top section
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "56px serif";
  ctx.fillText("📖", W / 2, 150);

  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.font = "bold 32px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
  ctx.fillText("单词大师", W / 2, 205);

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = "20px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
  ctx.fillText("今日学习打卡", W / 2, 245);

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "15px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
  ctx.fillText(dateStr, W / 2, 275);

  // Stats columns
  const statCols = [
    { icon: "📚", label: "今日学习", value: stats.learnedCount },
    { icon: "🔄", label: "今日复习", value: stats.reviewedCount },
    { icon: "📊", label: "总词汇量", value: stats.totalCount },
  ];

  const colW = 200;
  const colH = 170;
  const colGap = 24;
  const totalW = colW * 3 + colGap * 2;
  const startX = (W - totalW) / 2;
  const colY = 310;

  ctx.textAlign = "center";

  for (let i = 0; i < statCols.length; i++) {
    const col = statCols[i];
    const x = startX + i * (colW + colGap);

    // Column card background
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    roundRect(ctx,x, colY, colW, colH, 18);
    ctx.fill();

    // Icon
    ctx.fillStyle = "#ffffff";
    ctx.font = "34px serif";
    ctx.fillText(col.icon, x + colW / 2, colY + 52);

    // Value
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
    ctx.fillText(String(col.value), x + colW / 2, colY + 100);

    // Label
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "16px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
    ctx.fillText(col.label, x + colW / 2, colY + 136);
  }

  // Divider
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(90, 535);
  ctx.lineTo(W - 90, 535);
  ctx.stroke();

  // Motivational quote
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = "18px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
  ctx.fillText(quote, W / 2, 590);

  // Progress message
  if (stats.learnedCount > 0 || stats.reviewedCount > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "15px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
    ctx.fillText("每一天的坚持，都是未来的基石", W / 2, 630);
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = "15px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
    ctx.fillText("今天开始学习吧！", W / 2, 630);
  }

  // Footer
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "13px 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
  ctx.fillText("danciwang.pages.dev", W / 2, H - 70);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      }, "image/png");
    } catch {
      // toBlob 不支持时回退到 dataURL
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const byteString = atob(dataUrl.split(",")[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        resolve(new Blob([ab], { type: "image/png" }));
      } catch (e) {
        reject(e);
      }
    }
  });
}
