# 公务员照片处理工具 🚀

> 在线的公务员考试照片处理工具

[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 📦 快速开始

```bash
# 安装依赖
pnpm install

# 启动 Web 服务
pnpm start
```

浏览器打开 `http://localhost:3000` 即可使用。

或使用命令行处理单张照片：

```bash
node photo-processor.js input.jpg output.jpg
```

## 🔍 工作原理

官方工具会在 JPG 文件末尾（FFD9 标记后）添加特殊标识符：

```text
FF D9                         ← JPG 结束标记
FF 02 00 08 67 6A 67 77 79 32 ← 官方标识符
│     │      │
│     │      └─ "gjgwy2" 数据(6字节)
│     └──────── 长度 0x0008 (8字节)
└────────────── 标记 FF02
```

本工具完整复现了这个逻辑，确保处理后的照片能通过官方验证。

## ⚠️ 注意事项

1. 本工具仅供学习研究使用
2. 照片质量由使用者自行负责
3. 如遇问题，建议使用官方 Windows 工具

## 📄 许可证

GPL-3.0 License

---

Made with ❤️ for all Mac/Linux/Mobile users
