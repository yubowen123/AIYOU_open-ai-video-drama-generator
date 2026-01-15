/**
 * 分镜增强服务
 * 使用 AI 优化景别、拍摄角度、运镜方式三个字段
 */

import { SplitStoryboardShot, DetailedStoryboardShot } from '../types';
import {
  SHOT_SIZES,
  CAMERA_ANGLES,
  CAMERA_MOVEMENTS,
  getShotSizeByName,
  getCameraAngleByName,
  getCameraMovementByName
} from '../constants/storyboardTerms';
import { getUserDefaultModel } from './modelConfig';

export interface EnhancedShotFields {
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  reasoning?: string; // AI 选择这些参数的理由
}

/**
 * 为单个分镜优化景别、角度、运镜
 */
export async function enhanceShotWithAI(shot: SplitStoryboardShot | DetailedStoryboardShot): Promise<EnhancedShotFields> {
  const systemPrompt = `你是一位专业的影视导演和分镜师。根据场景描述，为这个镜头选择最合适的景别、拍摄角度和运镜方式。

可选的景别（SHOT_SIZES）：
1. 大远景 - 人物如蚂蚁，环境主导。开场定场、表现孤独
2. 远景 - 人物小但能看清动作。动作场面、环境展示
3. 全景 - 顶天立地，全身可见。角色介绍、舞蹈、对决
4. 中景 - 腰部以上。标准对话、动作与表情兼顾
5. 中近景 - 胸部以上。情感交流、反应镜头
6. 近景 - 脖子以上。强调情绪、重要台词
7. 特写 - 只有脸。内心戏、强烈冲击力
8. 大特写 - 局部细节。制造紧张感、暗示线索

可选的拍摄角度（CAMERA_ANGLES）：
1. 视平 - 与角色眼睛同高。建立共情、写实风格、平等对话
2. 高位俯拍 - 从上往下拍。表现无助、被压迫、强调孤独
3. 低位仰拍 - 从下往上拍。塑造英雄、制造恐惧、表现混乱中的迷茫
4. 斜拍 - 摄影机倾斜。精神错乱、悬疑氛围、世界崩塌
5. 越肩 - 从肩膀后方拍摄。对话场面、建立对抗或亲密
6. 鸟瞰 - 垂直向下90度。交代地理环境、表现宿命论、视觉奇观

可选的运镜方式（CAMERA_MOVEMENTS）：
1. 固定 - 摄影机纹丝不动。喜剧效果、积蓄张力、强调表演
2. 横移 - 水平移动。跟随行动、展示环境
3. 俯仰 - 镜头上下转动。揭示高度、展现力量关系、信息揭露
4. 横摇 - 镜头左右转动。跟随视线、建立空间关系、甩镜头转场
5. 升降 - 垂直升降。史诗感开场/结尾、展现规模
6. 轨道推拉 - 物理靠近或远离。情绪高潮、表现孤独、强调重要性
7. 变焦推拉 - 改变焦距。复古风、急推、希区柯克变焦
8. 正跟随 - 位于角色身后跟随。代入感、强调背影、走进未知环境
9. 倒跟随 - 在角色前方后退。边走边谈、恐惧与逃亡
10. 环绕 - 围绕主体旋转。英雄时刻、浪漫时刻、混乱与困惑
11. 滑轨横移 - 小型轨道平滑移动。静物特写、狭小空间、增加视差

请根据场景描述，选择最合适的组合，并用 JSON 格式返回：
{
  "shotSize": "景别名称（必须是上面8个之一）",
  "cameraAngle": "拍摄角度（必须是上面6个之一）",
  "cameraMovement": "运镜方式（必须是上面11个之一）",
  "reasoning": "选择这些参数的理由（50字以内）"
}`;

  const userPrompt = `场景描述：${shot.visualDescription}
对话：${shot.dialogue || '无'}
视觉特效：${shot.visualEffects || '无'}

请为这个镜头选择最合适的景别、拍摄角度和运镜方式。`;

  try {
    const { generateText } = await import('./geminiService');
    const response = await generateText(
      systemPrompt + '\n\n' + userPrompt,
      getUserDefaultModel('text')
    );

    // 解析 JSON 响应
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 返回格式不正确');
    }

    const result = JSON.parse(jsonMatch[0]);

    // 验证返回的值是否在标准术语中
    const validShotSize = getShotSizeByName(result.shotSize);
    const validCameraAngle = getCameraAngleByName(result.cameraAngle);
    const validCameraMovement = getCameraMovementByName(result.cameraMovement);

    if (!validShotSize || !validCameraAngle || !validCameraMovement) {
      console.warn('[Shot Enhancer] AI 返回的值不在标准术语中，使用默认值');
      return {
        shotSize: '中景',
        cameraAngle: '视平',
        cameraMovement: '固定',
        reasoning: result.reasoning || 'AI返回值无效，使用默认值'
      };
    }

    return {
      shotSize: result.shotSize,
      cameraAngle: result.cameraAngle,
      cameraMovement: result.cameraMovement,
      reasoning: result.reasoning
    };

  } catch (error: any) {
    console.error('[Shot Enhancer] AI enhancement failed:', error);
    // 返回默认值
    return {
      shotSize: '中景',
      cameraAngle: '视平',
      cameraMovement: '固定',
      reasoning: 'AI增强失败，使用默认值'
    };
  }
}

/**
 * 批量优化多个分镜
 */
export async function enhanceMultipleShotsWithAI(
  shots: (SplitStoryboardShot | DetailedStoryboardShot)[],
  onProgress?: (currentIndex: number, total: number) => void
): Promise<Map<string, EnhancedShotFields>> {
  const results = new Map<string, EnhancedShotFields>();

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    onProgress?.(i + 1, shots.length);

    try {
      const enhanced = await enhanceShotWithAI(shot);
      results.set(shot.id, enhanced);

      // 添加延迟避免 API 限流
      if (i < shots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error: any) {
      console.error(`[Shot Enhancer] Failed to enhance shot ${shot.id}:`, error);
      // 使用默认值
      results.set(shot.id, {
        shotSize: '中景',
        cameraAngle: '视平',
        cameraMovement: '固定',
        reasoning: '增强失败，使用默认值'
      });
    }
  }

  return results;
}

/**
 * 智能推荐：根据场景内容快速推荐最合适的参数
 * 不使用 AI，基于规则快速匹配
 */
export function recommendShotFields(
  shot: SplitStoryboardShot | DetailedStoryboardShot
): EnhancedShotFields {
  const desc = (shot.visualDescription + ' ' + (shot.dialogue || '')).toLowerCase();

  // 默认值
  let shotSize = '中景';
  let cameraAngle = '视平';
  let cameraMovement = '固定';

  // 景别推荐规则
  if (desc.includes('全景') || desc.includes('全身') || desc.includes('环境') || desc.includes('场景')) {
    shotSize = '全景';
  } else if (desc.includes('特写') || desc.includes('脸') || desc.includes('表情') || desc.includes('眼睛')) {
    shotSize = '特写';
  } else if (desc.includes('大特写') || desc.includes('细节') || desc.includes('手') || desc.includes('局部')) {
    shotSize = '大特写';
  } else if (desc.includes('远景') || desc.includes('远处') || desc.includes('天空') || desc.includes('城市')) {
    shotSize = '远景';
  } else if (desc.includes('近景') || desc.includes('胸部') || desc.includes('情绪')) {
    shotSize = '近景';
  } else if (desc.includes('中近景') || desc.includes('交流') || desc.includes('对话')) {
    shotSize = '中近景';
  }

  // 角度推荐规则
  if (desc.includes('俯视') || desc.includes('俯拍') || desc.includes('高位') || desc.includes('向下')) {
    cameraAngle = '高位俯拍';
  } else if (desc.includes('仰视') || desc.includes('仰拍') || desc.includes('低位') || desc.includes('英雄')) {
    cameraAngle = '低位仰拍';
  } else if (desc.includes('斜') || desc.includes('倾斜') || desc.includes('不安')) {
    cameraAngle = '斜拍';
  } else if (desc.includes('鸟瞰') || desc.includes('上帝') || desc.includes('垂直')) {
    cameraAngle = '鸟瞰';
  } else if (desc.includes('越肩') || desc.includes('肩膀') || desc.includes('对话')) {
    cameraAngle = '越肩';
  }

  // 运镜推荐规则
  if (desc.includes('跟随') || desc.includes('跟拍') || desc.includes('行走') || desc.includes('走')) {
    cameraMovement = '正跟随';
  } else if (desc.includes('倒跟随') || desc.includes('边走边谈') || desc.includes('面对')) {
    cameraMovement = '倒跟随';
  } else if (desc.includes('环绕') || desc.includes('旋转') || desc.includes('英雄时刻')) {
    cameraMovement = '环绕';
  } else if (desc.includes('推') || desc.includes('推进') || desc.includes('靠近') || desc.includes('强调')) {
    cameraMovement = '轨道推拉';
  } else if (desc.includes('升降') || desc.includes('上升') || desc.includes('下降') || desc.includes('史诗')) {
    cameraMovement = '升降';
  } else if (desc.includes('横移') || desc.includes('水平') || desc.includes('展示')) {
    cameraMovement = '横移';
  } else if (desc.includes('俯仰') || desc.includes('上下') || desc.includes('抬头') || desc.includes('低头')) {
    cameraMovement = '俯仰';
  } else if (desc.includes('横摇') || desc.includes('左右') || desc.includes('转头') || desc.includes('扫视')) {
    cameraMovement = '横摇';
  } else if (desc.includes('变焦') || desc.includes('zoom') || desc.includes('急推')) {
    cameraMovement = '变焦推拉';
  }

  return {
    shotSize,
    cameraAngle,
    cameraMovement,
    reasoning: '基于规则的智能推荐'
  };
}

/**
 * 批量智能推荐（快速，不使用 AI）
 */
export function recommendMultipleShotFields(
  shots: (SplitStoryboardShot | DetailedStoryboardShot)[]
): Map<string, EnhancedShotFields> {
  const results = new Map<string, EnhancedShotFields>();

  for (const shot of shots) {
    results.set(shot.id, recommendShotFields(shot));
  }

  return results;
}
