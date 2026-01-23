/**
 * AIYOU Backend Server
 * 提供 OSS 文件上传 API
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import COS from 'cos-nodejs-sdk-v5';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeLog } from './logger.js';

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
 * Sora 2 API 代理 - 提交视频生成任务
 * POST /api/sora/generations
 */
app.post('/api/sora/generations', async (req, res) => {
  const startTime = Date.now();
  const logId = `sora-submit-${Date.now()}`;

  try {
    const { prompt, images, aspect_ratio, duration, hd, watermark, private: isPrivate } = req.body;

    // 从请求头获取 API Key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少 API Key，请在请求头中提供 X-API-Key'
      });
    }

    const requestBody = {
      prompt: prompt || '',
      model: 'sora-2',
      images: images || [],
      aspect_ratio: aspect_ratio || '16:9',
      duration: duration || '10',
      hd: hd !== undefined ? hd : true,
      watermark: watermark !== undefined ? watermark : true,
      private: isPrivate !== undefined ? isPrivate : true
    };

    console.log('📹 Sora API 代理: 提交视频生成任务', {
      promptLength: prompt?.length,
      hasImages: !!images?.length,
      aspect_ratio,
      duration,
      requestBody: JSON.stringify(requestBody)
    });

    const response = await fetch('https://hk-api.gptbest.vip/v2/videos/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    const elapsed = Date.now() - startTime;

    console.log('📹 Sora API 响应:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ Sora API 错误:', response.status, data);

      // 记录错误日志
      writeLog({
        id: logId,
        timestamp: Date.now(),
        apiName: 'submitSoraTask',
        status: 'error',
        duration: elapsed,
        request: {
          aspectRatio: aspect_ratio,
          duration: duration,
          hd: hd,
          hasImages: !!images?.length,
          promptLength: prompt?.length
        },
        response: {
          success: false,
          error: data.message || data.error || 'Sora API 请求失败',
          details: data
        }
      });

      return res.status(response.status).json({
        success: false,
        error: data.message || data.error || 'Sora API 请求失败',
        details: data
      });
    }

    console.log('✅ Sora API 代理: 任务提交成功', data.id || data.task_id || 'NO_ID');

    // 记录成功日志
    writeLog({
      id: logId,
      timestamp: Date.now(),
      apiName: 'submitSoraTask',
      status: 'success',
      duration: elapsed,
      request: {
        aspectRatio: aspect_ratio,
        duration: duration,
        hd: hd,
        hasImages: !!images?.length,
        promptLength: prompt?.length
      },
      response: {
        success: true,
        data: {
          taskId: data.id || data.task_id,
          status: data.status
        }
      }
    });

    res.json(data);

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('❌ Sora API 代理错误:', error);

    // 记录错误日志
    writeLog({
      id: logId,
      timestamp: Date.now(),
      apiName: 'submitSoraTask',
      status: 'error',
      duration: elapsed,
      request: {
        aspectRatio: req.body.aspect_ratio,
        duration: req.body.duration
      },
      response: {
        success: false,
        error: error.message || 'Sora API 代理请求失败'
      }
    });

    res.status(500).json({
      success: false,
      error: error.message || 'Sora API 代理请求失败'
    });
  }
});

/**
 * Sora 2 API 代理 - 查询任务状态
 * GET /api/sora/generations/:taskId
 */
app.get('/api/sora/generations/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    // 从请求头获取 API Key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少 API Key，请在请求头中提供 X-API-Key'
      });
    }

    const response = await fetch(`https://hk-api.gptbest.vip/v2/videos/generations/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Sora API 查询错误:', response.status, data);
      return res.status(response.status).json({
        success: false,
        error: data.message || data.error || 'Sora API 查询失败',
        details: data
      });
    }

    res.json(data);

  } catch (error) {
    console.error('❌ Sora API 代理查询错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Sora API 代理查询失败'
    });
  }
});

// ============================================================================
// 云雾 API 代理
// ============================================================================

/**
 * 云雾 API 代理 - 提交视频生成任务
 * POST /api/yunwu/create
 */
app.post('/api/yunwu/create', async (req, res) => {
  const startTime = Date.now();
  const logId = `yunwu-submit-${Date.now()}`;

  try {
    // 从请求头获取 API Key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      console.error(`[${logId}] ❌ 缺少 API Key`);
      return res.status(401).json({
        success: false,
        error: '缺少 API Key，请在请求头中提供 X-API-Key'
      });
    }

    const { prompt, images, model, orientation, duration, size, watermark } = req.body;

    console.log(`[${logId}] 📤 云雾 API 提交任务:`, {
      prompt: prompt?.substring(0, 100) + '...',
      hasImages: !!images?.length,
      orientation,
      duration,
      size,
      watermark,
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
    });

    // 构建云雾 API 请求
    const yunwuRequestBody = {
      prompt,
      model: model || 'sora-2',
      images: images || [],
      orientation,
      duration,
      size,
      watermark: watermark !== undefined ? watermark : false,
    };

    console.log(`[${logId}] 📋 发送到云雾 API 的请求体:`, JSON.stringify(yunwuRequestBody, null, 2));
    console.log(`[${logId}] 🌐 请求 URL: https://yunwu.ai/v1/video/create`);

    const response = await fetch('https://yunwu.ai/v1/video/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(yunwuRequestBody),
    });

    const responseText = await response.text();
    const durationMs = Date.now() - startTime;

    console.log(`[${logId}] 📥 云雾 API 原始响应:`, {
      status: response.status,
      statusText: response.statusText,
      responseText: responseText.substring(0, 500),
      duration: `${durationMs}ms`,
    });

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[${logId}] ❌ 解析响应 JSON 失败:`, e.message);
      data = { rawResponse: responseText };
    }

    if (!response.ok) {
      console.error(`[${logId}] ❌ 云雾 API 错误:`, response.status, data);
      return res.status(response.status).json({
        success: false,
        error: data.message || data.error || '云雾 API 提交失败',
        details: data
      });
    }

    console.log(`[${logId}] ✅ 云雾 API 成功:`, {
      status: response.status,
      taskId: data.id,
      taskStatus: data.status,
      duration: `${durationMs}ms`,
    });

    res.json(data);

  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[${logId}] ❌ 云雾 API 代理错误 (${durationMs}ms):`, error);
    res.status(500).json({
      success: false,
      error: error.message || '云雾 API 代理提交失败'
    });
  }
});

/**
 * 云雾 API 代理 - 查询任务状态
 * GET /api/yunwu/query
 */
app.get('/api/yunwu/query', async (req, res) => {
  const startTime = Date.now();
  const logId = `yunwu-query-${Date.now()}`;

  try {
    const taskId = req.query.id;

    if (!taskId) {
      console.error(`[${logId}] ❌ 缺少任务 ID`);
      return res.status(400).json({
        success: false,
        error: '缺少任务 ID，请在查询参数中提供 id'
      });
    }

    // 从请求头获取 API Key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      console.error(`[${logId}] ❌ 缺少 API Key`);
      return res.status(401).json({
        success: false,
        error: '缺少 API Key，请在请求头中提供 X-API-Key'
      });
    }

    console.log(`[${logId}] 🔍 云雾 API 查询任务:`, { taskId });

    const response = await fetch(`https://yunwu.ai/v1/video/query?id=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    const durationMs = Date.now() - startTime;
    const detail = data.detail || {};

    console.log(`[${logId}] ✅ 云雾 API 查询响应:`, {
      status: response.status,
      taskId: data.id,
      taskStatus: detail.status,
      progress: detail.progress_pct,
      hasVideo: !!(detail.generations && detail.generations[0]?.url),
      duration: `${durationMs}ms`,
    });

    if (!response.ok) {
      console.error(`[${logId}] ❌ 云雾 API 查询错误:`, response.status, data);
      return res.status(response.status).json({
        success: false,
        error: data.message || data.error || '云雾 API 查询失败',
        details: data
      });
    }

    res.json(data);

  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[${logId}] ❌ 云雾 API 代理查询错误 (${durationMs}ms):`, error);
    res.status(500).json({
      success: false,
      error: error.message || '云雾 API 代理查询失败'
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
 * 前端日志上报接口
 * POST /api/logs
 * 接收前端发送的日志并保存到服务器文件
 */
app.post('/api/logs', async (req, res) => {
  try {
    const logEntry = req.body;

    // 验证日志格式
    if (!logEntry || !logEntry.apiName) {
      return res.status(400).json({
        success: false,
        error: '无效的日志格式'
      });
    }

    // 写入日志文件
    const written = writeLog(logEntry);

    if (written) {
      console.log(`📝 前端日志已记录: ${logEntry.apiName} - ${logEntry.status}`);
      res.json({
        success: true,
        message: '日志已保存'
      });
    } else {
      res.status(500).json({
        success: false,
        error: '日志保存失败'
      });
    }

  } catch (error) {
    console.error('❌ 日志上报失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '日志上报失败'
    });
  }
});

/**
 * 获取日志统计接口
 * GET /api/logs/stats
 */
app.get('/api/logs/stats', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');

    const API_LOG_FILE = path.join(process.cwd(), '../logs/api.log');
    const ERROR_LOG_FILE = path.join(process.cwd(), '../logs/error.log');

    let apiLogStats = { exists: false, size: 0, lines: 0 };
    let errorLogStats = { exists: false, size: 0, lines: 0 };

    if (fs.existsSync(API_LOG_FILE)) {
      const stats = fs.statSync(API_LOG_FILE);
      const content = fs.readFileSync(API_LOG_FILE, 'utf8');
      apiLogStats = {
        exists: true,
        size: stats.size,
        lines: content.split('\n').filter(line => line.trim().length > 0).length
      };
    }

    if (fs.existsSync(ERROR_LOG_FILE)) {
      const stats = fs.statSync(ERROR_LOG_FILE);
      const content = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
      errorLogStats = {
        exists: true,
        size: stats.size,
        lines: content.split('\n').filter(line => line.trim().length > 0).length
      };
    }

    res.json({
      success: true,
      apiLog: apiLogStats,
      errorLog: errorLogStats
    });

  } catch (error) {
    console.error('❌ 获取日志统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取日志统计失败'
    });
  }
});

// ============================================================================
// 视频数据库存储系统
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 视频存储目录
const VIDEOS_DIR = path.join(__dirname, '../videos');
const VIDEO_DB_FILE = path.join(__dirname, '../videos/database.json');

// 确保目录存在
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// 初始化视频数据库
if (!fs.existsSync(VIDEO_DB_FILE)) {
  fs.writeFileSync(VIDEO_DB_FILE, JSON.stringify({ videos: [] }, null, 2));
}

/**
 * 读取视频数据库
 */
function readVideoDatabase() {
  try {
    const data = fs.readFileSync(VIDEO_DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[视频数据库] 读取失败:', error);
    return { videos: [] };
  }
}

/**
 * 写入视频数据库
 */
function writeVideoDatabase(data) {
  try {
    fs.writeFileSync(VIDEO_DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('[视频数据库] 写入失败:', error);
    return false;
  }
}

/**
 * 保存视频到数据库
 * POST /api/videos/save
 */
app.post('/api/videos/save', async (req, res) => {
  try {
    const { videoUrl, taskId, taskNumber, soraPrompt } = req.body;

    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: '缺少 videoUrl 参数'
      });
    }

    console.log(`[视频保存] 开始保存视频:`, {
      taskId,
      taskNumber,
      videoUrl: videoUrl.substring(0, 100) + '...'
    });

    // 1. 下载视频
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`视频下载失败: HTTP ${response.status}`);
    }

    // 2. 生成文件名和路径
    const filename = `sora-${taskId || 'unknown'}-${Date.now()}.mp4`;
    const filepath = path.join(VIDEOS_DIR, filename);

    // 3. 保存视频文件
    const { Readable } = await import('stream');
    const nodeStream = Readable.fromWeb(response.body);
    const fileStream = fs.createWriteStream(filepath);

    await new Promise((resolve, reject) => {
      nodeStream.pipe(fileStream);
      nodeStream.on('end', resolve);
      nodeStream.on('error', reject);
      fileStream.on('error', reject);
    });

    // 4. 获取文件大小
    const stats = fs.statSync(filepath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`[视频保存] ✅ 视频已保存: ${filename} (${fileSizeMB} MB)`);

    // 5. 更新数据库
    const db = readVideoDatabase();
    const videoRecord = {
      id: taskId || `video-${Date.now()}`,
      filename,
      filepath,
      taskId,
      taskNumber,
      soraPrompt: soraPrompt ? soraPrompt.substring(0, 500) : undefined,
      originalUrl: videoUrl,
      fileSize: stats.size,
      createdAt: new Date().toISOString()
    };

    db.videos.push(videoRecord);
    writeVideoDatabase(db);

    res.json({
      success: true,
      message: '视频保存成功',
      video: {
        id: videoRecord.id,
        filename,
        fileSize: stats.size,
        downloadUrl: `/api/videos/download/${videoRecord.id}`
      }
    });

  } catch (error) {
    console.error('[视频保存] ❌ 保存失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '视频保存失败'
    });
  }
});

/**
 * 从数据库下载视频
 * GET /api/videos/download/:id
 */
app.get('/api/videos/download/:id', (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[视频下载] 请求下载视频 ID: ${id}`);

    // 1. 从数据库查找视频记录
    const db = readVideoDatabase();
    const videoRecord = db.videos.find(v => v.id === id);

    if (!videoRecord) {
      return res.status(404).json({
        success: false,
        error: '视频不存在'
      });
    }

    // 2. 检查文件是否存在
    if (!fs.existsSync(videoRecord.filepath)) {
      return res.status(404).json({
        success: false,
        error: '视频文件已丢失'
      });
    }

    console.log(`[视频下载] 开始传输: ${videoRecord.filename}`);

    // 3. 设置响应头
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${videoRecord.filename}"`);
    res.setHeader('Content-Length', videoRecord.fileSize);

    // 4. 流式传输文件
    const fileStream = fs.createReadStream(videoRecord.filepath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      console.log(`[视频下载] ✅ 传输完成: ${videoRecord.filename}`);
    });

    fileStream.on('error', (error) => {
      console.error(`[视频下载] ❌ 传输失败:`, error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: '文件传输失败'
        });
      }
    });

  } catch (error) {
    console.error('[视频下载] ❌ 下载失败:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || '视频下载失败'
      });
    }
  }
});

/**
 * 获取视频列表
 * GET /api/videos/list
 */
app.get('/api/videos/list', (req, res) => {
  try {
    const db = readVideoDatabase();

    // 计算总大小
    const totalSize = db.videos.reduce((sum, v) => sum + (v.fileSize || 0), 0);

    res.json({
      success: true,
      count: db.videos.length,
      totalSize,
      videos: db.videos.map(v => ({
        id: v.id,
        filename: v.filename,
        taskNumber: v.taskNumber,
        fileSize: v.fileSize,
        createdAt: v.createdAt,
        downloadUrl: `/api/videos/download/${v.id}`
      }))
    });
  } catch (error) {
    console.error('[视频列表] ❌ 查询失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '查询失败'
    });
  }
});

/**
 * 删除视频
 * DELETE /api/videos/:id
 */
app.delete('/api/videos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = readVideoDatabase();
    const videoIndex = db.videos.findIndex(v => v.id === id);

    if (videoIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '视频不存在'
      });
    }

    const videoRecord = db.videos[videoIndex];

    // 删除文件
    if (fs.existsSync(videoRecord.filepath)) {
      fs.unlinkSync(videoRecord.filepath);
      console.log(`[视频删除] ✅ 已删除文件: ${videoRecord.filename}`);
    }

    // 从数据库删除
    db.videos.splice(videoIndex, 1);
    writeVideoDatabase(db);

    res.json({
      success: true,
      message: '视频已删除'
    });
  } catch (error) {
    console.error('[视频删除] ❌ 删除失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '删除失败'
    });
  }
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
