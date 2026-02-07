# Bug 修复记录

## 1. 创意描述节点显示黄色生图操作区

**文件:** `components/Node.tsx`

**问题:** 剧本分集的子节点（创意描述）刷新页面后会出现黄色操作区，显示图片分辨率、比例等生图参数，鼠标移入后隐藏且不再展示。

**原因:** `isAlwaysOpen` 对所有 `PROMPT_INPUT` 节点都设为 `true`，没有排除剧本分集的子节点。

**处理:** 在 `isAlwaysOpen` 之前计算 `isEpisodeChildNode`，排除 episode 子节点：
```
(node.type === NodeType.PROMPT_INPUT && !isEpisodeChildNode)
```

---

## 2. 角色生成信息丢失、重复请求

**文件:** `services/characterGenerationManager.ts`, `services/characterActionHandler.ts`, `App.tsx`

**问题:** 生成角色时重复请求、丢基础信息、丢图片，第二个角色生成导致第一个角色信息丢失。

**原因（4个）:**
1. `stateToProfile` 返回 `undefined` 字段，合并时覆盖了 existing 的有效数据
2. 多处直接 mutation state 对象（`state.profile = xxx`）
3. `handleCharacterAction` 末尾重复调用 `updateNodeUI`
4. `App.tsx` for 循环中用过时的 `newGeneratedChars` 覆盖了 `updateNodeUI` 刚写入的最新数据（`nodesRef.current` 在 `useEffect` 中异步更新，`setNodes` 还没生效时就被读取）

**处理:**
- `stateToProfile` 改为只输出有值的字段，不返回 `undefined`
- 所有 mutation 改为 `updateCharacterState` 不可变更新
- 去掉 `handleCharacterAction` 末尾重复的 `updateNodeUI`
- for 循环末尾不再用 `newGeneratedChars` 覆盖，主角分支由 `handleCharacterActionNew` 内部负责更新
- LIBRARY 和 SUPPORTING_ROLE 分支各自处理完后立即调用 `handleNodeUpdate`
- 最终节点状态通过函数式 `setNodes` 从最新 `node.data` 读取

---

## 3. 单个角色生成按钮不进入生成中状态

**文件:** `services/characterActionHandler.ts`

**问题:** 点击单个角色的生成按钮后，UI 不立即显示"正在生成角色档案"。

**原因:** `handleRetry` 在异步 API 调用之前没有先更新 UI 状态。

**处理:** 在 `handleRetry` 开头立即通过 `onNodeUpdate` 将角色状态设为 `'GENERATING'`。

---

## 4. 剧本分集与子节点连线消失

**文件:** `App.tsx`

**问题:** 剧本分集节点和创意描述子节点之间的连线不显示。

**原因:** `setConnections(prev => [...prev, newConnections])` 缺少展开运算符，整个数组被当作单个元素添加，导致 `connections` 变成嵌套数组，`ConnectionLayer` 无法识别。

**处理:** 改为 `setConnections(prev => [...prev, ...newConnections])`。

---

## 5. Gemini API 图片比例不生效（表情图非1:1、三视图16:9变9:16）

**文件:** `services/llmProviders/geminiProvider.ts`

**问题:** 使用 Gemini API 生成表情图比例不是 1:1，三视图应该 16:9 但生成 9:16。云雾 API 正常。

**原因:** 配置字段名错误。代码使用 `imageGenerationConfig`，但 Google GenAI SDK 期望 `imageConfig`。整个图片配置被 SDK 忽略，`aspectRatio` 和 `image_size` 参数都没有生效。

**处理:** `generationConfig.imageGenerationConfig` → `generationConfig.imageConfig`。

---

## 6. 九宫格分镜图出现文字

**文件:** `App.tsx`

**问题:** 九宫格分镜图中出现文字（角色名、面板编号等），应该是纯视觉画面。

**原因（5个文字泄漏源）:**
1. `shot.visualDescription` 包含中文角色名，直接拼入提示词
2. `shot.scene` 包含中文场景名
3. `sceneConsistencySection` 包含中文场景名和描述
4. `[Unique Panel ID: X]` 标记被 AI 渲染为面板编号
5. `[Panel X]:` 格式标签被渲染
6. `NO text` 约束放在提示词中间，权重不够

**处理:**
- 中文角色名替换为 `Character A/B/C` 英文代号（引号内的场景内文字如牌匾保留中文）
- 去掉 `[Unique Panel ID: X]` 标记
- `[Panel X]:` 改为 `---` 纯分隔符
- 场景一致性段落中 `Scene "教室"` 改为 `Location 1`
- 角色一致性段落用 `Character A = reference image 1` 映射代替中文名列表
- 提示词末尾新增 `ABSOLUTE RULE - NO TEXT IN IMAGE` 段（末尾权重最高）
- 明确唯一例外：场景描述中明确要求的牌匾/书籍中文可以渲染
