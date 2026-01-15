# Sora 2 模型配置说明

## API 端点

- **域名**: `https://ai.yijiarj.cn`
- **路径**: `/v1/videos`
- **方法**: `POST`

## 请求格式

```typescript
{
  prompt: string,           // 提示词
  model: string,            // 模型 ID（从下方列表中选择）
  size: string,             // API Key
  input_reference?: string, // 参考图 URL（可选）
  is_story?: string         // 是否为故事模式 '1' 或 undefined（可选）
}
```

## 完整模型列表

所有模型都使用同一个 API 端点，通过 `model` 参数区分：

| 模型 ID | 时长 | 比例 | 分辨率 | 价格 | 说明 |
|--------|------|------|--------|------|------|
| **sora-2-15s-yijia** | 15秒 | 9:16 | 1080x1920 | 0.210元 | 15秒竖屏（基础） |
| **sora-2-pro-10s-large-yijia** | 10秒 | 9:16 | 1080x1920 | 0.850元 | 10秒高清竖屏（Pro） |
| **sora-2-pro-10s-large** | 10秒 | 16:9 | 1920x1080 | 0.850元 | 10秒高清横屏（Pro） |
| **sora-2-15s** | 15秒 | 16:9 | 1920x1080 | 0.210元 | 15秒横屏（基础） |
| **sora-2-pro-15s-yijia** | 15秒 | 9:16 | 1080x1920 | 1.100元 | 15秒竖屏（Pro） |
| **sora-2-10s-large-yijia** | 10秒 | 9:16 | 1080x1920 | 0.550元 | 10秒高清竖屏（基础） |
| **sora-2-pro-10s-yijia** | 10秒 | 9:16 | 1080x1920 | 0.500元 | 10秒竖屏（Pro） |
| **sora-2-pro-15s** | 15秒 | 16:9 | 1920x1080 | 1.100元 | 15秒横屏（Pro） |
| **sora-2-10s-large** | 10秒 | 16:9 | 1920x1080 | 0.550元 | 10秒高清横屏（基础） |
| **sora-2-pro-10s** | 10秒 | 16:9 | 1920x1080 | 0.500元 | 10秒横屏（Pro） |

**注意**: `sora-2-yijia` 是一个旧名称，实际对应 `sora-2-10s-large` 模型（10秒横屏）

## 模型命名规则

```
sora-2-[版本]-[时长]s[-large][-yijia]
```

- **版本**: 无（基础）或 `pro`（高清）
- **时长**: `10s` 或 `15s`
- **-large**: 高清模式（可选）
- **-yijia**: 竖屏（9:16），无后缀为横屏（16:9）

## 使用示例

### TypeScript/JavaScript

```typescript
const response = await fetch('https://ai.yijiarj.cn/v1/videos', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'A cinematic video of a sunset over the ocean',
    model: 'sora-2-pro-15s',  // 15秒横屏 Pro
    size: apiKey,
    is_story: '1'  // 故事模式
  })
});
```

### cURL

```bash
curl --location --request POST 'https://ai.yijiarj.cn/v1/videos' \
--header 'Authorization: Bearer YOUR_API_KEY' \
--header 'Content-Type: application/json' \
--data-raw '{
  "prompt": "A cinematic video",
  "model": "sora-2-pro-15s",
  "size": "YOUR_API_KEY",
  "is_story": "1"
}'
```

## 响应格式

```typescript
{
  id: string,              // 任务 ID
  object: "video",
  model: string,           // 使用的模型
  status: string,          // queued | processing | completed | error
  progress: number,        // 0-100
  created_at: number,      // 时间戳
  size: string             // 分辨率
}
```

## 查询任务状态

```typescript
GET https://ai.yijiarj.cn/v1/videos/{taskId}
Headers:
  Authorization: Bearer {apiKey}
```

## 审查规则

1. **真人内容**: 不得包含真人或拟真人图像
2. **提示词合规**: 禁止暴力、色情、版权侵权或名人信息
3. **结果审查**: 不合规内容即使生成90%以上也可能被拒绝

## 实现要点

### ✅ 正确实现

```typescript
// services/soraService.ts
const requestBody = {
  prompt: soraPrompt,
  model: modelId,  // ✅ 使用传入的模型 ID
  size: apiKey,
  input_reference: referenceImageUrl,
  is_story: isStoryMode ? '1' : undefined
};
```

### ❌ 错误实现

```typescript
// 不要硬编码模型 ID
const requestBody = {
  model: 'sora-2-yijia',  // ❌ 错误：始终使用同一个模型
};
```

## 代码实现位置

- **模型配置**: `services/soraConfigService.ts`
- **API 调用**: `services/soraService.ts`
- **类型定义**: `types.ts` (SoraTaskGroup, SoraModel)
- **节点处理**: `App.tsx` (SORA_VIDEO_GENERATOR)

## 默认模型

当用户未选择模型时，使用：`sora-2-10s-large`（10秒横屏基础版）

