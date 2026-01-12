# 服务层快速集成指南

## ✅ 状态：已完成修改

所有服务层已修改为**直接调用 Google Gemini API**，无需后端服务器。

---

## 📋 已修改的服务

| 服务 | 状态 | API |
|------|------|-----|
| `ImageGeneratorNodeService` | ✅ | `generateImageFromText()` |
| `VideoGeneratorNodeService` | ✅ | `generateVideo()` |
| `AudioGeneratorNodeService` | ✅ | `generateAudio()` |
| `StoryboardSplitterNodeService` | ✅ | 本地处理（Canvas API） |
| `PromptInputNodeService` | ✅ | 仅验证（无需 API） |

---

## 🚀 如何使用（3 步）

### 步骤 1: 在应用启动时注册服务

```typescript
// App.tsx
import { useEffect } from 'react';
import { registerAllNodeServices } from './services/nodes/registry';

function App() {
  useEffect(() => {
    // 注册所有节点服务（只执行一次）
    registerAllNodeServices();
  }, []);

  return <YourApp />;
}
```

### 步骤 2: 使用服务执行节点

```typescript
import { NodeServiceRegistry } from './services/nodes';
import { useAppStore } from './stores/app.store';

function MyComponent() {
  const { nodes, connections, updateNode } = useAppStore();

  const handleExecuteNode = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // 使用服务层执行节点
    const result = await NodeServiceRegistry.executeNode(
      node,
      nodes,           // 所有节点
      connections,     // 所有连接
      (id, status) => updateNode(id, { status }),  // 更新状态
      (id, data) => updateNode(id, data)           // 更新数据
    );

    if (result.success) {
      console.log('✓ 执行成功:', result.data);
    } else {
      console.error('✗ 执行失败:', result.error);
    }
  };

  return (
    <button onClick={() => handleExecuteNode('node-id')}>
      执行节点
    </button>
  );
}
```

### 步骤 3: 批量执行节点（自动依赖排序）

```typescript
const { success, failed, results } = await NodeServiceRegistry.executeNodesInOrder(
  nodes,           // 要执行的节点列表
  connections,     // 所有连接
  updateNode,      // 更新状态
  updateNode,      // 更新数据
  (current, total, currentNode) => {
    // 进度回调
    console.log(`进度: ${current}/${total} - ${currentNode}`);
  }
);

console.log(`成功: ${success}, 失败: ${failed}`);
```

---

## 🔑 API Key 配置

服务层会自动从 `localStorage` 读取 API Key：

```typescript
// 设置 API Key（在设置面板中）
localStorage.setItem('GEMINI_API_KEY', 'your-api-key-here');

// 服务层会自动使用
const apiKey = localStorage.getItem('GEMINI_API_KEY');
```

如果 API Key 未配置，服务会返回错误：
```
GEMINI_API_KEY_NOT_CONFIGURED
```

---

## 📊 服务层数据流

```
用户操作
    ↓
NodeServiceRegistry.executeNode()
    ↓
获取节点服务实例 (单例)
    ↓
服务.validateInputs() → 验证输入
    ↓
服务.execute() → 调用 Gemini API
    ↓
更新节点状态和数据
    ↓
返回 NodeExecutionResult
```

---

## 🎯 完整示例：集成到现有代码

### 示例 1: 替换现有的图像生成逻辑

**之前**（在 App.tsx 或 Node.tsx 中）：

```typescript
// ❌ 旧方式：直接在组件中调用 API
const handleGenerateImage = async (nodeId: string) => {
  const node = nodes.find(n => n.id === nodeId);

  try {
    // 直接调用 geminiService
    const images = await generateImageFromText(
      node.data.prompt,
      node.data.model
    );

    updateNode(nodeId, { imageUrl: images[0] });
  } catch (error) {
    console.error(error);
  }
};
```

**现在**（使用服务层）：

```typescript
// ✅ 新方式：使用服务层
import { NodeServiceRegistry } from './services/nodes';

const handleGenerateImage = async (nodeId: string) => {
  const node = nodes.find(n => n.id === nodeId);

  const result = await NodeServiceRegistry.executeNode(
    node,
    nodes,
    connections,
    updateNode,
    updateNode
  );

  if (!result.success) {
    alert(`生成失败: ${result.error}`);
  }
};
```

### 示例 2: 添加错误边界

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('应用错误:', error, errorInfo);
        // 可以发送到 Sentry
      }}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

---

## 🧪 测试检查清单

- [ ] API Key 已配置（localStorage）
- [ ] 服务已注册（registerAllNodeServices）
- [ ] 单个节点执行成功
- [ ] 批量节点执行成功
- [ ] 错误处理正常工作
- [ ] 节点状态正确更新
- [ ] 节点数据正确保存

---

## ❓ 常见问题

### Q1: 服务调用失败，提示 "GEMINI_API_KEY_NOT_CONFIGURED"

**A**: 需要先设置 API Key：
```typescript
localStorage.setItem('GEMINI_API_KEY', 'your-key');
```

### Q2: 如何调试服务调用？

**A**: 查看控制台日志，所有服务都带有详细日志：
```
[ImageGeneratorNodeService] 开始生成图像: { prompt: "...", model: "..." }
[ImageGeneratorNodeService] 图像生成成功: ["data:image/png;base64,..."]
```

### Q3: 如何添加新的节点服务？

**A**: 3 步：
1. 创建服务类继承 `BaseNodeService`
2. 实现 `execute()` 方法
3. 在 `registry.ts` 中注册

示例：
```typescript
// 1. 创建服务
export class MyNodeService extends BaseNodeService {
  readonly nodeType = 'MY_NODE_TYPE';

  async execute(node, context) {
    // 调用 API 或处理数据
    const result = await someAPI(node.data);

    return this.createSuccessResult(result);
  }
}

// 2. 注册服务
NodeServiceRegistry.register('MY_NODE_TYPE', MyNodeService);
```

### Q4: 如何查看服务执行的详细日志？

**A**: 服务层已集成 `apiLogger`，所有 API 调用都会被记录。可以在控制台查看：
```
[API] generateImageFromText - model: gemini-2.5-flash-image, prompt: ...
```

### Q5: 批量执行时节点顺序会自动处理吗？

**A**: 是的！`executeNodesInOrder()` 会自动进行拓扑排序，确保节点按照依赖顺序执行。

---

## 📖 相关文档

- [服务层架构说明](../services/README.md)
- [集成指南](../services/INTEGRATION_GUIDE.md)
- [Phase 1 总结](./PHASE1_SUMMARY.md)
- [错误边界使用指南](./ERROR_BOUNDARIES.md)

---

## ✨ 优势总结

### 使用服务层的好处

1. **代码组织清晰**
   - 业务逻辑从 UI 组件分离
   - 每个服务职责单一

2. **易于测试**
   - 服务独立，可编写单元测试
   - Mock 依赖更简单

3. **可复用性强**
   - 服务可在多个组件中使用
   - 避免代码重复

4. **错误处理统一**
   - 所有错误都通过 `NodeExecutionResult` 返回
   - 便于统一处理和监控

5. **扩展性好**
   - 添加新服务只需继承基类
   - 不需要修改现有代码

### 无需后端的优势

1. ✅ **部署简单** - 纯前端应用，直接部署到 CDN
2. ✅ **成本更低** - 无需服务器运维
3. ✅ **响应更快** - 无后端网络延迟
4. ✅ **开发更快** - 无需管理后端代码

---

**🎉 现在你可以开始使用服务层了！**
