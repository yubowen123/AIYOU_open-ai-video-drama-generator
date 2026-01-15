# Sora 2 API 连通性测试指南

## 方式一：使用浏览器控制台测试（最简单）

### 步骤：

1. **获取 API Key**
   ```javascript
   // 在浏览器控制台执行
   const config = localStorage.getItem('sora_storage_config');
   JSON.parse(config).apiKey;
   ```

2. **发送测试请求**
   ```javascript
   // 在浏览器控制台执行
   const apiKey = 'YOUR_API_KEY_HERE'; // 替换为你的 API Key
   
   fetch('https://ai.yijiarj.cn/v1/videos', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${apiKey}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       prompt: 'A beautiful sunset over the ocean',
       model: 'sora-2-10s-large',
       size: apiKey,
       is_story: '1'
     })
   })
   .then(res => res.json())
   .then(data => {
     console.log('✅ 请求成功！');
     console.log('响应:', data);
   })
   .catch(err => {
     console.error('❌ 请求失败:', err);
   });
   ```

---

## 方式二：使用 Shell 脚本（Mac/Linux）

### 运行：
```bash
cd /Volumes/光波/哎呦漫剧生成
./test-sora-api.sh
```

然后按照提示输入 API Key。

---

## 方式三：使用 Node.js 脚本（跨平台）

### 运行：
```bash
cd /Volumes/光波/哎呦漫剧生成
node test-sora-api.js YOUR_API_KEY
```

---

## 方式四：使用 curl（命令行）

```bash
# 替换 YOUR_API_KEY 为你的实际 API Key
curl --location --request POST 'https://ai.yijiarj.cn/v1/videos' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--header 'Content-Type: application/json' \
--data-raw '{
  "prompt": "A beautiful sunset over the ocean",
  "model": "sora-2-10s-large",
  "size": "YOUR_API_KEY",
  "is_story": "1"
}'
```

---

## 预期成功响应

```json
{
  "id": "4073",
  "object": "video",
  "model": "sora-2-10s-large",
  "status": "queued",
  "progress": 0,
  "created_at": 1762414988,
  "size": "1920x1080"
}
```

---

## 常见错误排查

### ❌ 401 Unauthorized
- **原因**：API Key 不正确或已过期
- **解决**：检查 API Key 是否正确复制

### ❌ 403 Forbidden
- **原因**：API Key 无权限访问此接口
- **解决**：联系 API 提供商确认权限

### ❌ 404 Not Found
- **原因**：API 端点地址错误
- **解决**：确认使用 `https://ai.yijiarj.cn/v1/videos`

### ❌ 429 Too Many Requests
- **原因**：请求频率超限
- **解决**：等待几秒后重试

### ⚠️ 网络连接失败
- **原因**：网络问题或 DNS 解析失败
- **解决**：
  1. 检查网络连接
  2. 尝试访问 https://ai.yijiarj.cn
  3. 检查防火墙设置

---

## 查询任务状态

提交成功后，可以使用返回的任务 ID 查询生成进度：

```javascript
const taskId = 'TASK_ID_HERE'; // 替换为实际任务 ID

fetch(`https://ai.yijiarj.cn/v1/videos/${taskId}`, {
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
})
.then(res => res.json())
.then(data => {
  console.log('任务状态:', data.status);
  console.log('进度:', data.progress, '%');
  if (data.url) {
    console.log('视频地址:', data.url);
  }
});
```

---

## 测试检查清单

- [ ] API Key 已正确配置
- [ ] 网络连接正常
- [ ] 能够访问 https://ai.yijiarj.cn
- [ ] 请求端点地址正确：`/v1/videos`
- [ ] 请求头包含 Authorization 和 Content-Type
- [ ] 请求体包含 prompt、model、size 字段
- [ ] 收到 200 或 201 响应
- [ ] 响应包含任务 ID

