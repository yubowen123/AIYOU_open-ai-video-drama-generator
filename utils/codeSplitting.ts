/**
 * 代码分割和懒加载配置
 * 优化应用性能，减少初始加载时间
 */

import { lazy, Suspense } from 'react';
import { LoadingFallback } from '../components/AsyncErrorBoundary';

/**
 * 创建懒加载组件的辅助函数
 * 自动添加 Loading 和 Error 处理
 */
export function createLazyComponent<
  T extends React.ComponentType<any>
>(
  importFunc: () => Promise<{ default: T }>
): React.ComponentType<React.ComponentProps<T>> {
  const LazyComponent = lazy(importFunc);

  return (props) => (
    <Suspense fallback={<LoadingFallback message="加载组件中..." />}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

/**
 * 路由级别的代码分割
 */
export const LazyRoutes = {
  // 工作流编辑器（主页面）
  WorkflowEditor: createLazyComponent(() => import('./pages/WorkflowEditor')),

  // 用户认证页面
  Login: createLazyComponent(() => import('./pages/Login')),
  Register: createLazyComponent(() => import('./pages/Register')),

  // 用户设置
  Settings: createLazyComponent(() => import('./pages/Settings')),

  // 画廊/资源管理
  Gallery: createLazyComponent(() => import('./pages/Gallery')),
  History: createLazyComponent(() => import('./pages/History')),
};

/**
 * 功能模块的代码分割
 */
export const LazyModules = {
  // 智能多帧序列（MultiFrame）
  SmartSequence: createLazyComponent(() => import('./components/SmartSequence')),

  // 音频中心（Sonic Studio）
  SonicStudio: createLazyComponent(() => import('./components/SonicStudio')),

  // 角色库
  CharacterLibrary: createLazyComponent(() => import('./components/CharacterLibrary')),

  // 调试面板
  DebugPanel: createLazyComponent(() => import('./components/DebugPanel')),

  // AI 对话面板
  ChatPanel: createLazyComponent(() => import('./components/ChatPanel')),
};

/**
 * 节点类型的代码分割
 * 根据节点类型动态加载对应的处理逻辑
 */
export const LazyNodeHandlers = {
  // 图像相关
  ImageGenerator: createLazyComponent(() => import('./components/nodes/ImageGeneratorNode')),
  ImageEditor: createLazyComponent(() => import('./components/nodes/ImageEditorNode')),

  // 视频相关
  VideoGenerator: createLazyComponent(() => import('./components/nodes/VideoGeneratorNode')),
  VideoAnalyzer: createLazyComponent(() => import('./components/nodes/VideoAnalyzerNode')),

  // 音频相关
  AudioGenerator: createLazyComponent(() => import('./components/nodes/AudioGeneratorNode')),

  // 剧本相关
  ScriptPlanner: createLazyComponent(() => import('./components/nodes/ScriptPlannerNode')),
  ScriptEpisode: createLazyComponent(() => import('./components/nodes/ScriptEpisodeNode')),

  // 分镜相关
  StoryboardGenerator: createLazyComponent(() => import('./components/nodes/StoryboardGeneratorNode')),
  StoryboardImage: createLazyComponent(() => import('./components/nodes/StoryboardImageNode')),
  StoryboardSplitter: createLazyComponent(() => import('./components/nodes/StoryboardSplitterNode')),

  // 角色
  CharacterNode: createLazyComponent(() => import('./components/nodes/CharacterNode')),

  // 剧目分析
  DramaAnalyzer: createLazyComponent(() => import('./components/nodes/DramaAnalyzerNode')),
  DramaRefined: createLazyComponent(() => import('./components/nodes/DramaRefinedNode')),

  // 全局风格
  StylePreset: createLazyComponent(() => import('./components/nodes/StylePresetNode')),
};

/**
 * 服务层的代码分割
 * 按需加载服务模块
 */
export const LazyServices = {
  // AI 服务
  OpenAI: () => import('./services/ai/openai.service'),
  StabilityAI: () => import('./services/ai/stability.service'),
  Replicate: () => import('./services/ai/replicate.service'),

  // 存储服务
  S3Storage: () => import('./services/storage/s3.service'),
  IndexedDB: () => import('./services/storage/indexedDB.service'),
};

/**
 * 动态导入节点服务
 * @param nodeType - 节点类型
 * @returns Promise<模块>
 */
export async function importNodeService(nodeType: string) {
  switch (nodeType) {
    case 'IMAGE_GENERATOR':
      return import('./services/nodes/imageGenerator.service');
    case 'VIDEO_GENERATOR':
      return import('./services/nodes/videoGenerator.service');
    case 'AUDIO_GENERATOR':
      return import('./services/nodes/audioGenerator.service');
    case 'STORYBOARD_SPLITTER':
      return import('./services/nodes/storyboardSplitter.service');
    // 添加更多节点类型...
    default:
      throw new Error(`未知的节点类型: ${nodeType}`);
  }
}

/**
 * 预加载关键资源
 * 在用户交互前预加载可能需要的资源
 */
export function preloadComponent(componentPath: string) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = componentPath;
  document.head.appendChild(link);
}

/**
 * 预加载节点服务
 * @param nodeTypes - 节点类型数组
 */
export async function preloadNodeServices(nodeTypes: string[]) {
  await Promise.all(
    nodeTypes.map(type => importNodeService(type))
  );
}

/**
 * Web Worker 懒加载
 */
export function createLazyWorker(workerPath: string): Worker {
  return new Worker(
    new URL(workerPath, import.meta.url),
    { type: 'module' }
  );
}
