# 代码分割和懒加载指南

本文档说明如何使用代码分割和懒加载来优化应用性能。

## 概述

代码分割（Code Splitting）是将应用代码拆分成多个 bundle 的技术，可以：
- 减少初始加载时间
- 按需加载代码
- 提升应用性能
- 优化用户体验

## Webpack/Vite 代码分割

现代打包工具（Webpack、Vite）支持两种代码分割方式：

### 1. 静态导入（Static Import）

```typescript
// ❌ 会被打包到同一个 bundle
import { MyComponent } from './MyComponent';
```

### 2. 动态导入（Dynamic Import）

```typescript
// ✅ 会被分割成独立的 bundle
const MyComponent = lazy(() => import('./MyComponent'));
```

---

## 使用方法

### 1. 路由级别代码分割

将不同的页面分割成独立的 bundle：

```typescript
// App.tsx
import { lazy, Suspense } from 'react';
import { LoadingFallback } from './components/AsyncErrorBoundary';

// 懒加载页面组件
const WorkflowEditor = lazy(() => import('./pages/WorkflowEditor'));
const Login = lazy(() => import('./pages/Login'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<WorkflowEditor />} />
        <Route path="/login" element={<Login />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### 2. 功能模块代码分割

将大型功能模块分割成独立 bundle：

```typescript
// WorkflowEditor.tsx
import { lazy, Suspense } from 'react';

// 懒加载功能模块
const SmartSequence = lazy(() => import('./components/SmartSequence'));
const SonicStudio = lazy(() => import('./components/SonicStudio'));
const CharacterLibrary = lazy(() => import('./components/CharacterLibrary'));

function WorkflowEditor() {
  return (
    <>
      {/* 主画布 - 始终加载 */}
      <Canvas />

      {/* 功能面板 - 按需加载 */}
      {isSmartSequenceOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <SmartSequence />
        </Suspense>
      )}

      {isSonicStudioOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <SonicStudio />
        </Suspense>
      )}

      {isCharacterLibraryOpen && (
        <Suspense fallback={<LoadingFallback />}>
          <CharacterLibrary />
        </Suspense>
      )}
    </>
  );
}
```

### 3. 节点组件代码分割

根据节点类型动态加载组件：

```typescript
// Node.tsx
import { lazy, Suspense } from 'react';
import { NodeType } from './types';

// 懒加载节点组件
const nodeComponents = {
  [NodeType.IMAGE_GENERATOR]: lazy(() => import('./nodes/ImageGeneratorNode')),
  [NodeType.VIDEO_GENERATOR]: lazy(() => import('./nodes/VideoGeneratorNode')),
  [NodeType.AUDIO_GENERATOR]: lazy(() => import('./nodes/AudioGeneratorNode')),
  // ... 更多节点类型
};

export function Node({ node }: { node: AppNode }) {
  const NodeComponent = nodeComponents[node.type];

  if (!NodeComponent) {
    return <div>未知节点类型</div>;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <NodeComponent node={node} />
    </Suspense>
  );
}
```

### 4. 服务层代码分割

按需加载服务模块：

```typescript
// services/nodeExecutor.ts
export async function executeNode(node: AppNode) {
  // 动态导入节点服务
  const serviceModule = await import(`./nodes/${node.type}.service`);
  const service = new serviceModule.default();

  return service.execute(node);
}
```

### 5. 使用辅助函数（推荐）

使用 `createLazyComponent` 简化懒加载：

```typescript
import { createLazyComponent } from './utils/codeSplitting';

// 简单创建懒加载组件
const SmartSequence = createLazyComponent(
  () => import('./components/SmartSequence')
);

// 使用时不需要添加 Suspense
function App() {
  return (
    <>
      {isOpen && <SmartSequence />}
    </>
  );
}
```

---

## 性能优化策略

### 1. 预加载关键资源

在用户可能需要之前预加载：

```typescript
// 鼠标悬停时预加载
const handleMouseEnter = () => {
  import('./components/SmartSequence');
};

<button onMouseEnter={handleMouseEnter}>
  打开智能序列
</button>
```

### 2. 智能预加载

根据用户行为预测可能需要的资源：

```typescript
// 预加载常用的节点服务
useEffect(() => {
  const timer = setTimeout(() => {
    // 预加载前 3 个最常用的节点服务
    preloadNodeServices([
      'IMAGE_GENERATOR',
      'VIDEO_GENERATOR',
      'STORYBOARD_GENERATOR'
    ]);
  }, 2000);

  return () => clearTimeout(timer);
}, []);
```

### 3. Web Worker 懒加载

将计算密集型任务放到 Web Worker：

```typescript
const worker = createLazyWorker('./workers/imageProcessor.worker.ts');

worker.postMessage({ imageData });
worker.onmessage = (e) => {
  console.log('处理完成:', e.data);
};
```

---

## 打包分析

### 分析 Bundle 大小

使用打包分析工具查看代码分割效果：

**Vite:**

```bash
npm run build -- --mode analyze
```

**Webpack:**

```bash
npm run build -- --profile --json > stats.json
npx webpack-bundle-analyzer stats.json
```

### 目标指标

- **初始 bundle**: < 200KB (gzipped)
- **单个 route bundle**: < 100KB (gzipped)
- **单个组件 bundle**: < 50KB (gzipped)

---

## 常见问题

### Q1: 应该在哪里使用代码分割？

**A:**
- ✅ 路由级别（必须）
- ✅ 大型功能模块（推荐）
- ✅ 不常用的组件（推荐）
- ✅ 第三方库（推荐）
- ❌ 小型组件（不推荐）
- ❌ 核心功能（不推荐）

### Q2: 懒加载会影响 SEO 吗？

**A:** 不会。搜索引擎爬虫可以执行 JavaScript 并等待内容加载。

### Q3: 如何处理懒加载失败？

**A:** 使用 Error Boundary：

```typescript
<Suspense fallback={<LoadingFallback />}>
  <ErrorBoundary fallback={<ErrorUI />}>
    <LazyComponent />
  </ErrorBoundary>
</Suspense>
```

### Q4: 懒加载会影响首屏速度吗？

**A:** 不会。懒加载的代码不会阻塞首屏渲染，反而会提升首屏速度。

### Q5: 如何测试代码分割是否生效？

**A:**
1. 打开浏览器开发者工具
2. 切换到 Network 标签
3. 刷新页面
4. 查看按需加载的文件是否在需要时才加载

---

## 最佳实践

### ✅ 推荐做法

```typescript
// 1. 使用辅助函数
const Component = createLazyComponent(() => import('./Component'));

// 2. 提供有意义的加载提示
<Suspense fallback={<LoadingFallback message="加载智能序列中..." />}>

// 3. 错误处理
<ErrorBoundary>
  <LazyComponent />
</ErrorBoundary>

// 4. 预加载关键资源
useEffect(() => {
  preloadComponent('/components/SmartSequence.js');
}, []);
```

### ❌ 不推荐做法

```typescript
// 1. 避免过度分割（小组件不需要懒加载）
const Button = lazy(() => import('./Button')); // ❌

// 2. 避免嵌套懒加载
const Outer = lazy(() => import('./Outer')); // Outer 内部又懒加载 Inner ❌

// 3. 避免在循环中懒加载
{items.map(item => (
  <LazyItem key={item.id} /> // ❌ 可能导致大量请求
))}

// 4. 不要忘记 Suspense
<LazyComponent /> // ❌ 缺少 Suspense 包装
```

---

## 迁移检查清单

从现有代码迁移到代码分割：

- [ ] 识别可分割的大型组件
- [ ] 将路由组件改为懒加载
- [ ] 将功能面板改为懒加载
- [ ] 添加 Suspense 和 Loading UI
- [ ] 添加 Error Boundary
- [ ] 测试懒加载功能
- [ ] 分析打包结果
- [ ] 预加载关键资源
- [ ] 监控性能指标

---

## 相关文档

- [React Code Splitting 官方文档](https://react.dev/reference/react/lazy)
- [Vite 代码分割指南](https://vitejs.dev/guide/code-splitting.html)
- [Webpack 代码分割指南](https://webpack.js.org/guides/code-splitting/)
- [服务层集成指南](../services/INTEGRATION_GUIDE.md)
