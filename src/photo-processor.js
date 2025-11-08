#!/usr/bin/env node
/**
 * 公务员照片处理
 * 使用方法: node photo-processor.js input.jpg [output.jpg]
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// 官方标识符配置
const WATERMARK_MARKER = Buffer.from([0xff, 0x02]);
const WATERMARK_DATA = Buffer.from("gjgwy2", "ascii");
const MIN_WIDTH = 295;
const MIN_HEIGHT = 413;
const TARGET_SIZE = 10 * 1024; // 10KB

/**
 * 照片处理类
 */
class PhotoProcessor {
  constructor(options = {}) {
    this.silent = options.silent !== false; // 默认静默模式
  }

  /**
   * 验证照片
   */
  async validatePhoto(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();

      if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
        return {
          valid: false,
          error: `照片尺寸不符合要求，需要至少 ${MIN_WIDTH}x${MIN_HEIGHT} 像素`,
        };
      }

      return { valid: true, metadata };
    } catch (error) {
      return { valid: false, error: `无法读取照片: ${error.message}` };
    }
  }

  /**
   * 压缩照片到目标大小
   */
  async compressToTargetSize(imagePath, targetSize = TARGET_SIZE) {
    let quality = 85;
    let buffer;

    // 二分查找最佳质量参数
    while (quality > 10) {
      buffer = await sharp(imagePath)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      if (buffer.length <= targetSize) {
        return buffer;
      }

      quality -= 5;
    }

    // 如果还是太大，缩小尺寸
    if (buffer.length > targetSize * 1.5) {
      const metadata = await sharp(imagePath).metadata();
      const scale = Math.sqrt(targetSize / buffer.length);
      const newWidth = Math.floor(metadata.width * scale);
      const newHeight = Math.floor(metadata.height * scale);

      buffer = await sharp(imagePath)
        .resize(newWidth, newHeight)
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    }

    return buffer;
  }

  /**
   * 添加官方标识符到 JPG 文件末尾
   */
  addWatermarkSignature(jpegBuffer) {
    // 查找 JPG 结束标记 (FF D9)
    const eoiMarker = Buffer.from([0xff, 0xd9]);
    let eoiPos = -1;

    for (let i = jpegBuffer.length - 2; i >= 0; i--) {
      if (jpegBuffer[i] === 0xff && jpegBuffer[i + 1] === 0xd9) {
        eoiPos = i;
        break;
      }
    }

    if (eoiPos === -1) {
      throw new Error("无效的 JPG 文件，未找到结束标记");
    }

    // 移除原有的末尾数据(如果有)
    const jpegCore = jpegBuffer.slice(0, eoiPos + 2);

    // 构造标识符: FF02 + 长度(2字节) + 数据
    // 注意: 长度 = 长度字段本身(2字节) + 实际数据长度
    const dataLength = WATERMARK_DATA.length;
    const totalLength = 2 + dataLength;
    const lengthBuffer = Buffer.allocUnsafe(2);
    lengthBuffer.writeUInt16BE(totalLength, 0); // 大端序

    // 组合所有部分
    const watermarkSignature = Buffer.concat([
      WATERMARK_MARKER,
      lengthBuffer,
      WATERMARK_DATA,
    ]);

    return Buffer.concat([jpegCore, watermarkSignature]);
  }

  /**
   * 处理照片
   */
  async processPhoto(inputPath, outputPath = "报名照片.jpg") {
    try {
      if (!this.silent) console.log("开始处理照片...\n");

      // 1. 验证照片
      const validation = await this.validatePhoto(inputPath);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      if (!this.silent) {
        console.log(
          `✓ 照片尺寸: ${validation.metadata.width}x${validation.metadata.height}`
        );
        console.log(`  格式: ${validation.metadata.format}`);
      }

      // 2. 压缩照片
      if (!this.silent) console.log("\n正在压缩照片...");
      const compressedBuffer = await this.compressToTargetSize(inputPath);
      if (!this.silent)
        console.log(
          `✓ 压缩后大小: ${compressedBuffer.length} bytes (${(
            compressedBuffer.length / 1024
          ).toFixed(2)} KB)`
        );

      // 3. 添加标识符
      if (!this.silent) console.log("\n正在添加官方标识符...");
      const finalBuffer = this.addWatermarkSignature(compressedBuffer);
      if (!this.silent)
        console.log(
          `✓ 最终文件大小: ${finalBuffer.length} bytes (${(
            finalBuffer.length / 1024
          ).toFixed(2)} KB)`
        );

      // 4. 保存文件
      fs.writeFileSync(outputPath, finalBuffer);
      if (!this.silent) console.log(`\n✓ 照片处理完成: ${outputPath}`);

      return { success: true, outputPath, size: finalBuffer.length };
    } catch (error) {
      return { success: false, error: `处理失败: ${error.message}` };
    }
  }
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("使用方法: node photo-processor.js <输入照片> [输出照片]");
    console.log("示例: node photo-processor.js input.jpg output.jpg");
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] || "报名照片.jpg";

  if (!fs.existsSync(inputPath)) {
    console.error(`错误: 文件不存在: ${inputPath}`);
    process.exit(1);
  }

  const processor = new PhotoProcessor({ silent: false }); // 命令行模式下启用日志

  processor
    .processPhoto(inputPath, outputPath)
    .then((result) => {
      if (!result.success) {
        console.error(`\n✗ ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(`\n✗ 发生错误: ${error.message}`);
      process.exit(1);
    });
}

module.exports = PhotoProcessor;
