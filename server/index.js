/**
 * AIYOU Backend Server
 * 提供 OSS 文件上传 API
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import COS from 'cos-nodejs-sdk-v5';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: ['http://localhost:4000', 'http://127.0.0.1:4000'],
  credentials: true
}));
app.use(express.json());

// 配置文件上传（使用内存存储，限制文件大小为 100MB）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10
  }
});

// OSS 配置
const ossConfig = {
  bucket: process.env.OSS_BUCKET || 'aiyou-1256635214',
  region: process.env.OSS_REGION || 'ap-guangzhou',
  secretId: process.env.OSS_SECRET_ID,
  secretKey: process.env.OSS_SECRET_KEY
};

// 初始化腾讯云 COS SDK
const cos = new COS({
  SecretId: ossConfig.secretId,
  SecretKey: ossConfig.secretKey,
});

/**
 * 健康检查接口
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AIYOU Backend Server is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * OSS 文件上传接口
 * POST /api/upload-oss
 */
app.post('/api/upload-oss', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }

    const { originalname, mimetype, buffer, size } = req.file;
    const { folder = 'aiyou-uploads' } = req.body;

    // 验证文件类型
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/mp3'
    ];

    if (!allowedTypes.includes(mimetype)) {
      return res.status(400).json({
        success: false,
        error: `不支持的文件类型: ${mimetype}`
      });
    }

    // 验证文件大小（限制 50MB）
    const maxSize = 50 * 1024 * 1024;
    if (size > maxSize) {
      return res.status(400).json({
        success: false,
        error: `文件大小超过限制: ${(size / 1024 / 1024).toFixed(2)}MB (最大 50MB)`
      });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = originalname.split('.').pop();
    const fileName = `${folder}/${timestamp}_${random}.${ext}`;

    console.log('📤 开始上传到 OSS:', {
      originalName: originalname,
      fileName: fileName,
      size: `${(size / 1024).toFixed(2)}KB`,
      type: mimetype
    });

    // 上传到腾讯云 COS
    const result = await new Promise((resolve, reject) => {
      cos.putObject({
        Bucket: ossConfig.bucket,
        Region: ossConfig.region,
        Key: fileName,
        Body: buffer,
        ContentType: mimetype,
      }, (err, data) => {
        if (err) {
          console.error('❌ OSS 上传失败:', err);
          reject(err);
        } else {
          console.log('✅ OSS 上传成功:', data.Location);
          resolve(data);
        }
      });
    });

    // 返回文件 URL
    const fileUrl = `https://${ossConfig.bucket}.cos.${ossConfig.region}.myqcloud.com/${fileName}`;

    res.json({
      success: true,
      url: fileUrl,
      fileName: fileName,
      size: size,
      type: mimetype,
      originalName: originalname
    });

  } catch (error) {
    console.error('❌ 上传失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '文件上传失败'
    });
  }
});

/**
 * 获取 OSS 上传预签名 URL（可选，用于直接前端上传）
 * GET /api/oss-upload-url?fileName=example.jpg&fileType=image/jpeg
 */
app.get('/api/oss-upload-url', async (req, res) => {
  try {
    const { fileName, fileType = 'image/jpeg' } = req.query;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: '缺少 fileName 参数'
      });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const finalFileName = `aiyou-uploads/${timestamp}_${random}_${fileName}`;

    // 生成预签名 URL（有效期 1 小时）
    const result = await new Promise((resolve, reject) => {
      cos.getObjectUrl({
        Bucket: ossConfig.bucket,
        Region: ossConfig.region,
        Key: finalFileName,
        Method: 'PUT',
        Sign: true,
        Expires: 3600, // 1小时
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    res.json({
      success: true,
      uploadUrl: result.Url,
      fileName: finalFileName,
      expiresIn: 3600
    });

  } catch (error) {
    console.error('❌ 生成预签名 URL 失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '生成预签名 URL 失败'
    });
  }
});

/**
 * 错误处理
 */
app.use((err, req, res, next) => {
  console.error('❌ 服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

/**
 * 404 处理
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

/**
 * 启动服务器
 */
app.listen(PORT, () => {
  console.log('🚀 AIYOU Backend Server started');
  console.log(`📍 HTTP: http://localhost:${PORT}`);
  console.log(`🔧 Health: http://localhost:${PORT}/api/health`);
  console.log(`📤 Upload: http://localhost:${PORT}/api/upload-oss`);
  console.log('');
  console.log('⚙️  OSS Configuration:');
  console.log(`   Bucket: ${ossConfig.bucket}`);
  console.log(`   Region: ${ossConfig.region}`);
});
