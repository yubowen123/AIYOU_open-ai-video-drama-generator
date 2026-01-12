# 服务层集成指南

本文档说明如何在现有代码中集成和使用新的服务层架构。

## 快速开始

### 1. 在应用启动时注册所有服务

在 `App.tsx` 或 `_app.tsx` 中导入并注册所有节点服务：

```typescript
// App.tsx
import { useEffect } from 'react';
import { registerAllNodeServices } from './services/nodes/registry';

function App() {
  useEffect(() => {
    // 注册所有节点服务（只执行一次）
    registerAllNodeServices();
  }, []);

  return (
    // ... 你的应用代码
  );
}

export default App;
```

### 2. 使用服务层执行节点

**之前（直接在组件中调用 API）：**

```typescript
// ❌ 旧方式：在组件中直接处理业务逻辑
const handleGenerateImage = async (nodeId: string) => {
  const node = nodes.find(n => n.id === nodeId);
  setLoading(true);

  try {
    const response = await fetch('/api/image/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: node.data.prompt })
    });

    const data = await response.json();
    updateNode(nodeId, { imageUrl: data.imageUrl });
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
```

**现在（使用服务层）：**

```typescript
// ✅ 新方式：使用服务层
import { NodeServiceRegistry } from './services/nodes';

const handleExecuteNode = async (nodeId: string) => {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;

  // 使用服务注册表执行节点
  const result = await NodeServiceRegistry.executeNode(
    node,
    nodes,           // 所有节点
    connections,     // 所有连接
    updateNode,      // 更新节点回调
    updateNode       // 更新数据回调
  );

  if (result.success) {
    console.log('执行成功:', result.data);
  } else {
    console.error('执行失败:', result.error);
  }
};
```

### 3. 批量执行节点（自动依赖排序）

```typescript
// 自动按照依赖顺序执行多个节点
const { success, failed, results } = await NodeServiceRegistry.executeNodesInOrder(
  nodes,           // 要执行的节点列表
  connections,     // 所有连接
  updateNode,      // 更新状态回调
  updateNode,      // 更新数据回调
  (current, total, currentNode) => {
    // 进度回调
    console.log(`进度: ${current}/${total} - ${currentNode}`);
  }
);

console.log(`成功: ${success}, 失败: ${failed}`);
```

## 完整示例

### 示例 1: 在 Node.tsx 组件中使用

```typescript
// components/Node.tsx
import { useState } from 'react';
import { NodeServiceRegistry } from '../services/nodes';
import { useAppStore } from '../stores/app.store';

export const Node = ({ node }: { node: AppNode }) => {
  const { nodes, connections, updateNode } = useAppStore();
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);

    try {
      const result = await NodeServiceRegistry.executeNode(
        node,
        nodes,
        connections,
        (id, status) => updateNode(id, { status }),
        (id, data) => updateNode(id, { data })
      );

      if (result.success) {
        // 执行成功
        console.log('✓ 节点执行成功');
      } else {
        // 执行失败
        console.error('✗ 节点执行失败:', result.error);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="node">
      {/* 节点内容 */}
      <button onClick={handleExecute} disabled={isExecuting}>
        {isExecuting ? '执行中...' : '执行'}
      </button>
    </div>
  );
};
```

### 示例 2: 创建自定义节点服务

```typescript
// services/nodes/myCustomNode.service.ts
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from './baseNode.service';
import { AppNode } from '../../types';

export class MyCustomNodeService extends BaseNodeService {
  readonly nodeType = 'MY_CUSTOM_NODE';

  // 可选：自定义输入验证
  protected validateInputs(
    node: AppNode,
    context: NodeExecutionContext
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!node.data.myRequiredField) {
      errors.push('缺少必填字段');
    }

    return { valid: errors.length === 0, errors };
  }

  // 必须实现：执行逻辑
  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      // 1. 获取输入数据
      const inputData = this.getSingleInput(node, context);

      // 2. 执行业务逻辑
      const result = await myBusinessLogic(inputData);

      // 3. 更新节点数据
      this.updateNodeData(node.id, {
        ...node.data,
        result: result
      }, context);

      // 4. 返回成功结果
      return this.createSuccessResult(
        { result },
        { output: result }
      );
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : '执行失败'
      );
    }
  }
}

// 注册服务
// services/nodes/registry.ts
import { MyCustomNodeService } from './myCustomNode.service';

export function registerAllNodeServices(): void {
  NodeServiceRegistry.register('MY_CUSTOM_NODE', MyCustomNodeService);
}
```

## 服务层架构优势

### 1. 关注点分离
- **UI 组件**：只负责渲染和用户交互
- **服务层**：负责业务逻辑和外部 API 调用
- **状态管理**：负责全局状态和持久化

### 2. 可测试性
- 服务类独立于 UI 组件
- 易于编写单元测试
- Mock 依赖更简单

### 3. 可维护性
- 代码组织清晰
- 易于定位和修复问题
- 降低代码复杂度

### 4. 可扩展性
- 添加新节点服务只需继承基类
- 不需要修改现有代码
- 符合开闭原则

## 迁移检查清单

- [ ] 安装依赖（zustand, swr, @sentry/react）
- [ ] 创建 Zustand store
- [ ] 创建服务基类和注册表
- [ ] 创建节点服务类
- [ ] 注册所有节点服务
- [ ] 在 App.tsx 中初始化服务注册
- [ ] 更新 Node.tsx 使用服务层
- [ ] 测试节点执行功能
- [ ] 创建错误边界组件
- [ ] 配置代码分割

## 常见问题

### Q1: 服务实例是单例吗？
**A:** 是的，`NodeServiceRegistry` 使用单例模式管理服务实例，每个节点类型只有一个实例。

### Q2: 如何处理节点执行失败？
**A:** 服务层会返回 `NodeExecutionResult`，包含 `success` 和 `error` 字段。UI 组件根据这些字段处理错误情况。

### Q3: 如何添加进度追踪？
**A:** 在服务类中使用 `updateNodeData` 方法更新进度，UI 组件会自动响应数据变化。

### Q4: 如何实现节点依赖？
**A:** 使用 `NodeServiceRegistry.executeNodesInOrder()` 方法，它会自动进行拓扑排序并按依赖顺序执行节点。

### Q5: 如何添加错误监控？
**A:** 在服务类的 `execute` 方法中使用 Sentry 捕获错误，或者创建全局错误处理器。

## 相关文档

- [SERVICES README.md](./SERVICES_README.md) - 服务层架构说明
- [COMMERCIALIZATION_ROADMAP.md](../COMMERCIALIZATION_ROADMAP.md) - 商业化路线图
- [Zustand 文档](https://zustand-demo.pmnd.rs/) - 状态管理库
