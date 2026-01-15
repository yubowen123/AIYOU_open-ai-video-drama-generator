/**
 * OSS 云存储服务
 * 支持腾讯云 COS 和阿里云 OSS
 */

import { OSSConfig } from '../types';
import COS from 'cos-js-sdk-v5';

/**
 * 生成测试图片
 */
async function generateTestImage(): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // 绘制渐变背景
      const gradient = ctx.createLinearGradient(0, 0, 100, 100);
      gradient.addColorStop(0, '#06b6d4');
      gradient.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 100, 100);

      // 绘制文字
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OSS', 50, 40);
      ctx.fillText('TEST', 50, 60);
    }

    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png');
  });
}

/**
 * 上传文件到后端，由后端代理上传到腾讯云 COS
 */
async function uploadToTencentCOS(
  file: Blob,
  fileName: string,
  config: OSSConfig
): Promise<string> {
  // 后端 API 地址
  const API_BASE_URL = 'http://localhost:3001';

  // 创建 FormData
  const formData = new FormData();
  formData.append('file', file, fileName);
  formData.append('folder', 'aiyou-uploads');

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload-oss`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `上传失败: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '上传失败');
    }

    return result.url;
  } catch (error: any) {
    throw new Error(`OSS 上传失败: ${error.message}`);
  }
}

/**
 * 上传文件到阿里云 OSS
 */
async function uploadToAliyunOSS(
  file: Blob,
  fileName: string,
  config: OSSConfig
): Promise<string> {
  const { bucket, region, accessKey, secretKey } = config;

  // 构建请求 URL
  const host = `${bucket}.${region}.aliyuncs.com`;
  const url = `https://${host}/${fileName}`;

  // 获取当前时间
  const now = new Date();
  const date = now.toUTCString();

  // 构建 OSS 签名
  const method = 'PUT';
  const contentType = 'image/png';
  const canonicalizedResource = `/${bucket}/${fileName}`;
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${canonicalizedResource}`;

  const signature = await hmacSha1(stringToSign, secretKey);
  const authorization = `OSS ${accessKey}:${signature}`;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authorization,
        'Date': date,
        'Content-Type': contentType
      },
      body: file
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`上传失败: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return url;
  } catch (error: any) {
    throw new Error(`阿里云 OSS 上传失败: ${error.message}`);
  }
}

/**
 * HMAC-SHA256 加密
 */
async function hmacSha256Hex(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * HMAC-SHA256 (用于腾讯云签名)
 */
async function hmacSha256(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => String.fromCharCode(b))
    .join('');
}

/**
 * HMAC-SHA1 加密返回 base64 (用于阿里云签名)
 */
async function hmacSha1(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return btoa(String.fromCharCode.apply(null, hashArray as any));
}

/**
 * HMAC-SHA1 加密返回十六进制 (用于腾讯云签名)
 */
async function hmacSha1HexStr(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * HMAC-SHA1 加密使用二进制 key 并返回十六进制
 */
async function hmacSha1WithBinaryKey(message: string, binaryKey: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    binaryKey,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * HMAC-SHA1 加密返回十六进制 (用于腾讯云 COS 签名)
 */
async function hmacSha1Hex(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * HMAC-SHA1 加密返回原始二进制数据
 */
async function hmacSha1Raw(message: string, key: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return new Uint8Array(signature);
}

/**
 * HMAC-SHA1 加密使用二进制 key 并返回 base64
 */
async function hmacSha1Base64(message: string, keyData: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return btoa(String.fromCharCode.apply(null, hashArray as any));
}

/**
 * HMAC-SHA1 加密使用十六进制字符串 key 并返回十六进制
 */
async function hmacSha1HexWithKey(message: string, hexKey: string): Promise<string> {
  // 将十六进制字符串转换为字节数组
  const keyBytes = new Uint8Array(hexKey.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16)));

  const encoder = new TextEncoder();
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 测试 OSS 连接
 * 上传一个小图片验证配置是否正确
 */
export async function testOSSConnection(
  config: OSSConfig,
  onProgress?: (message: string) => void
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!config.bucket || !config.region || !config.accessKey || !config.secretKey) {
      return {
        success: false,
        error: '请填写完整的 OSS 配置信息'
      };
    }

    onProgress?.('生成测试图片...');
    const testImage = await generateTestImage();

    // 生成唯一文件名
    const timestamp = Date.now();
    const fileName = `oss-test-${timestamp}.png`;

    onProgress?.('上传到云存储...');
    let uploadedUrl: string;

    if (config.provider === 'tencent') {
      uploadedUrl = await uploadToTencentCOS(testImage, fileName, config);
    } else {
      uploadedUrl = await uploadToAliyunOSS(testImage, fileName, config);
    }

    onProgress?.('验证上传结果...');

    // 验证上传的文件是否可访问
    try {
      const verifyResponse = await fetch(uploadedUrl, { method: 'HEAD' });
      if (!verifyResponse.ok) {
        throw new Error('文件上传成功但无法访问，请检查 Bucket 权限设置');
      }
    } catch (verifyError: any) {
      // CORS 错误或网络错误，但文件可能已经上传成功
      if (verifyError.message.includes('CORS') || verifyError.message.includes('Failed to fetch')) {
        console.warn('[OSS Test] 无法验证文件访问权限（可能是CORS限制），但文件已成功上传');
        // 不抛出错误，继续返回成功
      } else {
        throw verifyError;
      }
    }

    onProgress?.('测试成功！');
    return {
      success: true,
      url: uploadedUrl
    };
  } catch (error: any) {
    onProgress?.('测试失败');
    return {
      success: false,
      error: error.message || '未知错误'
    };
  }
}

/**
 * 上传文件到 OSS
 */
export async function uploadFileToOSS(
  file: Blob | string,
  fileName: string,
  config: OSSConfig
): Promise<string> {
  // 如果 file 是 string (base64 或 url)，先转换为 Blob
  let blob: Blob;

  if (typeof file === 'string') {
    if (file.startsWith('data:')) {
      // Base64 格式
      const response = await fetch(file);
      blob = await response.blob();
    } else {
      // URL 格式
      const response = await fetch(file);
      blob = await response.blob();
    }
  } else {
    blob = file;
  }

  if (config.provider === 'tencent') {
    return await uploadToTencentCOS(blob, fileName, config);
  } else {
    return await uploadToAliyunOSS(blob, fileName, config);
  }
}
