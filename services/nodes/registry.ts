/**
 * 节点服务注册入口
 * 在应用启动时导入此文件以注册所有节点服务
 */

import { NodeServiceRegistry } from './index';
import { ImageGeneratorNodeService } from './imageGenerator.service';
import { VideoGeneratorNodeService } from './videoGenerator.service';
import { AudioGeneratorNodeService } from './audioGenerator.service';
import { StoryboardSplitterNodeService } from './storyboardSplitter.service';
import { PromptInputNodeService } from './promptInput.service';
import { StoryboardVideoGeneratorNodeService } from './storyboardVideoGenerator.service';

/**
 * 注册所有节点服务
 */
export function registerAllNodeServices(): void {
  // 注册核心节点服务
  NodeServiceRegistry.register('PROMPT_INPUT', PromptInputNodeService);
  NodeServiceRegistry.register('IMAGE_GENERATOR', ImageGeneratorNodeService);
  NodeServiceRegistry.register('VIDEO_GENERATOR', VideoGeneratorNodeService);
  NodeServiceRegistry.register('AUDIO_GENERATOR', AudioGeneratorNodeService);
  NodeServiceRegistry.register('STORYBOARD_SPLITTER', StoryboardSplitterNodeService);
  NodeServiceRegistry.register('STORYBOARD_VIDEO_GENERATOR', StoryboardVideoGeneratorNodeService);
  // NodeServiceRegistry.register('SCRIPT_PLANNER', ScriptPlannerNodeService);
  // NodeServiceRegistry.register('SCRIPT_EPISODE', ScriptEpisodeNodeService);
  // NodeServiceRegistry.register('STORYBOARD_GENERATOR', StoryboardGeneratorNodeService);
  // NodeServiceRegistry.register('STORYBOARD_IMAGE', StoryboardImageNodeService);
  // NodeServiceRegistry.register('CHARACTER_NODE', CharacterNodeService);
  // NodeServiceRegistry.register('IMAGE_EDITOR', ImageEditorNodeService);
  // NodeServiceRegistry.register('VIDEO_ANALYZER', VideoAnalyzerNodeService);
  // NodeServiceRegistry.register('DRAMA_ANALYZER', DramaAnalyzerNodeService);
  // NodeServiceRegistry.register('DRAMA_REFINED', DramaRefinedNodeService);
  // NodeServiceRegistry.register('STYLE_PRESET', StylePresetNodeService);

}

/**
 * 导出服务注册表供外部使用
 */
export { NodeServiceRegistry } from './index';
export * from './baseNode.service';
export { ImageGeneratorNodeService } from './imageGenerator.service';
export { VideoGeneratorNodeService } from './videoGenerator.service';
export { AudioGeneratorNodeService } from './audioGenerator.service';
export { StoryboardSplitterNodeService } from './storyboardSplitter.service';
export { PromptInputNodeService } from './promptInput.service';
export { StoryboardVideoGeneratorNodeService } from './storyboardVideoGenerator.service';
