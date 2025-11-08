const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const PhotoProcessor = require("./photo-processor");

const app = express();
const PORT = process.env.PORT || 3000;

// 配置文件上传
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB
    files: 1, // 一次只能上传一个文件
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("只支持 JPG/PNG 格式的图片"));
    }
  },
});

// 确保上传目录存在
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.use(express.static("public"));
app.use(express.json());

// ============ 简单限流 ============
const requestCounts = new Map();
const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 分钟窗口
  const maxRequests = 10; // 每分钟最多 10 次请求

  // 清理过期记录
  if (requestCounts.size > 10000) {
    requestCounts.clear();
  }

  const userRequests = requestCounts.get(ip) || [];
  const recentRequests = userRequests.filter((time) => now - time < windowMs);

  if (recentRequests.length >= maxRequests) {
    return res.status(429).json({
      error: "请求过于频繁，请稍后再试",
      retryAfter: 60,
    });
  }

  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  next();
};

// 主页
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 处理照片上传（应用限流）
app.post("/upload", rateLimit, upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "没有上传文件" });
  }

  const inputPath = req.file.path;
  const outputPath = path.join("uploads", `processed-${Date.now()}.jpg`);

  try {
    const processor = new PhotoProcessor();
    const result = await processor.processPhoto(inputPath, outputPath);

    // 删除上传的临时文件
    fs.unlinkSync(inputPath);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // 返回处理后的文件
    res.download(outputPath, "报名照片.jpg", (err) => {
      // 下载完成后删除临时文件
      if (fs.existsSync(outputPath)) {
        setTimeout(() => {
          try {
            fs.unlinkSync(outputPath);
          } catch (e) {
            console.error("清理临时文件失败:", e);
          }
        }, 1000);
      }

      if (err) {
        console.error("下载出错:", err);
      }
    });
  } catch (error) {
    console.error("处理失败:", error);

    // 清理临时文件
    [inputPath, outputPath].forEach((file) => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          console.error("清理失败:", e);
        }
      }
    });

    res.status(500).json({ error: `处理失败: ${error.message}` });
  }
});

// ============ 错误处理中间件 ============
app.use((err, req, res, next) => {
  console.error("服务器错误:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "文件太大，请上传小于 16MB 的图片" });
    }
    return res.status(400).json({ error: `上传错误: ${err.message}` });
  }

  res.status(500).json({ error: "服务器内部错误" });
});

app.use((req, res) => {
  res.status(404).json({ error: "页面不存在" });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 服务已启动: http://localhost:${PORT}`);
});

// ============ 优雅关闭 ============
const gracefulShutdown = () => {
  console.log("\n正在关闭服务器...");
  server.close(() => {
    console.log("服务器已关闭");
    process.exit(0);
  });

  // 如果 10 秒后还没关闭，强制退出
  setTimeout(() => {
    console.error("强制关闭服务器");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// ============ 定期清理临时文件 ============
setInterval(() => {
  const uploadsDir = "uploads";
  if (!fs.existsSync(uploadsDir)) return;

  const files = fs.readdirSync(uploadsDir);
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 小时

  files.forEach((file) => {
    const filePath = path.join(uploadsDir, file);
    const stat = fs.statSync(filePath);

    if (now - stat.mtimeMs > maxAge) {
      try {
        fs.unlinkSync(filePath);
        console.log(`清理临时文件: ${file}`);
      } catch (e) {
        console.error(`清理失败: ${file}`, e);
      }
    }
  });
}, 30 * 60 * 1000); // 每 30 分钟清理一次

module.exports = app;
