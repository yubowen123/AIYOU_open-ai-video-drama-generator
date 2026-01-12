# AIYOU 商业化全面优化规划 v2.0

> **版本**: v2.0
> **日期**: 2026-01-12
> **目标**: 将 AIYOU 推进到商业化能力，支持数万用户

---

## 📊 当前代码分析

### 现状评估

#### ✅ 已完成
- 15 个节点类型（包含新加的 STORYBOARD_IMAGE 和 STORYBOARD_SPLITTER）
- 完整的节点依赖验证系统
- 节点连接 DAG 验证
- 模型配置中心（modelConfig.ts）
- 图像切割工具（imageSplitter.ts）
- 完整的类型定义

#### ❌ 致命问题
1. **无后端架构**
   - 所有数据存储在 LocalStorage
   - API 密钥暴露在客户端（.env.local）
   - 无法实现用户认证和计费

2. **App.tsx 过度膨胀**
   - 3189 行代码，难以维护
   - 所有节点执行逻辑混在一起
   - 无错误边界

3. **缺少商业化核心功能**
   - 无用户系统
   - 无积分系统
   - 无支付集成
   - 无订阅管理

4. **性能瓶颈**
   - 无状态管理库
   - 无请求缓存
   - 无代码分割
   - 无错误监控

---

## 🎯 优化目标

### Phase 1: 代码重构（1-2周）
**目标**: 提升代码质量和可维护性

### Phase 2: 后端架构（3-4周）
**目标**: 搭建商业化基础设施

### Phase 3: 商业化功能（2-3周）
**目标**: 实现计费和用户系统

### Phase 4: 性能优化（1-2周）
**目标**: 支持万级并发用户

### Phase 5: 运营准备（1周）
**目标**: 上线前最后准备

---

## 📋 Phase 1: 代码重构（优先级：🔴 极高）

### 1.1 App.tsx 模块化拆分

#### 问题
- 当前 3189 行代码全部在 App.tsx
- 所有节点执行逻辑耦合在一起
- 难以测试和维护

#### 解决方案

**创建 services 目录结构**：
```
services/
├── index.ts                          # 统一导出
├── nodes/                             # 节点执行逻辑
│   ├── index.ts
│   ├── imageGenerator.service.ts     # 图像生成节点
│   ├── videoGenerator.service.ts     # 视频生成节点
│   ├── audioGenerator.service.ts     # 音频生成节点
│   ├── scriptPlanner.service.ts      # 剧本大纲节点
│   ├── scriptEpisode.service.ts      # 剧本分集节点
│   ├── storyboardGenerator.service.ts # 分镜生成节点
│   ├── storyboardImage.service.ts    # 分镜图设计节点
│   ├── characterNode.service.ts      # 角色设计节点
│   ├── videoAnalyzer.service.ts      # 视频分析节点
│   ├── imageEditor.service.ts        # 图像编辑节点
│   └── dramaAnalyzer.service.ts      # 剧目分析节点
├── ai/                                # AI API 调用
│   ├── index.ts
│   ├── gemini.service.ts             # Gemini 统一调用
│   ├── geminiImage.service.ts        # 图像生成
│   ├── geminiVideo.service.ts        # 视频生成
│   └── modelFallback.service.ts      # 模型降级逻辑
├── storage/                           # 数据存储
│   ├── localStorage.service.ts       # LocalStorage 封装
│   ├── sessionStorage.service.ts      # SessionStorage 封装
│   └── indexedDB.service.ts          # IndexedDB 封装（大数据）
└── utils/                             # 工具函数
    ├── imageProcessor.ts             # 图片处理
    ├── videoProcessor.ts             # 视频处理
    ├── validator.ts                  # 数据验证
    └── formatter.ts                  # 格式化
```

#### 实施步骤

**Step 1: 创建节点服务基类**

```typescript
// services/nodes/baseNode.service.ts

import { AppNode, Connection, NodeStatus } from '../../types';

export interface NodeExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export abstract class BaseNodeService {
  abstract execute(
    node: AppNode,
    inputs: AppNode[],
    connections: Connection[],
    onUpdate: (nodeId: string, data: any) => void
  ): Promise<NodeExecutionResult>;

  protected validateInputs(
    node: AppNode,
    inputs: AppNode[]
  ): { valid: boolean; error?: string } {
    // 通用输入验证
    const rules = NODE_DEPENDENCY_RULES[node.type];
    const actualInputs = inputs.length;

    if (actualInputs < rules.minInputs) {
      return {
        valid: false,
        error: `至少需要 ${rules.minInputs} 个输入`
      };
    }

    if (actualInputs > rules.maxInputs) {
      return {
        valid: false,
        error: `最多支持 ${rules.maxInputs} 个输入`
      };
    }

    return { valid: true };
  }

  protected updateNodeStatus(
    nodeId: string,
    status: NodeStatus,
    onUpdate: (nodeId: string, data: any) => void
  ): void {
    onUpdate(nodeId, { status });
  }
}
```

**Step 2: 重构各节点服务**

```typescript
// services/nodes/imageGenerator.service.ts

import { BaseNodeService, NodeExecutionResult } from './baseNode.service';
import { generateImage } from '../ai/geminiImage.service';

export class ImageGeneratorService extends BaseNodeService {
  async execute(
    node: AppNode,
    inputs: AppNode[],
    connections: Connection[],
    onUpdate: (nodeId: string, data: any) => void
  ): Promise<NodeExecutionResult> {
    // 1. 验证输入
    const validation = this.validateInputs(node, inputs);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 2. 更新状态为处理中
    this.updateNodeStatus(node.id, 'WORKING', onUpdate);

    try {
      // 3. 收集输入数据
      const inputData = this.collectInputData(inputs);

      // 4. 执行生成
      const result = await generateImage({
        prompt: node.data.prompt || inputData.prompt,
        model: node.data.model || 'gemini-2.5-flash-image',
        aspectRatio: node.data.aspectRatio,
        count: node.data.imageCount || 1
      });

      // 5. 更新节点数据
      onUpdate(node.id, {
        status: 'SUCCESS',
        images: result.images,
        error: undefined
      });

      return { success: true, data: result };
    } catch (error) {
      this.updateNodeStatus(node.id, 'ERROR', onUpdate);
      onUpdate(node.id, {
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  private collectInputData(inputs: AppNode[]): any {
    // 收集所有输入节点的数据
    const data: any = {};

    inputs.forEach(input => {
      switch (input.type) {
        case 'PROMPT_INPUT':
          data.prompt = input.data.prompt;
          break;
        case 'IMAGE_GENERATOR':
          data.referenceImages = data.referenceImages || [];
          data.referenceImages.push(...(input.data.images || []));
          break;
      }
    });

    return data;
  }
}
```

**Step 3: 创建节点服务注册表**

```typescript
// services/nodes/index.ts

import { ImageGeneratorService } from './imageGenerator.service';
import { VideoGeneratorService } from './videoGenerator.service';
// ... 其他节点服务

export class NodeServiceRegistry {
  private static services = new Map<NodeType, BaseNodeService>();

  static {
    this.register('IMAGE_GENERATOR', new ImageGeneratorService());
    this.register('VIDEO_GENERATOR', new VideoGeneratorService());
    // ... 注册其他节点
  }

  static register(type: NodeType, service: BaseNodeService): void {
    this.services.set(type, service);
  }

  static get(type: NodeType): BaseNodeService {
    const service = this.services.get(type);
    if (!service) {
      throw new Error(`No service found for node type: ${type}`);
    }
    return service;
  }

  static async executeNode(
    node: AppNode,
    inputs: AppNode[],
    connections: Connection[],
    onUpdate: (nodeId: string, data: any) => void
  ): Promise<NodeExecutionResult> {
    const service = this.get(node.type);
    return service.execute(node, inputs, connections, onUpdate);
  }
}
```

**Step 4: 重构 App.tsx**

```typescript
// App.tsx 重构后

import { NodeServiceRegistry } from './services/nodes';

function App() {
  // ... 其他代码

  // 之前的 handleNodeExecution 从 300+ 行缩减为：
  const handleNodeExecution = useCallback(async (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    const inputNodes = nodes.filter(n => node.inputs.includes(n.id));
    const nodeConnections = connections.filter(c => c.to === id);

    try {
      const result = await NodeServiceRegistry.executeNode(
        node,
        inputNodes,
        nodeConnections,
        handleNodeUpdate
      );

      if (!result.success) {
        console.error('Node execution failed:', result.error);
      }
    } catch (error) {
      console.error('Node execution error:', error);
    }
  }, [nodes, connections, handleNodeUpdate]);

  // App.tsx 从 3189 行缩减到 ~800 行
}
```

---

### 1.2 引入状态管理库

#### 问题
- 复杂状态散落在各组件的 useState
- 无全局状态共享
- 无状态持久化策略

#### 解决方案：引入 Zustand

**安装**：
```bash
npm install zustand
```

**创建全局状态 Store**：

```typescript
// stores/app.store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppStore {
  // 节点状态
  nodes: AppNode[];
  connections: Connection[];

  // UI 状态
  selectedNodeIds: string[];
  viewport: { x: number; y: number; zoom: number };

  // 用户状态
  user: User | null;
  isAuthenticated: boolean;

  // Actions
  setNodes: (nodes: AppNode[]) => void;
  addNode: (node: AppNode) => void;
  updateNode: (id: string, data: any) => void;
  deleteNode: (id: string) => void;

  setSelectedNodes: (ids: string[]) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;

  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      nodes: [],
      connections: [],
      selectedNodeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      user: null,
      isAuthenticated: false,

      // Actions
      setNodes: (nodes) => set({ nodes }),

      addNode: (node) => set((state) => ({
        nodes: [...state.nodes, node]
      })),

      updateNode: (id, data) => set((state) => ({
        nodes: state.nodes.map(n =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n
        )
      })),

      deleteNode: (id) => set((state) => ({
        nodes: state.nodes.filter(n => n.id !== id),
        connections: state.connections.filter(
          c => c.from !== id && c.to !== id
        )
      })),

      setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),

      setViewport: (viewport) => set({ viewport }),

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      login: async (email, password) => {
        // API 调用
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const { user, accessToken } = await response.json();

        set({ user, isAuthenticated: true });

        // 保存 token
        localStorage.setItem('accessToken', accessToken);
      },

      logout: async () => {
        await fetch('/api/v1/auth/logout', { method: 'POST' });
        set({ user: null, isAuthenticated: false });
        localStorage.removeItem('accessToken');
      }
    }),
    {
      name: 'aiyou-storage', // LocalStorage key
      partialize: (state) => ({
        // 只持久化部分状态
        nodes: state.nodes,
        connections: state.connections,
        viewport: state.viewport
      })
    }
  )
);

// 选择器 hooks
export const useNodes = () => useAppStore((state) => state.nodes);
export const useConnections = () => useAppStore((state) => state.connections);
export const useSelectedNodes = () => useAppStore((state) => state.selectedNodeIds);
export const useUser = () => useAppStore((state) => state.user);
```

**在组件中使用**：

```typescript
// components/CanvasBoard.tsx

import { useNodes, useConnections, useAppStore } from '../stores/app.store';

function CanvasBoard() {
  const nodes = useNodes();
  const connections = useConnections();
  const { updateNode, deleteNode } = useAppStore();

  // 组件代码...
}
```

---

### 1.3 添加错误边界

#### 问题
- 节点崩溃会影响整个画布
- 无错误捕获和恢复机制

#### 解决方案

```typescript
// components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);

    // 上报错误到监控服务
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 上报到 Sentry（如果配置了）
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: { react: { componentStack: errorInfo.componentStack } }
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center h-full bg-red-500/10 border border-red-500/30 rounded-lg p-6">
          <div className="text-center">
            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-red-400 mb-2">组件崩溃</h3>
            <p className="text-sm text-red-300">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 使用示例
<ErrorBoundary>
  <CanvasBoard />
</ErrorBoundary>
```

---

### 1.4 代码分割与懒加载

#### 问题
- 首屏加载慢
- 所有组件一次性加载

#### 解决方案

```typescript
// App.tsx

import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// 懒加载组件
const CanvasBoard = lazy(() => import('./components/CanvasBoard'));
const SidebarDock = lazy(() => import('./components/SidebarDock'));
const ChatWindow = lazy(() => import('./components/ChatWindow'));
const SonicStudio = lazy(() => import('./components/SonicStudio'));

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 size={48} className="animate-spin text-purple-500" />
        </div>
      }>
        <CanvasBoard />
        <SidebarDock />
        <ChatWindow />
        <SonicStudio />
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

## 🚀 Phase 2: 后端架构（优先级：🔴 极高）

### 2.1 搭建 NestJS 后端

#### 安装依赖

```bash
# 创建后端项目
mkdir aiyou-server && cd aiyou-server
npm init -y

# 安装 NestJS
npm install @nestjs/core @nestjs/common @nestjs/platform-express
npm install @nestjs/config @nestjs/jwt @nestjs/passport
npm install @nestjs/typeorm typeorm pg
npm install @nestjs/bull bull
npm install class-validator class-transformer

# 开发依赖
npm install -D @nestjs/cli typescript @types/node
```

#### 项目结构

```
aiyou-server/
├── src/
│   ├── main.ts                          # 入口
│   ├── app.module.ts                    # 根模块
│   ├── config/                          # 配置
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   └── gemini.config.ts
│   ├── modules/                         # 功能模块
│   │   ├── auth/                        # 认证模块
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── guards/
│   │   ├── users/                       # 用户模块
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── entities/
│   │   ├── workflows/                   # 工作流模块
│   │   │   ├── workflows.module.ts
│   │   │   ├── workflows.controller.ts
│   │   │   ├── workflows.service.ts
│   │   │   └── entities/
│   │   ├── generations/                 # 生成模块
│   │   │   ├── generations.module.ts
│   │   │   ├── generations.controller.ts
│   │   │   ├── generations.service.ts
│   │   │   ├── queues/
│   │   │   │   ├── image-queue.service.ts
│   │   │   │   ├── video-queue.service.ts
│   │   │   │   └── audio-queue.service.ts
│   │   │   └── workers/
│   │   │       ├── image.worker.ts
│   │   │       ├── video.worker.ts
│   │   │       └── audio.worker.ts
│   │   ├── credits/                     # 积分模块
│   │   │   ├── credits.module.ts
│   │   │   ├── credits.controller.ts
│   │   │   └── credits.service.ts
│   │   ├── subscriptions/               # 订阅模块
│   │   │   ├── subscriptions.module.ts
│   │   │   ├── subscriptions.controller.ts
│   │   │   └── subscriptions.service.ts
│   │   ├── assets/                      # 资产模块
│   │   │   ├── assets.module.ts
│   │   │   ├── assets.controller.ts
│   │   │   └── assets.service.ts
│   │   └── payments/                    # 支付模块
│   │       ├── payments.module.ts
│   │       ├── payments.controller.ts
│   │       └── payments.service.ts
│   ├── common/                          # 公共模块
│   │   ├── decorators/                   # 装饰器
│   │   ├── filters/                      # 过滤器
│   │   ├── interceptors/                # 拦截器
│   │   ├── pipes/                        # 管道
│   │   └── guards/                      # 守卫
│   └── database/                        # 数据库
│       ├── migrations/
│       └── seeds/
├── .env.example
├── nest-cli.json
├── tsconfig.json
└── package.json
```

#### 核心 API 实现

**认证模块**：

```typescript
// src/modules/auth/auth.controller.ts

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req) {
    return this.authService.logout(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  @Post('refresh')
  async refresh(@Body() refreshDto: RefreshDto) {
    return this.authService.refreshTokens(refreshDto);
  }
}
```

**生成模块**：

```typescript
// src/modules/generations/generations.controller.ts

import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { GenerationsService } from './generations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreditsService } from '../credits/credits.service';

@Controller('api/v1/generate')
@UseGuards(JwtAuthGuard)
export class GenerationsController {
  constructor(
    private generationsService: GenerationsService,
    private creditsService: CreditsService
  ) {}

  @Post('image')
  async generateImage(
    @Request() req,
    @Body() generateImageDto: GenerateImageDto
  ) {
    // 1. 计算所需积分
    const requiredCredits = this.creditsService.calculateImageCredits(generateImageDto);

    // 2. 检查并扣除积分
    await this.creditsService.consumeCredits(
      req.user.userId,
      requiredCredits,
      'IMAGE_GENERATION'
    );

    // 3. 提交到队列
    const job = await this.generationsService.enqueueImageGeneration({
      userId: req.user.userId,
      ...generateImageDto
    });

    return {
      success: true,
      jobId: job.id,
      estimatedTime: this.generationsService.estimateTime(generateImageDto),
      creditsConsumed: requiredCredits
    };
  }

  @Post('video')
  async generateVideo(
    @Request() req,
    @Body() generateVideoDto: GenerateVideoDto
  ) {
    const requiredCredits = this.creditsService.calculateVideoCredits(generateVideoDto);

    await this.creditsService.consumeCredits(
      req.user.userId,
      requiredCredits,
      'VIDEO_GENERATION'
    );

    const job = await this.generationsService.enqueueVideoGeneration({
      userId: req.user.userId,
      ...generateVideoDto
    });

    return {
      success: true,
      jobId: job.id,
      estimatedTime: this.generationsService.estimateTime(generateVideoDto),
      creditsConsumed: requiredCredits
    };
  }

  @Get('status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.generationsService.getJobStatus(jobId);
  }
}
```

**积分服务**：

```typescript
// src/modules/credits/credits.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreditTransaction } from '../credits/entities/credit-transaction.entity';
import { NodeType } from '../../types';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CreditTransaction)
    private transactionRepository: Repository<CreditTransaction>
  ) {}

  // 计算图像生成积分
  calculateImageCredits(options: {
    count: number;
    resolution: string;
    model: string;
  }): number {
    let basePrice = 10; // 基础价格

    // 分辨率加价
    if (options.resolution === '4k') {
      basePrice += 5;
    }

    // 高级模型加价
    if (options.model.includes('pro')) {
      basePrice += 3;
    }

    return basePrice * options.count;
  }

  // 计算视频生成积分
  calculateVideoCredits(options: {
    duration: number;
    resolution: string;
    mode: string;
  }): number {
    const pricing = {
      DEFAULT: (duration: number, resolution: string) => {
        const basePrice = 50;
        const durationMultiplier = Math.ceil(duration / 5);
        const resolutionMultiplier = resolution === '4k' ? 2 : 1;
        return basePrice * durationMultiplier * resolutionMultiplier;
      },
      CONTINUE: (duration: number) => 80 + duration * 2,
      CUT: (duration: number) => 100 + duration * 3,
      FIRST_LAST_FRAME: () => 120,
      CHARACTER_REF: (duration: number) => 90 + duration * 2
    };

    return pricing[options.mode]?.(options.duration, options.resolution) || 50;
  }

  // 消耗积分
  async consumeCredits(
    userId: string,
    amount: number,
    reason: string
  ): Promise<CreditTransaction> {
    // 1. 检查余额
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (user.credits < amount) {
      throw new BadRequestException(
        `积分不足。需要 ${amount} 积分，当前余额 ${user.credits}`
      );
    }

    // 2. 扣除积分（乐观锁）
    await this.userRepository
      .createQueryBuilder()
      .update()
      .set('credits', () => `credits - ${amount}`)
      .where('id = :id', { id: userId })
      .andWhere('credits >= :min', { min: amount })
      .execute();

    // 3. 记录交易
    const transaction = this.transactionRepository.create({
      userId,
      transactionType: 'CONSUME',
      amount: -amount,
      balanceAfter: user.credits - amount,
      description: reason
    });

    await this.transactionRepository.save(transaction);

    return transaction;
  }

  // 退款（生成失败时）
  async refundCredits(
    userId: string,
    amount: number,
    reason: string
  ): Promise<void> {
    await this.userRepository
      .createQueryBuilder()
      .update()
      .set('credits', () => `credits + ${amount}`)
      .where('id = :id', { id: userId })
      .execute();

    await this.transactionRepository.save({
      userId,
      transactionType: 'REFUND',
      amount,
      balanceAfter: await this.getUserBalance(userId),
      description: reason
    });
  }

  // 查询余额
  async getUserBalance(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user?.credits || 0;
  }
}
```

---

### 2.2 数据库设计

#### Entity 定义

```typescript
// src/modules/users/entities/user.entity.ts

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SubscriptionTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column()
  passwordHash: string;

  @Column({ default: 1000 })
  credits: number;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE
  })
  subscriptionTier: SubscriptionTier;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionExpiresAt: Date;

  @Column({ default: 0 })
  totalNodesCreated: number;

  @Column({ default: 0 })
  totalImagesGenerated: number;

  @Column({ default: 0 })
  totalVideosGenerated: number;

  @Column({ default: 0 })
  totalAudioGenerated: number;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: 'zh' })
  language: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  emailVerified: boolean;
}
```

---

### 2.3 任务队列

```typescript
// src/modules/generations/queues/image-queue.service.ts

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { generateImage } from '../../ai/geminiImage.service';

@Injectable()
export class ImageQueueService {
  constructor(
    @InjectQueue('image-generation') private imageQueue: Queue
  ) {}

  async addImageJob(jobData: {
    userId: string;
    nodeId: string;
    prompt: string;
    model: string;
    aspectRatio?: string;
    count?: number;
  }) {
    return this.imageQueue.add('generate-image', jobData, {
      priority: this.getPriority(jobData.userId),
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  private getPriority(userId: string): number {
    // PRO 用户优先级更高
    // TODO: 从数据库查询用户等级
    return 5; // 1-10, 1 is highest
  }

  async processImageJob(job: any) {
    const { userId, nodeId, prompt, model, aspectRatio, count } = job.data;

    try {
      const result = await generateImage({
        prompt,
        model,
        aspectRatio,
        count
      });

      // 保存结果到数据库
      await this.generationService.complete(job.id, result);

      return result;
    } catch (error) {
      // 失败退款
      await this.creditsService.refundCredits(
        userId,
        job.data.creditsConsumed,
        `图像生成失败: ${error.message}`
      );

      throw error;
    }
  }
}
```

---

## 💳 Phase 3: 商业化功能（优先级：🟠 高）

### 3.1 前端 API 集成

```typescript
// services/api/client.ts

import axios, { AxiosInstance } from 'axios';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
      timeout: 30000
    });

    // 请求拦截器
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => response.data,
      async (error) => {
        if (error.response?.status === 401) {
          // Token 过期，尝试刷新
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
              localStorage.setItem('accessToken', data.accessToken);
              return this.client.request(error.config);
            } catch (refreshError) {
              // 刷新失败，跳转登录
              localStorage.clear();
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // 用户相关
  async login(email: string, password: string) {
    return this.client.post('/api/v1/auth/login', { email, password });
  }

  async register(email: string, username: string, password: string) {
    return this.client.post('/api/v1/auth/register', { email, username, password });
  }

  async getProfile() {
    return this.client.get('/api/v1/auth/me');
  }

  // 工作流相关
  async getWorkflows() {
    return this.client.get('/api/v1/workflows');
  }

  async createWorkflow(data: any) {
    return this.client.post('/api/v1/workflows', data);
  }

  async updateWorkflow(id: string, data: any) {
    return this.client.put(`/api/v1/workflows/${id}`, data);
  }

  async deleteWorkflow(id: string) {
    return this.client.delete(`/api/v1/workflows/${id}`);
  }

  async executeWorkflow(id: string) {
    return this.client.post(`/api/v1/workflows/${id}/execute`);
  }

  // 生成相关
  async generateImage(params: any) {
    return this.client.post('/api/v1/generate/image', params);
  }

  async generateVideo(params: any) {
    return this.client.post('/api/v1/generate/video', params);
  }

  async getJobStatus(jobId: string) {
    return this.client.get(`/api/v1/generate/status/${jobId}`);
  }

  // 积分相关
  async getCreditsBalance() {
    return this.client.get('/api/v1/credits/balance');
  }

  async getCreditTransactions() {
    return this.client.get('/api/v1/credits/transactions');
  }

  async purchaseCredits(packageId: string) {
    return this.client.post('/api/v1/credits/purchase', { packageId });
  }

  // 订阅相关
  async getSubscriptionPlans() {
    return this.client.get('/api/v1/subscriptions/plans');
  }

  async subscribe(tier: string) {
    return this.client.post('/api/v1/subscriptions/subscribe', { tier });
  }

  async cancelSubscription() {
    return this.client.post('/api/v1/subscriptions/cancel');
  }
}

export const apiClient = new ApiClient();
```

---

### 3.2 登录注册 UI

```typescript
// components/AuthModal.tsx

import { useState } from 'react';
import { X, Mail, Lock, User } from 'lucide-react';
import { apiClient } from '../services/api/client';
import { useAppStore } from '../stores/app.store';

export function AuthModal() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setUser, login } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { user } = await apiClient.login(email, password);
        setUser(user);
      } else {
        const { user } = await apiClient.register(email, username, password);
        setUser(user);
      }
      // 关闭模态框
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000]">
      <div className="bg-[#1c1c1e] rounded-2xl p-8 w-full max-w-md border border-white/10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {isLogin ? '登录' : '注册'}
          </h2>
          <button onClick={() => {/* 关闭 */}}>
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                用户名
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  placeholder="请输入用户名"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              邮箱
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-purple-500"
                placeholder="请输入邮箱"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              密码
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-purple-500"
                placeholder="请输入密码"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50"
          >
            {loading ? '处理中...' : isLogin ? '登录' : '注册'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-purple-400 hover:text-purple-300"
          >
            {isLogin ? '没有账号？立即注册' : '已有账号？立即登录'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 3.3 积分显示组件

```typescript
// components/CreditsDisplay.tsx

import { useUser } from '../stores/app.store';
import { Coins } from 'lucide-react';

export function CreditsDisplay() {
  const user = useUser();

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
      <Coins size={18} className="text-yellow-400" />
      <div>
        <div className="text-[10px] text-yellow-300/70">积分余额</div>
        <div className="text-base font-bold text-yellow-400">
          {user.credits.toLocaleString()}
        </div>
      </div>
      <button
        onClick={() => {/* 打开充值界面 */}}
        className="px-3 py-1 bg-yellow-500 text-black rounded-lg text-xs font-bold hover:bg-yellow-400 transition-colors"
      >
        充值
      </button>
    </div>
  );
}
```

---

## ⚡ Phase 4: 性能优化（优先级：🟡 中）

### 4.1 请求缓存

```typescript
// services/api/swr.ts

import useSWR from 'swr';
import { apiClient } from './client';

export function useWorkflows() {
  const fetcher = () => apiClient.getWorkflows();

  return useSWR('/api/v1/workflows', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000 // 1分钟内不重复请求
  });
}

export function useCredits() {
  const fetcher = () => apiClient.getCreditsBalance();

  return useSWR('/api/v1/credits/balance', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000 // 30秒
  });
}
```

---

### 4.2 React.memo 优化

```typescript
// components/Node.tsx

import { memo } from 'react';

export const Node = memo(function Node({ node, ...props }) {
  // 组件代码
}, (prevProps, nextProps) => {
  // 自定义比较函数
  return (
    prevProps.node.data === nextProps.node.data &&
    prevProps.node.status === nextProps.node.status &&
    prevProps.isSelected === nextProps.isSelected
  );
});
```

---

### 4.3 虚拟滚动

```typescript
// components/NodeList.tsx

import { useVirtualizer } from '@tanstack/react-virtual';

export function NodeList({ nodes }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: nodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // 估计高度
    overscan: 5
  });

  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const node = nodes[virtualRow.index];
          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <Node node={node} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 📊 Phase 5: 监控与分析（优先级：🟢 正常）

### 5.1 错误监控

```typescript
// main.tsx

import * as Sentry from '@sentry/react';

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

---

### 5.2 性能监控

```typescript
// services/analytics.ts

import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function reportWebVitals() {
  getCLS(console.log);
  getFID(console.log);
  getFCP(console.log);
  getLCP(console.log);
  getTTFB(console.log);
}

// main.tsx

reportWebVitals();
```

---

## 📅 实施时间表

| Phase | 任务 | 预估时间 | 优先级 |
|-------|------|---------|--------|
| **Phase 1** | App.tsx 模块化拆分 | 1周 | 🔴 极高 |
| | 引入 Zustand 状态管理 | 3天 | 🔴 极高 |
| | 添加错误边界 | 2天 | 🔴 极高 |
| | 代码分割与懒加载 | 2天 | 🟠 高 |
| **Phase 2** | 搭建 NestJS 后端 | 2周 | 🔴 极高 |
| | 数据库设计与迁移 | 3天 | 🔴 极高 |
| | 任务队列实现 | 1周 | 🔴 极高 |
| | API 开发 | 1周 | 🔴 极高 |
| **Phase 3** | 前端 API 集成 | 3天 | 🟠 高 |
| | 用户认证 UI | 2天 | 🟠 高 |
| | 积分系统 UI | 2天 | 🟠 高 |
| | 支付集成 | 1周 | 🟠 高 |
| **Phase 4** | 请求缓存优化 | 2天 | 🟡 中 |
| | React.memo 优化 | 2天 | 🟡 中 |
| | 虚拟滚动 | 3天 | 🟡 中 |
| **Phase 5** | 错误监控集成 | 1天 | 🟢 正常 |
| | 性能监控 | 1天 | 🟢 正常 |

**总时间**: 约 8-10 周

---

## 🎯 成功指标

### 技术指标
- ✅ App.tsx 代码量降至 800 行以下
- ✅ 首屏加载时间 < 2s
- ✅ 节点执行响应时间 < 500ms
- ✅ 支持并发用户 > 1000
- ✅ API 平均响应时间 < 200ms

### 商业指标
- ✅ 用户注册转化率 > 30%
- ✅ 付费转化率 > 5%
- ✅ 月活用户 > 10,000
- ✅ 月收入 > ¥100,000

---

## 📝 下一步行动

### 立即开始（本周）
1. ✅ 安装 Zustand：`npm install zustand`
2. ✅ 创建 services 目录结构
3. ✅ 开始 App.tsx 重构
4. ✅ 初始化 NestJS 项目

### 下周
1. 搭建后端基础框架
2. 实现用户认证系统
3. 数据库迁移

### 月底前
1. 完成所有 API 开发
2. 前后端联调
3. 积分系统上线

---

**文档维护者**: AI Architect
**最后更新**: 2026-01-12
**下次审查**: Phase 1 完成后
