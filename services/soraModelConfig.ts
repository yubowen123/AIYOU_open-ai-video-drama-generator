/**
 * Sora 模型名称映射配置
 * 根据提供商 + 清晰度动态选择模型名称
 */

/**
 * 模型名称映射表
 * key: 提供商代码
 * value: { sd: 标清模型名, hd: 高清模型名 }
 */
export const SORA_MODEL_NAMES = {
  yunwu: {
    sd: 'sora-2-all',           // 云雾标清
    hd: 'sora-2-pro-all'        // 云雾高清
  },
  sutu: {
    sd: 'sora2-new',            // 速推标清
    hd: 'sora2-pro'             // 速推高清
  },
  kie: {
    sd: 'sora-2-image-to-video',       // KIE标清
    hd: 'sora-2-pro-image-to-video'     // KIE高清
  },
  yijiapi: {
    sd: 'sora-2-yijia',         // 一加标清
    hd: 'sora-2-pro-25s-yijia'  // 一加高清
  }
} as const;

/**
 * 提供商类型
 */
export type SoraProviderType = 'yunwu' | 'sutu' | 'kie' | 'yijiapi';

/**
 * 获取模型名称
 * @param provider 提供商代码
 * @param hd 是否高清
 * @returns 模型名称
 */
export function getSoraModelName(
  provider: SoraProviderType,
  hd: boolean
): string {
  const quality = hd ? 'hd' : 'sd';
  const modelName = SORA_MODEL_NAMES[provider][quality];

  if (!modelName) {
    console.warn(`[SoraModelConfig] 未找到模型配置: provider=${provider}, hd=${hd}`);
    return 'sora-2';  // 降级默认值
  }

  return modelName;
}
