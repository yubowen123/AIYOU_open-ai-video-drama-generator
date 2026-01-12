# Services 目录结构说明

本目录采用服务导向架构（SOA）设计，将业务逻辑从 UI 组件中分离出来。

## 目录结构

```
services/
├── nodes/                 # 节点服务层
│   ├── baseNode.service.ts       # 节点服务基类
│   ├── index.ts                  # 节点服务注册表（单例）
│   ├── registry.ts               # 服务注册入口
│   ├── imageGenerator.service.ts # 图像生成服务
│   ├── videoGenerator.service.ts # 视频生成服务
│   └── ...                       # 其他节点服务
├── ai/                   # AI 服务层
│   ├── openai.service.ts         # OpenAI API
│   ├── stability.service.ts      # Stability AI
│   └── ...                       # 其他 AI 服务
├── storage/              # 存储服务层
│   ├── localStorage.service.ts   # LocalStorage 封装
│   ├── indexedDB.service.ts      # IndexedDB 封装
│   └── s3.service.ts             # AWS S3 / OSS
├── api/                  # API 服务层
│   ├── client.ts                 # API 客户端（fetch/axios）
│   ├── auth.service.ts           # 认证服务
│   ├── user.service.ts           # 用户服务
│   └── workflow.service.ts       # 工作流服务
└── README.md             # 本文件
```

## 架构设计原则

### 1. 单一职责原则
每个服务类只负责一个特定的功能领域。

### 2. 依赖倒置原则
高层模块（UI 组件）不依赖低层模块（具体实现），都依赖抽象（基类/接口）。

### 3. 开闭原则
对扩展开放（可以添加新服务），对修改关闭（不需要修改现有代码）。

## 节点服务层 (services/nodes/)

### BaseNodeService 基类

所有节点服务必须继承 `BaseNodeService` 基类：

```typescript
import { BaseNodeService, NodeExecutionContext, NodeExecutionResult } from '@/services/nodes';

export class MyNodeService extends BaseNodeService {
  readonly nodeType = 'MY_NODE_TYPE';

  async execute(
    node: AppNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // 1. 验证输入
    // 2. 执行业务逻辑
    // 3. 返回结果
    return this.createSuccessResult(data, outputs);
  }
}
```

### NodeServiceRegistry 注册表

使用 `NodeServiceRegistry` 管理所有节点服务：

```typescript
import { NodeServiceRegistry } from '@/services/nodes';

// 注册服务
NodeServiceRegistry.register('MY_NODE_TYPE', MyNodeService);

// 执行节点
const result = await NodeServiceRegistry.executeNode(
  node,
  allNodes,
  connections,
  updateNodeStatus,
  updateNodeData
);
```

### NodeExecutionContext 执行上下文

执行上下文提供了节点执行时需要的所有资源：

```typescript
interface NodeExecutionContext {
  nodeId: string;                  // 当前节点ID
  nodes: AppNode[];                // 所有节点
  connections: Connection[];       // 所有连接
  getInputData: (fromNodeId: string, outputKey?: string) => any;
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
  updateNodeData: (nodeId: string, data: any) => void;
}
```

## 使用示例

### 在组件中使用节点服务

```typescript
import { NodeServiceRegistry } from '@/services/nodes';
import { useAppStore } from '@/stores/app.store';

const MyComponent = () => {
  const { nodes, connections, updateNode } = useAppStore();

  const handleExecuteNode = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const result = await NodeServiceRegistry.executeNode(
      node,
      nodes,
      connections,
      (id, status) => updateNode(id, { status }),
      (id, data) => updateNode(id, data)
    );

    if (result.success) {
      console.log('执行成功', result.data);
    } else {
      console.error('执行失败', result.error);
    }
  };

  return <button onClick={() => handleExecuteNode('node-1')}>执行</button>;
};
```

### 批量执行节点（自动拓扑排序）

```typescript
const results = await NodeServiceRegistry.executeNodesInOrder(
  nodes,
  connections,
  (id, status) => updateNode(id, { status }),
  (id, data) => updateNode(id, data),
  (current, total, currentNode) => {
    console.log(`进度: ${current}/${total} - ${currentNode}`);
  }
);

console.log(`成功: ${results.success}, 失败: ${results.failed}`);
```

## 优势

### 1. 代码组织清晰
- UI 组件只负责渲染和用户交互
- 服务层负责业务逻辑
- 职责分离，易于维护

### 2. 可测试性强
- 服务类独立于 UI 组件
- 可以编写单元测试
- Mock 依赖更简单

### 3. 可复用性高
- 服务可以在多个组件中复用
- 服务之间可以相互调用
- 减少代码重复

### 4. 易于扩展
- 添加新节点服务只需继承基类
- 不需要修改现有代码
- 符合开闭原则

### 5. 性能优化
- 服务实例使用单例模式
- 避免重复创建实例
- 减少内存占用

## 迁移指南

### 从 App.tsx 迁移到服务层

**之前（在 App.tsx 中）：**

```typescript
// App.tsx (3189 lines 🔴)
const handleGenerateImage = async (nodeId: string) => {
  const node = nodes.find(n => n.id === nodeId);
  // ... 100+ lines of business logic
  const response = await fetch('/api/image/generate', { ... });
  // ... more logic
};
```

**之后（使用服务层）：**

```typescript
// services/nodes/imageGenerator.service.ts
export class ImageGeneratorNodeService extends BaseNodeService {
  async execute(node: AppNode, context: NodeExecutionContext) {
    // 业务逻辑在这里
  }
}

// App.tsx (简化后)
const handleGenerateImage = async (nodeId: string) => {
  await NodeServiceRegistry.executeNode(
    node,
    nodes,
    connections,
    updateNode
  );
};
```

## 后续工作

### Phase 1: 当前阶段
- ✅ 创建服务基类和注册表
- ✅ 创建图像生成服务示例
- ⏳ 重构所有节点服务

### Phase 2: 后端对接
- 创建 AI 服务层（OpenAI, Stability AI）
- 创建 API 服务层
- 实现错误处理和重试逻辑

### Phase 3: 性能优化
- 添加请求缓存
- 实现请求队列
- 添加进度追踪

### Phase 4: 监控和日志
- 添加 Sentry 错误监控
- 实现执行日志
- 添加性能指标
