/**
 * Sora 2 API 连通性测试脚本
 * 运行方式：node test-sora-api.js YOUR_API_KEY
 */

const https = require('https');

const API_ENDPOINT = 'https://ai.yijiarj.cn/v1/videos';
const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('❌ 请提供 API Key');
  console.log('\n使用方式: node test-sora-api.js YOUR_API_KEY');
  console.log('\n获取 API Key：');
  console.log('1. 打开浏览器控制台');
  console.log('2. 执行: localStorage.getItem(\'sora_storage_config\')');
  console.log('3. 复制 apiKey 的值');
  process.exit(1);
}

console.log('========================================');
console.log('Sora 2 API 连通性测试');
console.log('========================================\n');

console.log('🔍 测试端点:', API_ENDPOINT);
console.log('🔑 API Key:', API_KEY.substring(0, 10) + '...' + '\n');

const requestBody = {
  prompt: 'A beautiful sunset over the ocean',
  model: 'sora-2-10s-large',
  size: API_KEY,
  is_story: '1'
};

console.log('📦 请求体:');
console.log(JSON.stringify(requestBody, null, 2));
console.log('\n⏳ 发送请求...\n');

const options = {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(API_ENDPOINT, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📊 HTTP 状态码:', res.statusCode);
    console.log('\n📝 响应内容:');

    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log(data);
    }

    console.log('\n' + '='.repeat(40));

    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ API 连接成功！');

      if (jsonData.id) {
        console.log('\n🎬 任务 ID:', jsonData.id);
        console.log('📋 查询任务状态：');
        console.log(`GET https://ai.yijiarj.cn/v1/videos/${jsonData.id}`);
      }
    } else if (res.statusCode === 401) {
      console.log('❌ 认证失败：API Key 不正确或已过期');
    } else if (res.statusCode === 403) {
      console.log('❌ 权限不足：API Key 无权限访问此接口');
    } else if (res.statusCode === 404) {
      console.log('❌ 端点不存在：请检查 API 地址');
    } else if (res.statusCode === 429) {
      console.log('❌ 请求过于频繁：请稍后重试');
    } else {
      console.log('⚠️  请求失败，状态码：', res.statusCode);
    }

    console.log('========================================\n');
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
  console.log('\n可能的原因：');
  console.log('1. 网络连接问题');
  console.log('2. API 服务器不可用');
  console.log('3. DNS 解析失败');
  console.log('========================================\n');
});

req.write(JSON.stringify(requestBody));
req.end();
