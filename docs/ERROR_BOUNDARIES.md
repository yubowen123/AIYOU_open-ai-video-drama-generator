# 错误边界使用指南

本文档说明如何使用错误边界组件来捕获和处理应用中的错误。

## 概述

错误边界是 React 组件，可以捕获子组件树中任何位置的 JavaScript 错误，记录错误日志，并显示降级 UI，而不是使整个应用崩溃。

## 组件列表

### 1. ErrorBoundary - 全局错误边界

**用途**: 捕获整个应用或主要区域的错误

**位置**: `components/ErrorBoundary.tsx`

**特性**:
- 捕获子组件树中的所有错误
- 提供默认的错误 UI
- 支持自定义降级 UI
- 集成 Sentry 错误监控（待配置）
- 开发模式下显示详细错误信息

**基本用法**:

```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourAppComponents />
    </ErrorBoundary>
  );
}
```

**自定义降级 UI**:

```typescript
<ErrorBoundary
  fallback={
    <div>应用出错了，请稍后重试</div>
  }
  onError={(error, errorInfo) => {
    // 自定义错误处理
    console.error('应用错误:', error, errorInfo);
  }}
  showDetails={true}  // 显示错误详情（生产环境建议设为 false）
>
  <YourAppComponents />
</ErrorBoundary>
```

**使用 HOC 包装组件**:

```typescript
import { withErrorBoundary } from './components/ErrorBoundary';

function MyComponent() {
  return <div>...</div>;
}

export default withErrorBoundary(MyComponent);
```

---

### 2. NodeErrorBoundary - 节点错误边界

**用途**: 捕获单个节点组件的错误，不影响其他节点

**位置**: `components/NodeErrorBoundary.tsx`

**特性**:
- 隔离节点错误
- 显示节点级别的错误提示
- 支持关闭错误提示
- 开发模式下显示堆栈信息

**基本用法**:

```typescript
import { NodeErrorBoundary } from './components/NodeErrorBoundary';

function NodeRenderer({ node }: { node: AppNode }) {
  return (
    <NodeErrorBoundary
      nodeId={node.id}
      nodeTitle={node.title}
      onError={(nodeId, error) => {
        console.error(`节点 ${nodeId} 出错:`, error);
        // 可以在这里更新节点状态
      }}
    >
      <NodeContent node={node} />
    </NodeErrorBoundary>
  );
}
```

---

### 3. AsyncErrorBoundary - 异步错误边界

**用途**: 捕获异步操作中的错误（Promise、API 调用等）

**位置**: `components/AsyncErrorBoundary.tsx`

**特性**:
- 监听全局 `unhandledrejection` 事件
- 捕获未处理的 Promise 错误
- 提供重试功能

**基本用法**:

```typescript
import { AsyncErrorBoundary } from './components/AsyncErrorBoundary';

function MyComponent() {
  return (
    <AsyncErrorBoundary
      onError={(error) => {
        console.error('异步错误:', error);
      }}
    >
      <AsyncOperations />
    </AsyncErrorBoundary>
  );
}
```

---

### 4. AsyncComponent - 异步组件包装器

**用途**: 简化异步操作的加载和错误状态处理

**位置**: `components/AsyncErrorBoundary.tsx`

**特性**:
- 自动显示加载状态
- 自动显示错误状态
- 支持自定义加载和错误 UI

**基本用法**:

```typescript
import { AsyncComponent, LoadingFallback } from './components/AsyncErrorBoundary';

function MyComponent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getData();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AsyncComponent
      loading={loading}
      error={error}
      loadingFallback={<LoadingFallback message="加载数据中..." />}
    >
      {/* 正常内容 */}
      <div>{data}</div>
    </AsyncComponent>
  );
}
```

---

## 最佳实践

### 1. 应用级错误边界

在应用的最外层包裹全局错误边界：

```typescript
// App.tsx
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        // 发送到错误监控服务
        // Sentry.captureException(error, { contexts: { react: errorInfo } });
      }}
    >
      <YourApp />
    </ErrorBoundary>
  );
}
```

### 2. 节点级错误边界

为每个节点组件包裹错误边界，防止单个节点错误影响整个画布：

```typescript
// Canvas.tsx 或 Node.tsx
import { NodeErrorBoundary } from './components/NodeErrorBoundary';

{nodes.map(node => (
  <NodeErrorBoundary
    key={node.id}
    nodeId={node.id}
    nodeTitle={node.title}
  >
    <Node node={node} />
  </NodeErrorBoundary>
))}
```

### 3. API 调用错误处理

使用 AsyncComponent 包装异步操作：

```typescript
function NodeOperationArea({ node }: { node: AppNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setError(null);

    try {
      await NodeServiceRegistry.executeNode(
        node,
        nodes,
        connections,
        updateNodeStatus,
        updateNodeData
      );
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AsyncComponent loading={loading} error={error}>
      <button onClick={handleExecute}>执行节点</button>
    </AsyncComponent>
  );
}
```

### 4. 错误监控集成

配置 Sentry 错误监控：

```typescript
// src/sentry.ts (可选文件)
import * as Sentry from '@sentry/react';

export function initSentry() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // 其他配置...
  });
}

// App.tsx
import { initSentry } from './sentry';
import { ErrorBoundary } from './components/ErrorBoundary';

useEffect(() => {
  if (process.env.NODE_ENV === 'production') {
    initSentry();
  }
}, []);

return (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      Sentry.captureException(error, {
        contexts: { react: { componentStack: errorInfo.componentStack } }
      });
    }}
  >
    <YourApp />
  </ErrorBoundary>
);
```

---

## 错误处理流程

```
用户操作
    ↓
触发错误（JavaScript 错误、Promise 错误等）
    ↓
错误边界捕获错误
    ↓
记录错误日志（Console + Sentry）
    ↓
显示错误 UI（降级界面）
    ↓
用户选择操作（重试 / 刷新 / 返回首页）
```

---

## 常见问题

### Q1: 错误边界能捕获哪些错误？

**A:** 错误边界只能捕获以下错误：
- 组件渲染期间的错误
-生命周期方法中的错误
- 构造函数中的错误

**不能捕获**:
- 事件处理器中的错误（需要 try-catch）
- 异步代码中的错误（需要 AsyncErrorBoundary 或 try-catch）
- 服务端渲染错误
- 错误边界自身的错误

### Q2: 如何捕获事件处理器中的错误？

**A:** 使用 try-catch：

```typescript
const handleClick = () => {
  try {
    // 可能出错的代码
    riskyOperation();
  } catch (error) {
    console.error('事件处理器错误:', error);
    // 或者使用 useErrorHandler hook
    // handleError(error);
  }
};
```

### Q3: 错误边界会影响性能吗？

**A:** 不会。错误边界只在错误发生时才会渲染降级 UI，正常情况下没有任何性能开销。

### Q4: 生产环境应该显示错误详情吗？

**A:** 不建议。生产环境应该：
- 隐藏技术细节
- 显示友好的错误提示
- 将错误发送到监控服务
- 提供简单的恢复选项（重试、刷新）

### Q5: 如何测试错误边界？

**A:** 可以在开发模式下故意抛出错误：

```typescript
function TestComponent() {
  const throwForTesting = () => {
    throw new Error('测试错误');
  };

  return (
    <button onClick={throwForTesting}>
      点击触发错误（测试用）
    </button>
  );
}
```

---

## 相关文档

- [React Error Boundaries 官方文档](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Sentry React 集成文档](https://docs.sentry.io/platforms/javascript/guides/react/)
- [服务层集成指南](../services/INTEGRATION_GUIDE.md)
