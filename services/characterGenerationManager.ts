/**
 * 角色生成状态管理服务
 * 使用独立ID管理每个角色的生成状态，避免状态互相覆盖
 */

import { CharacterProfile } from '../types';

// 角色生成任务类型
export type CharacterTaskType = 'PROFILE' | 'EXPRESSION' | 'THREE_VIEW';

// 任务状态
export type TaskStatus = 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED';

// 单个生成任务
export interface CharacterTask {
  id: string; // 全局唯一任务ID
  characterId: string; // 角色唯一ID
  nodeId: string; // 节点ID
  taskType: CharacterTaskType;
  status: TaskStatus;
  startTime?: number;
  endTime?: number;
  error?: string;
  result?: any;
}

// 角色生成状态（内部状态）
export interface CharacterGenerationState {
  // 唯一标识符（nodeId + 角色名）
  characterId: string;    // 唯一ID，格式：`${nodeId}|${characterName}`
  nodeId: string;         // 节点ID
  characterName: string;  // 角色名称（显示用）

  // 角色数据
  profile: CharacterProfile | null;

  // 各阶段生成状态
  profileStatus: TaskStatus;
  expressionStatus: TaskStatus;
  threeViewStatus: TaskStatus;

  // 当前任务ID（用于取消）
  currentProfileTaskId?: string;
  currentExpressionTaskId?: string;
  currentThreeViewTaskId?: string;

  // 生成结果
  expressionSheet?: string;
  threeViewSheet?: string;

  // 存储的提示词（用于重新生成）
  expressionPromptZh?: string;
  expressionPromptEn?: string;
  threeViewPromptZh?: string;
  threeViewPromptEn?: string;

  // 错误信息
  profileError?: string;
  expressionError?: string;
  threeViewError?: string;

  // UI状态
  isSaved: boolean;
  isGeneratingThreeView: boolean;

  // 创建时间（用于调试）
  createdAt: number;
  updatedAt: number;
}

// 生成队列项
interface QueueItem {
  task: CharacterTask;
  executor: () => Promise<any>;
  onSuccess: (result: any) => void;
  onError: (error: Error) => void;
}

class CharacterGenerationManager {
  // 存储所有角色的状态，key 是 characterId
  private states: Map<string, CharacterGenerationState> = new Map();

  // 存储所有任务（用于跟踪和取消）
  private tasks: Map<string, CharacterTask> = new Map();

  // 生成队列（确保任务按顺序执行）
  private queue: QueueItem[] = [];
  private isProcessingQueue: boolean = false;

  /**
   * 创建唯一的角色ID
   */
  private createCharacterId(nodeId: string, characterName: string): string {
    return `${nodeId}|${characterName}`;
  }

  /**
   * 创建任务ID
   */
  private createTaskId(nodeId: string, characterId: string, taskType: CharacterTaskType): string {
    return `${nodeId}-${characterId}-${taskType}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * 获取单个角色的状态
   */
  getCharacterState(nodeId: string, characterName: string): CharacterGenerationState | null {
    const characterId = this.createCharacterId(nodeId, characterName);
    return this.states.get(characterId) || null;
  }

  /**
   * 获取节点的所有角色状态
   */
  getCharactersForNode(nodeId: string): CharacterProfile[] {
    const characters: CharacterProfile[] = [];

    for (const [characterId, state] of this.states) {
      if (state.nodeId === nodeId) {
        characters.push(this.stateToProfile(state));
      }
    }


    return characters;
  }

  /**
   * 初始化新角色
   */
  initializeCharacter(nodeId: string, characterName: string): CharacterGenerationState {
    const characterId = this.createCharacterId(nodeId, characterName);
    const now = Date.now();


    const state: CharacterGenerationState = {
      characterId,
      nodeId,
      characterName,
      profile: null,
      profileStatus: 'PENDING',
      expressionStatus: 'PENDING',
      threeViewStatus: 'PENDING',
      isSaved: false,
      isGeneratingThreeView: false,
      createdAt: now,
      updatedAt: now
    };

    this.states.set(characterId, state);
    return state;
  }

  /**
   * 更新角色状态（保证不可变性）
   */
  updateCharacterState(
    nodeId: string,
    characterName: string,
    updates: Partial<CharacterGenerationState>
  ): CharacterGenerationState {
    const characterId = this.createCharacterId(nodeId, characterName);
    const currentState = this.states.get(characterId);

    if (!currentState) {
      console.error('[CharacterGenerationManager] updateCharacterState: Character not found:', { nodeId, characterName, characterId });
      throw new Error(`Character ${characterName} not found in node ${nodeId}`);
    }

    // 不可变更新 - 创建新对象
    const newState: CharacterGenerationState = {
      ...currentState,
      ...updates,
      updatedAt: Date.now()
    };

    this.states.set(characterId, newState);


    return newState;
  }

  /**
   * 添加任务到队列
   */
  async enqueueTask(
    task: CharacterTask,
    executor: () => Promise<any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        executor,
        onSuccess: resolve,
        onError: reject
      });


      this.processQueue();
    });
  }

  /**
   * 处理队列（确保任务按顺序执行）
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.queue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      const { nodeId, characterId, taskType } = item.task;


      try {
        // 更新任务状态为 GENERATING
        this.updateTaskStatus(item.task.id, 'GENERATING');

        // 执行任务
        const result = await item.executor();

        // 更新任务状态为 SUCCESS
        this.updateTaskStatus(item.task.id, 'SUCCESS', result);

        item.onSuccess(result);
      } catch (error) {
        console.error('[CharacterGenerationManager] Task failed:', {
          taskId: item.task.id,
          characterId,
          taskType,
          error: (error as Error).message
        });

        // 更新任务状态为 FAILED
        this.updateTaskStatus(item.task.id, 'FAILED', undefined, error);

        item.onError(error as Error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 更新任务状态
   */
  private updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    result?: any,
    error?: Error
  ) {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error('[CharacterGenerationManager] updateTaskStatus: Task not found:', taskId);
      return;
    }

    // 更新任务
    task.status = status;
    task.endTime = Date.now();
    if (error) task.error = error.message;
    if (result) task.result = result;

    // 从 characterId 中提取 nodeId 和 characterName
    const parts = task.characterId.split('|');
    const nodeId = parts[0];
    const characterName = parts.slice(1).join('|'); // 处理角色名中可能包含 | 的情况


    // 更新角色状态
    switch (task.taskType) {
      case 'PROFILE':
        if (status === 'GENERATING') {
          this.updateCharacterState(nodeId, characterName, {
            profileStatus: 'GENERATING',
            currentProfileTaskId: taskId
          });
        } else if (status === 'SUCCESS') {
          this.updateCharacterState(nodeId, characterName, {
            profileStatus: 'SUCCESS',
            profile: result || null,
            currentProfileTaskId: undefined
          });
        } else if (status === 'FAILED') {
          this.updateCharacterState(nodeId, characterName, {
            profileStatus: 'FAILED',
            profileError: error?.message,
            currentProfileTaskId: undefined
          });
        }
        break;

      case 'EXPRESSION':
        if (status === 'GENERATING') {
          this.updateCharacterState(nodeId, characterName, {
            expressionStatus: 'GENERATING',
            currentExpressionTaskId: taskId
          });
        } else if (status === 'SUCCESS') {
          this.updateCharacterState(nodeId, characterName, {
            expressionStatus: 'SUCCESS',
            expressionSheet: result,
            currentExpressionTaskId: undefined
          });
        } else if (status === 'FAILED') {
          this.updateCharacterState(nodeId, characterName, {
            expressionStatus: 'FAILED',
            expressionError: error?.message,
            currentExpressionTaskId: undefined
          });
        }
        break;

      case 'THREE_VIEW':
        if (status === 'GENERATING') {
          this.updateCharacterState(nodeId, characterName, {
            threeViewStatus: 'GENERATING',
            isGeneratingThreeView: true,
            currentThreeViewTaskId: taskId
          });
        } else if (status === 'SUCCESS') {
          this.updateCharacterState(nodeId, characterName, {
            threeViewStatus: 'SUCCESS',
            threeViewSheet: result,
            isGeneratingThreeView: false,
            currentThreeViewTaskId: undefined
          });
        } else if (status === 'FAILED') {
          this.updateCharacterState(nodeId, characterName, {
            threeViewStatus: 'FAILED',
            threeViewError: error?.message,
            isGeneratingThreeView: false,
            currentThreeViewTaskId: undefined
          });
        }
        break;
    }

    // 清理完成的任务
    if (status === 'SUCCESS' || status === 'FAILED') {
      this.tasks.delete(taskId);
    }
  }

  /**
   * 生成角色档案
   */
  async generateProfile(
    nodeId: string,
    characterName: string,
    executor: () => Promise<CharacterProfile>
  ): Promise<CharacterProfile> {
    const characterId = this.createCharacterId(nodeId, characterName);


    // 确保角色已初始化
    let state = this.states.get(characterId);
    if (!state) {
      state = this.initializeCharacter(nodeId, characterName);
    }

    // 创建任务
    const taskId = this.createTaskId(nodeId, characterId, 'PROFILE');
    const task: CharacterTask = {
      id: taskId,
      characterId,
      nodeId,
      taskType: 'PROFILE',
      status: 'PENDING',
      startTime: Date.now()
    };

    this.tasks.set(taskId, task);

    // 立即更新状态为GENERATING，这样UI可以立即响应
    this.updateCharacterState(nodeId, characterName, {
      profileStatus: 'GENERATING',
      currentProfileTaskId: taskId
    });

    // 添加到队列并执行
    return this.enqueueTask(task, executor);
  }

  /**
   * 生成表情图
   */
  async generateExpression(
    nodeId: string,
    characterName: string,
    executor: () => Promise<string>
  ): Promise<string> {
    const characterId = this.createCharacterId(nodeId, characterName);


    // 确保角色已初始化
    let state = this.states.get(characterId);
    if (!state) {
      state = this.initializeCharacter(nodeId, characterName);
    }

    // 创建任务
    const taskId = this.createTaskId(nodeId, characterId, 'EXPRESSION');
    const task: CharacterTask = {
      id: taskId,
      characterId,
      nodeId,
      taskType: 'EXPRESSION',
      status: 'PENDING',
      startTime: Date.now()
    };

    this.tasks.set(taskId, task);

    // 立即更新状态为GENERATING，这样UI可以立即响应
    this.updateCharacterState(nodeId, characterName, {
      expressionStatus: 'GENERATING',
      currentExpressionTaskId: taskId
    });

    // 添加到队列并执行
    return this.enqueueTask(task, executor);
  }

  /**
   * 生成三视图
   */
  async generateThreeView(
    nodeId: string,
    characterName: string,
    executor: () => Promise<string>
  ): Promise<string> {
    const characterId = this.createCharacterId(nodeId, characterName);


    // 确保角色已初始化
    let state = this.states.get(characterId);
    if (!state) {
      state = this.initializeCharacter(nodeId, characterName);
    }

    // 创建任务
    const taskId = this.createTaskId(nodeId, characterId, 'THREE_VIEW');
    const task: CharacterTask = {
      id: taskId,
      characterId,
      nodeId,
      taskType: 'THREE_VIEW',
      status: 'PENDING',
      startTime: Date.now()
    };

    this.tasks.set(taskId, task);

    // 立即更新状态为GENERATING，这样UI可以立即响应
    this.updateCharacterState(nodeId, characterName, {
      threeViewStatus: 'GENERATING',
      currentThreeViewTaskId: taskId
    });

    // 添加到队列并执行
    return this.enqueueTask(task, executor);
  }

  /**
   * 保存角色到库
   */
  saveCharacter(nodeId: string, characterName: string): void {
    const characterId = this.createCharacterId(nodeId, characterName);
    const state = this.states.get(characterId);
    if (!state) return;


    this.updateCharacterState(nodeId, characterName, {
      isSaved: true
    });
  }

  /**
   * 从 node.data 恢复角色数据（用于刷新后恢复）
   */
  restoreCharacter(
    nodeId: string,
    characterName: string,
    data: {
      profile?: any;
      expressionSheet?: string;
      threeViewSheet?: string;
      expressionPromptZh?: string;
      expressionPromptEn?: string;
      threeViewPromptZh?: string;
      threeViewPromptEn?: string;
    }
  ): void {
    const characterId = this.createCharacterId(nodeId, characterName);
    let state = this.states.get(characterId);

    // 如果不存在，先初始化
    if (!state) {
      state = this.initializeCharacter(nodeId, characterName);
    }


    // 通过 updateCharacterState 进行不可变更新
    const updates: Partial<CharacterGenerationState> = {};

    if (data.profile) {
      updates.profile = data.profile;
      updates.profileStatus = 'SUCCESS';
    }
    if (data.expressionSheet) {
      updates.expressionSheet = data.expressionSheet;
      updates.expressionStatus = 'SUCCESS';
    }
    if (data.threeViewSheet) {
      updates.threeViewSheet = data.threeViewSheet;
      updates.threeViewStatus = 'SUCCESS';
    }
    if (data.expressionPromptZh) updates.expressionPromptZh = data.expressionPromptZh;
    if (data.expressionPromptEn) updates.expressionPromptEn = data.expressionPromptEn;
    if (data.threeViewPromptZh) updates.threeViewPromptZh = data.threeViewPromptZh;
    if (data.threeViewPromptEn) updates.threeViewPromptEn = data.threeViewPromptEn;

    if (Object.keys(updates).length > 0) {
      this.updateCharacterState(nodeId, characterName, updates);
    }
  }

  /**
   * 删除角色
   */
  deleteCharacter(nodeId: string, characterName: string): void {
    const characterId = this.createCharacterId(nodeId, characterName);


    this.states.delete(characterId);

    // 清理该角色的所有任务
    for (const [taskId, task] of this.tasks) {
      if (task.characterId === characterId) {
        this.tasks.delete(taskId);
      }
    }

    // 从队列中移除该角色的任务
    this.queue = this.queue.filter(item => item.task.characterId !== characterId);
  }

  /**
   * 清理节点数据
   */
  clearNode(nodeId: string): void {

    // 删除该节点的所有角色状态
    for (const [characterId, state] of this.states) {
      if (state.nodeId === nodeId) {
        this.states.delete(characterId);
      }
    }

    // 清理该节点的所有任务
    for (const [taskId, task] of this.tasks) {
      if (task.nodeId === nodeId) {
        this.tasks.delete(taskId);
      }
    }

    // 从队列中移除该节点的任务
    this.queue = this.queue.filter(item => item.task.nodeId !== nodeId);
  }

  /**
   * 将内部状态转换为 CharacterProfile（兼容现有代码）
   */
  private stateToProfile(state: CharacterGenerationState): CharacterProfile {
    const status = this.getOverallStatus(state);

    // 构建结果对象，只包含有值的字段，避免 undefined 覆盖 existing 数据
    const result: any = {
      id: `${state.nodeId}-${state.characterName}`,
      name: state.characterName,
      status: status,
      error: this.getOverallError(state),
      isSaved: state.isSaved,
      profileStatus: state.profileStatus,
      expressionStatus: state.expressionStatus,
      threeViewStatus: state.threeViewStatus,
      isGeneratingExpression: state.expressionStatus === 'GENERATING',
      isGeneratingThreeView: state.threeViewStatus === 'GENERATING',
    };

    // profile 字段：只添加有值的
    if (state.profile) {
      const profileFields = [
        'alias', 'basicStats', 'profession', 'background', 'personality',
        'motivation', 'values', 'weakness', 'relationships', 'habits', 'appearance'
      ] as const;
      for (const field of profileFields) {
        if (state.profile[field] !== undefined && state.profile[field] !== null) {
          result[field] = state.profile[field];
        }
      }
      result.rawProfileData = state.profile;
    }

    // 生成结果：只添加有值的
    if (state.expressionSheet) result.expressionSheet = state.expressionSheet;
    if (state.threeViewSheet) result.threeViewSheet = state.threeViewSheet;

    // 提示词：只添加有值的
    if (state.expressionPromptZh) result.expressionPromptZh = state.expressionPromptZh;
    if (state.expressionPromptEn) result.expressionPromptEn = state.expressionPromptEn;
    if (state.threeViewPromptZh) result.threeViewPromptZh = state.threeViewPromptZh;
    if (state.threeViewPromptEn) result.threeViewPromptEn = state.threeViewPromptEn;

    // 错误信息：只添加有值的
    if (state.expressionError) result.expressionError = state.expressionError;
    if (state.threeViewError) result.threeViewError = state.threeViewError;

    return result as CharacterProfile;
  }

  /**
   * 计算总体状态
   */
  private getOverallStatus(state: CharacterGenerationState): 'GENERATING' | 'SUCCESS' | 'ERROR' {
    if (state.profileStatus === 'GENERATING' ||
        state.expressionStatus === 'GENERATING' ||
        state.threeViewStatus === 'GENERATING') {
      return 'GENERATING';
    }

    if (state.profileStatus === 'FAILED' ||
        state.expressionStatus === 'FAILED' ||
        state.threeViewStatus === 'FAILED') {
      return 'ERROR';
    }

    if (state.profileStatus === 'SUCCESS') {
      return 'SUCCESS';
    }

    return 'ERROR'; // 默认为错误
  }

  /**
   * 获取总体错误信息
   */
  private getOverallError(state: CharacterGenerationState): string | undefined {
    return state.profileError || state.expressionError || state.threeViewError;
  }

  /**
   * 获取节点状态快照（用于调试）
   */
  getDebugSnapshot(nodeId: string): any {
    const characters: any[] = [];
    const nodeTasks: CharacterTask[] = [];

    for (const [characterId, state] of this.states) {
      if (state.nodeId === nodeId) {
        characters.push({
          characterId: state.characterId,
          name: state.characterName,
          profileStatus: state.profileStatus,
          expressionStatus: state.expressionStatus,
          threeViewStatus: state.threeViewStatus,
          hasProfile: !!state.profile,
          hasExpression: !!state.expressionSheet,
          hasThreeView: !!state.threeViewSheet
        });
      }
    }

    for (const [taskId, task] of this.tasks) {
      if (task.nodeId === nodeId) {
        nodeTasks.push(task);
      }
    }

    return {
      characters,
      tasks: nodeTasks,
      queueLength: this.queue.length,
      totalStates: this.states.size
    };
  }
}

// 全局单例
export const characterGenerationManager = new CharacterGenerationManager();
