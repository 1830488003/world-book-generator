// --- Updater Module ---
const WBGUpdater = {
    gitRepoOwner: '1830488003',
    gitRepoName: 'world-book-generator',
    currentVersion: '0.0.0',
    latestVersion: '0.0.0',
    changelogContent: '',

    async fetchRawFileFromGitHub(filePath) {
        const url = `https://raw.githubusercontent.com/${this.gitRepoOwner}/${this.gitRepoName}/main/${filePath}`;
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(
                `Failed to fetch ${filePath} from GitHub: ${response.statusText}`,
            );
        }
        return response.text();
    },

    parseVersion(content) {
        try {
            return JSON.parse(content).version || '0.0.0';
        } catch (error) {
            console.error('Failed to parse version:', error);
            return '0.0.0';
        }
    },

    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    },

    async performUpdate() {
        const { getRequestHeaders } = SillyTavern.getContext().common;
        const { extension_types } = SillyTavern.getContext().extensions;
        toastr.info('正在开始更新...');
        try {
            const response = await fetch('/api/extensions/update', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    extensionName: 'world-book-generator',
                    global: extension_types['world-book-generator'] === 'global',
                }),
            });
            if (!response.ok) throw new Error(await response.text());

            toastr.success('更新成功！将在3秒后刷新页面应用更改。');
            setTimeout(() => location.reload(), 3000);
        } catch (error) {
            toastr.error(`更新失败: ${error.message}`);
        }
    },

    async showUpdateConfirmDialog() {
        const { POPUP_TYPE, callGenericPopup } =
            SillyTavern.getContext().popup;
        try {
            // 尝试获取CHANGELOG.md，如果失败则使用默认消息
            const changelogUrl = `https://raw.githubusercontent.com/${this.gitRepoOwner}/${this.gitRepoName}/main/CHANGELOG.md`;
            const response = await fetch(changelogUrl, { cache: 'no-cache' });
            if (response.ok) {
                this.changelogContent = await response.text();
            } else {
                this.changelogContent = `发现新版本 ${this.latestVersion}！\n(无法加载更新日志)`;
            }
        } catch (error) {
            this.changelogContent = `发现新版本 ${this.latestVersion}！您想现在更新吗？\n(更新日志加载失败: ${error.message})`;
        }

        if (
            await callGenericPopup(
                this.changelogContent,
                POPUP_TYPE.CONFIRM,
                {
                    okButton: '立即更新',
                    cancelButton: '稍后',
                    wide: true,
                    large: true,
                },
            )
        ) {
            await this.performUpdate();
        }
    },

    async checkForUpdates(isManual = false) {
        const updateButton = $('#wbg-check-update-button');
        const updateIndicator = $(
            '.extension_settings[data-extension-name="world-book-generator"] .update-indicator',
        );
        if (isManual) {
            updateButton
                .prop('disabled', true)
                .html('<i class="fas fa-spinner fa-spin"></i> 检查中...');
        }
        try {
            const localManifestText = await (
                await fetch(
                    `/scripts/extensions/third-party/world-book-generator/manifest.json?t=${Date.now()}`,
                )
            ).text();
            this.currentVersion = this.parseVersion(localManifestText);
            $('#wbg-current-version').text(this.currentVersion);

            const remoteManifestText =
                await this.fetchRawFileFromGitHub('manifest.json');
            this.latestVersion = this.parseVersion(remoteManifestText);

            if (
                this.compareVersions(
                    this.latestVersion,
                    this.currentVersion,
                ) > 0
            ) {
                updateIndicator.show();
                updateButton
                    .html(
                        `<i class="fa-solid fa-gift"></i> 发现新版 ${this.latestVersion}!`,
                    )
                    .off('click')
                    .on('click', () => this.showUpdateConfirmDialog());
                if (isManual) {
                    toastr.success(
                        `发现新版本 ${this.latestVersion}！点击按钮进行更新。`,
                    );
                    this.showUpdateConfirmDialog(); // 手动检查时直接弹出对话框
                }
            } else {
                updateIndicator.hide();
                if (isManual) toastr.info('您当前已是最新版本。');
            }
        } catch (error) {
            if (isManual) toastr.error(`检查更新失败: ${error.message}`);
        } finally {
            if (isManual) {
                 updateButton
                    .prop('disabled', false)
                    .html(
                        '<i class="fa-solid fa-cloud-arrow-down"></i> 检查更新',
                    );
            }
        }
    },
};

// 使用 jQuery 确保在 DOM 加载完毕后执行我们的代码
jQuery(async () => {
  // -----------------------------------------------------------------
  // 1. 定义常量和状态变量
  // -----------------------------------------------------------------
  const PAYMENT_SERVER_URL = 'https://world-book-payment-server.vercel.app';
  const extensionName = 'world-book-generator';
  const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
  let tavernHelperApi; // 存储 TavernHelper API
  const toastr = /** @type {any} */ (window).toastr;

  // 项目状态管理
  const projectState = {
    bookName: '',
    currentStage: 1,
    generatedContent: null,
    generatedOutlineContent: null,
    generatedDetailContent: null,
    generatedMechanicsContent: null,
  };

  // 新增：自动化后台任务状态
  const autoGenState = {
    isRunning: false,
    bookName: '',
    coreTheme: '',
    progress: [],
    isFinished: false,
    error: null,
  };

  const resetAutoGenState = () => {
    // Reset the state object
    Object.assign(autoGenState, {
      isRunning: false,
      isFinished: false,
      progress: [],
      bookName: '',
      coreTheme: '',
      error: null,
      stageCounts: undefined,
    });

    // Clear the UI using jQuery for consistency
    $('#auto-gen-status-list').empty();
    $('#auto-gen-status').hide();
    $('#wbg-autogen-finished-buttons').hide();
    $('#runAutoGenerationButton').prop('disabled', false);

    // Reset input fields using jQuery
    $('#autoBookName').val('');
    $('#autoCoreTheme').val('');
    $('#stage1Count').val('1');
    $('#stage2Count').val('1');
    $('#stage3Count').val('1');
    $('#stage4Count').val('1');
  };

  // 用于存储从外部JSON文件加载的数据的全局变量
  let worldElementPool = {};
  let detailElementPool = {};
  let plotElementPool = {};
  let femalePlotElementPool = {};
  let mechanicsElementPool = {};

  /**
   * 【v31.0.0 最终版】从插件内部以编程方式创建角色卡，并绑定一个指定的世界书。
   * @param {object} charData - 包含角色所有信息的对象（如name, description等）。
   * @param {string} worldBookName - 要绑定的世界书的确切名称。传空字符串或null则不绑定。
   * @param {File} [avatarFile] - (可选) 角色的头像文件对象。
   * @param {string} [source='manual'] - 调用来源，'manual' 或 'auto'。
   */
  async function createCharacterWithWorldBook(charData, worldBookName, avatarFile = null, source = 'manual') {
    // --- 1. 准备 FormData ---
    console.log(`正在创建角色 "${charData.name}" 并绑定世界书 "${worldBookName}"...`);
    const formData = new FormData();

    // 填充所有字段
    formData.append('ch_name', charData.name || '未命名角色');
    formData.append('description', charData.description || '');
    formData.append('first_mes', charData.first_message || '');
    formData.append('personality', charData.personality || '');
    formData.append('scenario', charData.scenario || '');
    formData.append('creator_notes', charData.creator_notes || '');
    formData.append('system_prompt', charData.system_prompt || '');
    formData.append('post_history_instructions', charData.post_history_instructions || '');
    formData.append('fav', String(charData.is_favorite || false));
    formData.append('tags', charData.tags || '');

    // 绑定世界书
    if (worldBookName) {
      formData.append('world', worldBookName);
    }

    // 添加头像
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    // --- 2. 提交数据到服务器 ---
    const { getRequestHeaders } = SillyTavern.getContext();
    const headers = getRequestHeaders();
    delete headers['Content-Type'];

    let newAvatarId = null;
    try {
      const response = await fetch('/api/characters/create', {
        method: 'POST',
        headers: headers,
        body: formData,
        cache: 'no-cache',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`服务器错误: ${response.status} ${errorText}`);
      }

      newAvatarId = await response.text();

      // --- 3. 最终方案：告知用户手动刷新 ---
      if (newAvatarId) {
        // 3.1 (可选) 更新标签全局索引
        if (charData.tags) {
          await updateGlobalTagMapForCharacter(newAvatarId, charData.tags);
        }

        // 3.2 (核心) 明确告知用户需要手动刷新
        toastr.success(
          `角色 "${charData.name}" 创建成功！请手动刷新页面以查看新角色。`,
          '操作成功',
          { timeOut: 10000 }, // 延长显示时间
        );

        // 对于手动流程，隐藏“创建”按钮
        if (source === 'manual') {
          $('#create-char-button').hide();
        }
      } else {
        throw new Error('服务器未返回新角色的ID。');
      }
    } catch (error) {
      console.error('角色创建流程失败:', error);
      toastr.error(`操作失败: ${error.message}`);
      // 重新抛出错误，以便上层调用者（如自动化流程）可以捕获它
      throw error;
    }
  }

  // -----------------------------------------------------------------
  // 新增：2.5 设置管理
  // -----------------------------------------------------------------
  const defaultSettings = {
    aiSource: 'tavern', // 'tavern' 或 'custom'
    apiUrl: '',
    apiKey: '',
    apiModel: '',
  };
  let settings = {};

  /**
   * 根据AI源选择，显示或隐藏自定义API设置区域
   */
  function toggleCustomApiSettings() {
    if ($('#wbg-ai-source').val() === 'custom') {
      $('#wbg-custom-api-settings').removeClass('hidden');
    } else {
      $('#wbg-custom-api-settings').addClass('hidden');
    }
  }

  /**
   * 从自定义API端点获取并填充模型列表
   */
  async function fetchApiModels() {
    const apiUrl = String($('#wbg-api-url').val()).trim();
    const apiKey = String($('#wbg-api-key').val()).trim();
    const $modelSelect = $('#wbg-api-model');
    const $fetchButton = $('#wbg-fetch-models');

    if (!apiUrl) {
      if (toastr) toastr.warning('请输入API基础URL。');
      return;
    }

    $fetchButton.prop('disabled', true).addClass('fa-spin');
    if (toastr) toastr.info('正在从API加载模型列表...');

    try {
      let modelsUrl = apiUrl;
      if (!modelsUrl.endsWith('/')) {
        modelsUrl += '/';
      }
      if (modelsUrl.includes('generativelanguage.googleapis.com')) {
        if (!modelsUrl.endsWith('models')) modelsUrl += 'models';
      } else if (modelsUrl.endsWith('/v1/')) {
        modelsUrl += 'models';
      } else if (!modelsUrl.endsWith('models')) {
        modelsUrl += 'v1/models';
      }

      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(modelsUrl, { method: 'GET', headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取模型列表失败: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const models = data.data || data;

      if (!Array.isArray(models) || models.length === 0) {
        throw new Error('API返回的模型列表为空或格式不正确。');
      }

      const currentlySelected = settings.apiModel;
      $modelSelect.empty();

      models.forEach(model => {
        const modelId = model.id;
        if (modelId) {
          const option = new Option(modelId, modelId, false, modelId === currentlySelected);
          $modelSelect.append(option);
        }
      });

      if (toastr) toastr.success(`成功加载了 ${models.length} 个模型。`);
      saveSettings(false);
    } catch (error) {
      console.error(`[${extensionName}] 获取模型列表时出错:`, error);
      if (toastr) toastr.error(`加载模型失败: ${error.message}`);
      $modelSelect.empty().append(new Option('加载失败，请检查URL/密钥并重试', ''));
    } finally {
      $fetchButton.prop('disabled', false).removeClass('fa-spin');
    }
  }
  /**
   * 调用自定义的OpenAI兼容API
   * @param {object} payload - 发送给AI的完整请求体，例如 { ordered_prompts: [...] }
   * @returns {Promise<string>} - AI返回的文本内容
   */
  async function callCustomApi(payload) {
    const { apiUrl, apiKey, apiModel } = settings;

    if (!apiUrl || !apiModel) {
      throw new Error('自定义API的URL和模型名称不能为空。');
    }

    let finalUrl = apiUrl.trim();
    if (!finalUrl.endsWith('/')) {
      finalUrl += '/';
    }

    if (finalUrl.includes('generativelanguage.googleapis.com')) {
      if (!finalUrl.endsWith('chat/completions')) {
        finalUrl += 'chat/completions';
      }
    } else if (finalUrl.endsWith('/v1/')) {
      finalUrl += 'chat/completions';
    } else if (!finalUrl.includes('/chat/completions')) {
      finalUrl += 'v1/chat/completions';
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body = JSON.stringify({
      model: apiModel,
      messages: payload.ordered_prompts,
      max_tokens: payload.max_tokens || 60000,
      stream: false,
    });

    console.log(`[${extensionName}] 正在调用自定义API...`, {
      url: finalUrl,
      model: apiModel,
    });
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`自定义API请求失败: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * 加载插件设置。
   */
  function loadSettings() {
    const context = SillyTavern.getContext();
    if (!context.extensionSettings[extensionName]) {
      context.extensionSettings[extensionName] = {};
    }

    settings = Object.assign({}, defaultSettings, context.extensionSettings[extensionName]);

    // 更新设置UI
    $('#wbg-ai-source').val(settings.aiSource);
    $('#wbg-api-url').val(settings.apiUrl);
    $('#wbg-api-key').val(settings.apiKey);

    const $modelSelect = $('#wbg-api-model');
    if (settings.apiModel) {
      $modelSelect.empty().append(new Option(`${settings.apiModel} (已保存)`, settings.apiModel));
      $modelSelect.val(settings.apiModel);
    } else {
      $modelSelect.empty().append(new Option('请先加载模型', ''));
    }

    toggleCustomApiSettings();
  }

  /**
   * 保存插件设置。
   */
  function saveSettings(showToast = true) {
    settings.aiSource = $('#wbg-ai-source').val();
    settings.apiUrl = $('#wbg-api-url').val();
    settings.apiKey = $('#wbg-api-key').val();
    settings.apiModel = $('#wbg-api-model').val();

    const context = SillyTavern.getContext();
    context.extensionSettings[extensionName] = settings;
    context.saveSettingsDebounced();

    if (showToast) {
      if (toastr) toastr.success('API设置已保存！');
    }
  }

  // -----------------------------------------------------------------
  // 2. SillyTavern API 封装
  // -----------------------------------------------------------------
  const delay = ms => new Promise(res => setTimeout(res, ms));

  async function waitForTavernHelper(retries = 20, interval = 500) {
    for (let i = 0; i < retries; i++) {
      if (window.TavernHelper && typeof window.TavernHelper.getLorebooks === 'function' && toastr) {
        console.log(`[${extensionName}] TavernHelper API and Toastr are available.`);
        return window.TavernHelper;
      }
      await delay(interval);
    }
    throw new Error(
      'TavernHelper API or Toastr is not available. Please ensure JS-Slash-Runner extension is installed and enabled.',
    );
  }

  async function createLorebookEntry(bookName, entryData) {
    if (!tavernHelperApi) tavernHelperApi = await waitForTavernHelper();
    return await tavernHelperApi.createLorebookEntry(bookName, entryData);
  }

  async function getLorebooks() {
    if (!tavernHelperApi) tavernHelperApi = await waitForTavernHelper();
    return await tavernHelperApi.getLorebooks();
  }

  async function getLorebookEntries(bookName) {
    if (!tavernHelperApi) tavernHelperApi = await waitForTavernHelper();
    return await tavernHelperApi.getLorebookEntries(bookName);
  }

  async function createLorebook(bookName) {
    if (!tavernHelperApi) tavernHelperApi = await waitForTavernHelper();
    const bookExists = (await tavernHelperApi.getLorebooks()).includes(bookName);
    if (!bookExists) {
      await tavernHelperApi.createLorebook(bookName);
    }
  }

  // -----------------------------------------------------------------
  // 3. 辅助函数
  // -----------------------------------------------------------------
  function extractAndCleanJson(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    // 1. 从Markdown代码块或原始文本中提取JSON字符串
    const match = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = match ? match[1] : rawText;
    if (!match) {
      const firstBracket = jsonString.indexOf('[');
      const lastBracket = jsonString.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        jsonString = jsonString.substring(firstBracket, lastBracket + 1);
      }
    }
    jsonString = jsonString.trim();

    // 2. "治愈"JSON：通过正则表达式查找所有 "content": "..." 结构
    // 并仅在其内部的字符串值中，将未转义的换行符和回车符替换为转义形式
    const healedJsonString = jsonString.replace(/"content":\s*"((?:[^"\\]|\\.)*)"/g, (match, contentValue) => {
      // 对捕获到的 content 字符串值进行处理
      const escapedContent = contentValue
        .replace(/\n/g, '\\n') // 转义换行符
        .replace(/\r/g, '\\r'); // 转义回车符
      // 重构 "content": "..." 部分
      return `"${'content'}": "${escapedContent}"`;
    });

    return healedJsonString;
  }

  /**
   * v35.0.0 新增：在UI中显示调试信息
   * @param {string} title - 调试窗口的标题
   * @param {string} content - 要显示的原始文本内容
   */
  function displayDebugInfo(title, content) {
    const container = $('#wbg-debug-output-container');
    const outputArea = $('#wbg-debug-output');
    const titleElement = container.find('h3');

    titleElement.text(title);
    outputArea.val(content);
    container.show();
  }

  function sanitizeEntry(entry) {
    // 定义世界书条目允许的字段白名单
    const allowedKeys = [
      'key',
      'keys',
      'comment',
      'content',
      'type',
      'position',
      'depth',
      'prevent_recursion',
      'order',
      'uid',
    ];
    const sanitized = {};
    // 遍历白名单，只保留entry中存在的、且在白名单内的字段
    for (const key of allowedKeys) {
      if (Object.hasOwn(entry, key)) {
        sanitized[key] = entry[key];
      }
    }
    return sanitized;
  }
  function setActiveStage(stageNumber) {
    projectState.currentStage = stageNumber;
    // 更新阶段内容显示
    $('.wbg-stage').removeClass('active');
    $(`#stage-${stageNumber}`).addClass('active');
    // 更新阶段选择器按钮高亮
    $('.stage-button').removeClass('active');
    $(`.stage-button[data-stage="${stageNumber}"]`).addClass('active');
  }

  /**
   * 阶段五：根据世界书内容和用户要求，生成角色卡数据
   */
  const handleGenerateCharacter = async () => {
    const bookName = $('#bookName').val();
    if (!bookName) {
      toastr.warning('请先确定世界书名称！');
      return;
    }
    const userPrompt = $('#wbg-char-prompt-input').val();
    if (!userPrompt) {
      toastr.warning('请输入角色生成要求！');
      return;
    }

    const generateButton = $('#generate-char-button');
    generateButton.text('正在生成...').prop('disabled', true);
    $('#create-char-button').prop('disabled', true);
    $('#wbg-char-output-area').val('AI正在思考...');

    try {
      const entries = await getLorebookEntries(bookName);
      const worldBookContent = JSON.stringify(entries, null, 2);

      const unrestrictPrompt = await $.get(`/${extensionFolderPath}/unrestrict-prompt.txt`);
      let basePrompt = await $.get(`/${extensionFolderPath}/character-generator-prompt.txt`);

      // 注意：为手动模式的角色生成添加一个特定的占位符
      basePrompt = basePrompt
        .replace('{{world_book_entries}}', worldBookContent)
        .replace('{{user_prompt}}', userPrompt);

      const finalPrompt = `${unrestrictPrompt}\n\n${basePrompt}`;
      console.log('手动角色生成最终提示词:', finalPrompt);

      const payload = {
        ordered_prompts: [{ role: 'user', content: finalPrompt }],
        max_tokens: 60000,
      };

      const response = await callApiWithCredits(payload);

      // v35.0.0: 无论成功失败，都显示AI的原始返回
      displayDebugInfo('【调试】手动角色生成AI 原始返回', response);

      const characterJsonString = extractAndCleanJson(response);

      if (characterJsonString) {
        // 尝试解析以确保是有效的JSON
        const characterData = JSON.parse(characterJsonString);
        // 格式化后显示在审核区
        $('#wbg-char-output-area').val(JSON.stringify(characterData, null, 2));
        $('#create-char-button').prop('disabled', false);
        toastr.success('角色数据生成成功，请审核后创建角色卡。');
      } else {
        throw new Error('AI未能返回有效的JSON格式角色数据。');
      }
    } catch (error) {
      console.error('角色数据生成失败:', error);
      toastr.error(`角色数据生成失败: ${error.message}`);
      $('#wbg-char-output-area').val(`生成失败: ${error.message}`);
    } finally {
      generateButton.text('生成角色数据').prop('disabled', false);
    }
  };

  /**
   * 阶段五：根据审核后的JSON数据，创建角色卡并绑定世界书
   */
  const handleCreateCharacter = async () => {
    const bookName = $('#bookName').val();
    const characterJsonString = $('#wbg-char-output-area').val();

    if (!characterJsonString) {
      toastr.error('没有可供创建的角色数据。');
      return;
    }

    const createButton = $('#create-char-button');
    createButton.text('正在创建...').prop('disabled', true);

    try {
      const characterData = JSON.parse(characterJsonString);
      // 【强制命名】确保角色卡的名称与世界书名称完全一致
      characterData.name = bookName;

      // 调用新的、正确的创建函数，并指明来源是'manual'
      await createCharacterWithWorldBook(characterData, bookName, null, 'manual');
    } catch (error) {
      console.error('创建角色卡失败:', error);
      // 错误消息已在 createCharacterWithWorldBook 中处理
    } finally {
      // 成功后按钮会被隐藏，失败后则恢复
      createButton.text('创建角色卡并绑定').prop('disabled', false);
    }
  };

  // 新增：使元素可拖动的函数（支持触摸和位置记忆）
  function makeDraggable(element) {
    // element is a jQuery object
    let isDragging = false;
    let offsetX, offsetY;
    let dragThreshold = 5;
    let startX, startY;

    // 新增：v52.3.0 边缘检测核心函数
    const keepInBounds = () => {
      const viewportWidth = $(window).width();
      const viewportHeight = $(window).height();
      const elementWidth = element.outerWidth();
      const elementHeight = element.outerHeight();
      const topMargin = 10; // 设置一个10像素的安全顶边距

      let currentX = parseFloat(element.css('left'));
      let currentY = parseFloat(element.css('top'));

      const newX = Math.max(0, Math.min(currentX, viewportWidth - elementWidth));
      const newY = Math.max(topMargin, Math.min(currentY, viewportHeight - elementHeight)); // 确保Y坐标不小于顶边距

      element.css({
        top: newY + 'px',
        left: newX + 'px',
      });
    };

    const dragStart = e => {
      // e.preventDefault(); // BUGFIX: 不要在这里阻止默认事件，它会阻止移动设备上的点击事件。仅在实际拖动时阻止。
      isDragging = false;
      const touch = e.type === 'touchstart' ? e.originalEvent.touches[0] : e;
      startX = touch.clientX;
      startY = touch.clientY;

      const domElement = element[0];
      // 确保使用的是 left/top 定位
      if (!domElement.style.left || !domElement.style.top) {
        const rect = domElement.getBoundingClientRect();
        domElement.style.left = `${rect.left}px`;
        domElement.style.top = `${rect.top}px`;
        domElement.style.right = ''; // 清除 right/bottom
        domElement.style.bottom = '';
      }

      offsetX = touch.clientX - domElement.getBoundingClientRect().left;
      offsetY = touch.clientY - domElement.getBoundingClientRect().top;

      $(document).on('mousemove.wbg-drag touchmove.wbg-drag', dragMove);
      $(document).on('mouseup.wbg-drag touchend.wbg-drag', dragEnd);
    };

    const dragMove = e => {
      const touch = e.type === 'touchmove' ? e.originalEvent.touches[0] : e;
      if (
        !isDragging &&
        (Math.abs(touch.clientX - startX) > dragThreshold || Math.abs(touch.clientY - startY) > dragThreshold)
      ) {
        isDragging = true;
        element.css('cursor', 'grabbing');
      }

      if (isDragging) {
        e.preventDefault(); // BUGFIX: 在拖动时阻止页面滚动
        let newX = touch.clientX - offsetX;
        let newY = touch.clientY - offsetY;

        const viewportWidth = $(window).width();
        const viewportHeight = $(window).height();
        const elementWidth = element.outerWidth();
        const elementHeight = element.outerHeight();
        const topMargin = 10; // 设置一个10像素的安全顶边距

        newX = Math.max(0, Math.min(newX, viewportWidth - elementWidth));
        newY = Math.max(topMargin, Math.min(newY, viewportHeight - elementHeight)); // 确保Y坐标不小于顶边距

        element.css({
          top: newY + 'px',
          left: newX + 'px',
        });
      }
    };

    const dragEnd = () => {
      $(document).off('mousemove.wbg-drag touchmove.wbg-drag');
      $(document).off('mouseup.wbg-drag touchend.wbg-drag');

      if (isDragging) {
        element.css('cursor', 'grab');

        // v52.3.0: 拖动结束后再次进行边缘检测
        keepInBounds();

        // 保存位置到 localStorage
        const finalPosition = {
          top: element.css('top'),
          left: element.css('left'),
        };
        localStorage.setItem('wbg_button_position', JSON.stringify(finalPosition));
      }
    };

    element.on('mousedown touchstart', dragStart);

    // v52.3.0: 监听窗口大小变化，动态调整按钮位置
    $(window).on('resize', () => {
      // 使用一个小的延迟来避免过于频繁的计算
      setTimeout(keepInBounds, 100);
    });

    // 返回一个函数，用于在 click 事件中检查是否发生了拖拽
    return {
      wasDragged: () => isDragging,
      keepInBounds: keepInBounds, // 暴露 keepInBounds 函数
    };
  }

  function populateAdvancedOptions() {
    const container = $('#advanced-options-content');
    container.empty();
    for (const category in worldElementPool) {
      const subcategories = worldElementPool[category];
      for (const subcategory in subcategories) {
        const options = subcategories[subcategory];
        const selectId = `adv-opt-${category}-${subcategory}`.replace(/\s/g, '-');
        let selectHtml = `<div class="wbg-advanced-option-item"><label for="${selectId}">${subcategory}:</label><select id="${selectId}" data-category="${subcategory}"><option value="">(AI自由发挥)</option>`;
        options.forEach(option => {
          selectHtml += `<option value="${option}">${option}</option>`;
        });
        selectHtml += '</select></div>';
        container.append(selectHtml);
      }
    }
  }

  function handleRandomizeAll() {
    $('#advanced-options-content select').each(function () {
      const options = $(this).find('option');
      const randomIndex = Math.floor(Math.random() * (options.length - 1)) + 1;
      $(this).prop('selectedIndex', randomIndex);
    });
    if (toastr) toastr.info('已为所有高级设定随机选择完毕！');
  }

  function populatePlotOptions(channel = 'male') {
    const container = $('#plot-options-content');
    const pool = channel === 'female' ? femalePlotElementPool : plotElementPool;
    container.empty();
    for (const category in pool) {
      const subcategories = pool[category];
      for (const subcategory in subcategories) {
        const options = subcategories[subcategory];
        const selectId = `plot-opt-${category}-${subcategory}`.replace(/\s/g, '-');
        let selectHtml = `<div class="wbg-advanced-option-item"><label for="${selectId}">${subcategory}:</label><select id="${selectId}" data-category="${subcategory}"><option value="">(AI自由发挥)</option>`;
        options.forEach(option => {
          selectHtml += `<option value="${option}">${option}</option>`;
        });
        selectHtml += '</select></div>';
        container.append(selectHtml);
      }
    }
  }

  function handleRandomizePlotOptions() {
    // The selector remains the same, as we are just replacing the content inside the container
    $('#plot-options-content select').each(function () {
      const options = $(this).find('option');
      const randomIndex = Math.floor(Math.random() * (options.length - 1)) + 1;
      $(this).prop('selectedIndex', randomIndex);
    });
    if (toastr) toastr.info('已为当前频道的剧情设定随机选择完毕！');
  }

  function populateDetailOptions() {
    const container = $('#detail-options-content');
    container.empty();
    for (const category in detailElementPool) {
      const subcategories = detailElementPool[category];
      for (const subcategory in subcategories) {
        const options = subcategories[subcategory];
        const selectId = `detail-opt-${category}-${subcategory}`.replace(/\s/g, '-');
        let selectHtml = `<div class="wbg-advanced-option-item"><label for="${selectId}">${subcategory}:</label><select id="${selectId}" data-category="${subcategory}"><option value="">(AI自由发挥)</option>`;
        options.forEach(option => {
          selectHtml += `<option value="${option}">${option}</option>`;
        });
        selectHtml += '</select></div>';
        container.append(selectHtml);
      }
    }
  }

  function handleRandomizeDetailOptions() {
    $('#detail-options-content select').each(function () {
      const options = $(this).find('option');
      const randomIndex = Math.floor(Math.random() * (options.length - 1)) + 1;
      $(this).prop('selectedIndex', randomIndex);
    });
    if (toastr) toastr.info('已为所有细节深化选项随机选择完毕！');
  }

  function populateMechanicsOptions() {
    const container = $('#mechanics-options-content');
    container.empty();
    for (const category in mechanicsElementPool) {
      const subcategories = mechanicsElementPool[category];
      for (const subcategory in subcategories) {
        const options = subcategories[subcategory];
        const selectId = `mech-opt-${category}-${subcategory}`.replace(/\s/g, '-');
        let selectHtml = `<div class="wbg-advanced-option-item"><label for="${selectId}">${subcategory}:</label><select id="${selectId}" data-category="${subcategory}"><option value="">(AI自由发挥)</option>`;
        options.forEach(option => {
          selectHtml += `<option value="${option}">${option}</option>`;
        });
        selectHtml += '</select></div>';
        container.append(selectHtml);
      }
    }
  }

  function handleRandomizeMechanicsOptions() {
    $('#mechanics-options-content select').each(function () {
      const options = $(this).find('option');
      const randomIndex = Math.floor(Math.random() * (options.length - 1)) + 1;
      $(this).prop('selectedIndex', randomIndex);
    });
    if (toastr) toastr.info('已为所有游戏机制选项随机选择完毕！');
  }

  // -----------------------------------------------------------------
  // 4. 核心逻辑
  // -----------------------------------------------------------------
  async function handleGenerateFoundation() {
    const bookName = String($('#bookName').val()).trim();
    if (!bookName) {
      if (toastr) toastr.warning('在开始前，请为你的世界命名！');
      return;
    }
    projectState.bookName = bookName;
    localStorage.setItem('wbg_lastBookName', bookName);

    const coreTheme = String($('#coreTheme').val()).trim();
    let advancedOptionsString = '';
    $('#advanced-options-content select').each(function () {
      const selectedValue = $(this).val();
      if (selectedValue) {
        const categoryName = $(this).data('category');
        advancedOptionsString += `- ${categoryName}: ${selectedValue}\\n`;
      }
    });

    if (!advancedOptionsString && !coreTheme) {
      toastr.warning('请至少选择一个“高级设定”或输入一个“核心主题”！');
      return;
    }

    toastr.info('正在构建提示词并注入思想钢印，请稍候...');
    $('#generateFoundationButton').prop('disabled', true).text('生成中...');
    $('#uploadFoundationButton').prop('disabled', true);
    $('#aiResponseTextArea-stage1').val('AI正在思考...');

    try {
      const [unrestrictPrompt, writingGuide, promptTemplate] = await Promise.all([
        $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
        $.get(`${extensionFolderPath}/writing-guide.txt`),
        $.get(`${extensionFolderPath}/generator-prompt.txt`),
      ]);
      const combinedPromptTemplate = `${unrestrictPrompt}\n\n${writingGuide}\n\n${promptTemplate}`;
      let finalPrompt = combinedPromptTemplate
        .replace(/{{bookName}}/g, bookName)
        .replace(/{{advancedOptions}}/g, advancedOptionsString || '无')
        .replace(/{{coreTheme}}/g, coreTheme || '无');

      console.log(`[${extensionName}] Final prompt for Foundation:`, finalPrompt);

      const payload = {
        ordered_prompts: [{ role: 'user', content: finalPrompt }],
        max_tokens: 60000,
      };

      const rawAiResponse = await callApiWithCredits(payload);

      projectState.generatedContent = rawAiResponse;
      $('#aiResponseTextArea-stage1').val(rawAiResponse);
      $('#uploadFoundationButton').prop('disabled', false);
      toastr.success('AI已生成回复，请检查内容后决定是否上传。');
    } catch (error) {
      console.error(`[${extensionName}] 生成世界基石失败:`, error);
      $('#aiResponseTextArea-stage1').val(`生成失败: ${error.message}`);
      toastr.error(`操作失败: ${error.message}`);
    } finally {
      $('#generateFoundationButton').prop('disabled', false).text('生成/补充内容');
    }
  }

  async function handleUploadFoundation() {
    const bookName = projectState.bookName;
    const rawAiResponse = projectState.generatedContent;
    if (!bookName || !rawAiResponse) {
      toastr.warning('没有可上传的内容。');
      return;
    }

    $('#uploadFoundationButton').prop('disabled', true).text('上传中...');
    try {
      const cleanedJsonString = extractAndCleanJson(rawAiResponse);
      const newGeneratedEntries = JSON.parse(cleanedJsonString);
      if (!Array.isArray(newGeneratedEntries)) throw new Error('AI返回的数据解析后不是一个JSON数组。');

      await createLorebook(bookName);
      for (const entry of newGeneratedEntries) {
        const sanitizedEntry = sanitizeEntry(entry);
        await createLorebookEntry(bookName, sanitizedEntry);
      }

      toastr.success(`成功上传 ${newGeneratedEntries.length} 个新条目到世界书 '${bookName}'！`);
      $('#aiResponseTextArea-stage1').val('上传成功！您可以继续补充内容，或通过上方按钮切换到下一阶段。');
      // setActiveStage(2); // 根据用户要求，禁用自动跳转
    } catch (error) {
      console.error(`[${extensionName}] 上传世界内容失败:`, error);
      toastr.error(`上传失败: ${error.message}`);
    } finally {
      $('#uploadFoundationButton').prop('disabled', false).text('上传至世界书');
    }
  }

  async function handleGenerateOutline() {
    const bookName = projectState.bookName;
    if (!bookName) {
      toastr.error('项目状态丢失，请返回第一步重新开始。');
      return;
    }

    const plotElements = String($('#plotElements').val()).trim();
    let plotOptionsString = '';
    $('#plot-options-content select').each(function () {
      const selectedValue = $(this).val();
      if (selectedValue) {
        const categoryName = $(this).data('category');
        plotOptionsString += `- ${categoryName}: ${selectedValue}\\n`;
      }
    });

    if (!plotOptionsString && !plotElements) {
      toastr.warning('请至少选择一个“剧情设定”或输入一些“剧情元素”！');
      return;
    }

    toastr.info('正在获取现有世界观并注入思想钢印，请稍候...');
    $('#generateOutlineButton').prop('disabled', true).text('生成中...');
    $('#uploadOutlineButton').prop('disabled', true);
    $('#aiResponseTextArea-stage2').val('AI正在思考...');

    try {
      const [unrestrictPrompt, writingGuide, promptTemplate, currentEntries] = await Promise.all([
        $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
        $.get(`${extensionFolderPath}/writing-guide.txt`),
        $.get(`${extensionFolderPath}/story-prompt.txt`),
        getLorebookEntries(bookName),
      ]);
      const combinedPromptTemplate = `${unrestrictPrompt}\n\n${writingGuide}\n\n${promptTemplate}`;
      const currentBookContent = JSON.stringify(currentEntries, null, 2);
      let finalPrompt = combinedPromptTemplate
        .replace(/{{world_book_entries}}/g, currentBookContent)
        .replace(/{{plot_elements}}/g, plotElements || '无')
        .replace(/{{plotOptions}}/g, plotOptionsString || '无');

      console.log(`[${extensionName}] Final prompt for Outline:`, finalPrompt);
      const payload = {
        ordered_prompts: [{ role: 'user', content: finalPrompt }],
        max_tokens: 60000,
      };
      const rawAiResponse = await callApiWithCredits(payload);

      projectState.generatedOutlineContent = rawAiResponse;
      $('#aiResponseTextArea-stage2').val(rawAiResponse);
      $('#uploadOutlineButton').prop('disabled', false);
      toastr.success('AI已生成剧情大纲，请检查后决定是否上传。');
    } catch (error) {
      console.error(`[${extensionName}] 生成剧情大纲失败:`, error);
      $('#aiResponseTextArea-stage2').val(`生成失败: ${error.message}`);
      toastr.error(`操作失败: ${error.message}`);
    } finally {
      $('#generateOutlineButton').prop('disabled', false).text('生成/补充剧情');
    }
  }

  async function handleUploadOutline() {
    const bookName = projectState.bookName;
    const rawAiResponse = projectState.generatedOutlineContent;
    if (!bookName || !rawAiResponse) {
      toastr.warning('没有可上传的剧情内容。');
      return;
    }

    $('#uploadOutlineButton').prop('disabled', true).text('上传中...');
    try {
      const cleanedJsonString = extractAndCleanJson(rawAiResponse);
      const newGeneratedEntries = JSON.parse(cleanedJsonString);
      if (!Array.isArray(newGeneratedEntries)) throw new Error('AI返回的数据解析后不是一个JSON数组。');

      for (const entry of newGeneratedEntries) {
        const sanitizedEntry = sanitizeEntry(entry);
        await createLorebookEntry(bookName, sanitizedEntry);
      }

      toastr.success(`成功将 ${newGeneratedEntries.length} 个剧情条目添加到世界书 '${bookName}'！`);
      $('#aiResponseTextArea-stage2').val('上传成功！您可以继续补充剧情，或通过上方按钮切换到下一阶段。');
      // setActiveStage(3); // 根据用户要求，禁用自动跳转
    } catch (error) {
      console.error(`[${extensionName}] 上传剧情内容失败:`, error);
      toastr.error(`上传失败: ${error.message}`);
    } finally {
      $('#uploadOutlineButton').prop('disabled', false).text('上传至世界书');
    }
  }

  async function handleGenerateDetail() {
    const bookName = projectState.bookName;
    if (!bookName) {
      toastr.error('项目状态丢失，请返回第一步重新开始。');
      return;
    }

    const detailElements = String($('#detailElements').val()).trim();
    let detailOptionsString = '';
    $('#detail-options-content select').each(function () {
      const selectedValue = $(this).val();
      if (selectedValue) {
        const categoryName = $(this).data('category');
        detailOptionsString += `- ${categoryName}: ${selectedValue}\\n`;
      }
    });

    if (!detailOptionsString && !detailElements) {
      toastr.warning('请至少选择一个“细节深化”选项或输入一些“核心主题”！');
      return;
    }

    toastr.info('正在获取现有世界观并注入思想钢印，请稍候...');
    $('#generateDetailButton').prop('disabled', true).text('生成中...');
    $('#uploadDetailButton').prop('disabled', true);
    $('#aiResponseTextArea-stage3').val('AI正在思考...');

    try {
      const [unrestrictPrompt, writingGuide, promptTemplate, currentEntries] = await Promise.all([
        $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
        $.get(`${extensionFolderPath}/writing-guide.txt`),
        $.get(`${extensionFolderPath}/detail-prompt.txt`),
        getLorebookEntries(bookName),
      ]);
      const combinedPromptTemplate = `${unrestrictPrompt}\n\n${writingGuide}\n\n${promptTemplate}`;
      const currentBookContent = JSON.stringify(currentEntries, null, 2);
      let finalPrompt = combinedPromptTemplate
        .replace(/{{world_book_entries}}/g, currentBookContent)
        .replace(/{{detail_elements}}/g, detailElements || '无')
        .replace(/{{detailOptions}}/g, detailOptionsString || '无');

      console.log(`[${extensionName}] Final prompt for Detail:`, finalPrompt);
      const payload = {
        ordered_prompts: [{ role: 'user', content: finalPrompt }],
        max_tokens: 60000,
      };
      const rawAiResponse = await callApiWithCredits(payload);

      projectState.generatedDetailContent = rawAiResponse;
      $('#aiResponseTextArea-stage3').val(rawAiResponse);
      $('#uploadDetailButton').prop('disabled', false);
      toastr.success('AI已生成细节内容，请检查后决定是否上传。');
    } catch (error) {
      console.error(`[${extensionName}] 生成细节内容失败:`, error);
      $('#aiResponseTextArea-stage3').val(`生成失败: ${error.message}`);
      toastr.error(`操作失败: ${error.message}`);
    } finally {
      $('#generateDetailButton').prop('disabled', false).text('生成/补充细节');
    }
  }

  async function handleUploadDetail() {
    const bookName = projectState.bookName;
    const rawAiResponse = projectState.generatedDetailContent;
    if (!bookName || !rawAiResponse) {
      toastr.warning('没有可上传的细节内容。');
      return;
    }

    $('#uploadDetailButton').prop('disabled', true).text('上传中...');
    try {
      const cleanedJsonString = extractAndCleanJson(rawAiResponse);
      const newGeneratedEntries = JSON.parse(cleanedJsonString);
      if (!Array.isArray(newGeneratedEntries)) throw new Error('AI返回的数据解析后不是一个JSON数组。');

      for (const entry of newGeneratedEntries) {
        const sanitizedEntry = sanitizeEntry(entry);
        await createLorebookEntry(bookName, sanitizedEntry);
      }

      toastr.success(`成功将 ${newGeneratedEntries.length} 个细节条目添加到世界书 '${bookName}'！`);
      $('#aiResponseTextArea-stage3').val('上传成功！您可以继续补充细节，或通过上方按钮切换到下一阶段。');
      // setActiveStage(4); // 根据用户要求，禁用自动跳转
    } catch (error) {
      console.error(`[${extensionName}] 上传细节内容失败:`, error);
      toastr.error(`上传失败: ${error.message}`);
    } finally {
      $('#uploadDetailButton').prop('disabled', false).text('上传至世界书');
    }
  }

  async function handleGenerateMechanics() {
    const bookName = projectState.bookName;
    if (!bookName) {
      toastr.error('项目状态丢失，请返回第一步重新开始。');
      return;
    }

    const mechanicsElements = String($('#mechanicsElements').val()).trim();
    let mechanicsOptionsString = '';
    $('#mechanics-options-content select').each(function () {
      const selectedValue = $(this).val();
      if (selectedValue) {
        const categoryName = $(this).data('category');
        mechanicsOptionsString += `- ${categoryName}: ${selectedValue}\\n`;
      }
    });

    if (!mechanicsOptionsString && !mechanicsElements) {
      toastr.warning('请至少选择一个“游戏机制”选项或输入一些“核心主题”！');
      return;
    }

    toastr.info('正在获取现有世界观并注入思想钢印，请稍候...');
    $('#generateMechanicsButton').prop('disabled', true).text('生成中...');
    $('#uploadMechanicsButton').prop('disabled', true);
    $('#aiResponseTextArea-stage4').val('AI正在思考...');

    try {
      const [unrestrictPrompt, writingGuide, promptTemplate, currentEntries] = await Promise.all([
        $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
        $.get(`${extensionFolderPath}/writing-guide.txt`),
        $.get(`${extensionFolderPath}/mechanics-prompt.txt`),
        getLorebookEntries(bookName),
      ]);
      const combinedPromptTemplate = `${unrestrictPrompt}\n\n${writingGuide}\n\n${promptTemplate}`;
      const currentBookContent = JSON.stringify(currentEntries, null, 2);
      let finalPrompt = combinedPromptTemplate
        .replace(/{{world_book_entries}}/g, currentBookContent)
        .replace(/{{mechanics_elements}}/g, mechanicsElements || '无')
        .replace(/{{mechanicsOptions}}/g, mechanicsOptionsString || '无');

      console.log(`[${extensionName}] Final prompt for Mechanics:`, finalPrompt);
      const payload = {
        ordered_prompts: [{ role: 'user', content: finalPrompt }],
        max_tokens: 60000,
      };
      const rawAiResponse = await callApiWithCredits(payload);

      projectState.generatedMechanicsContent = rawAiResponse;
      $('#aiResponseTextArea-stage4').val(rawAiResponse);
      $('#uploadMechanicsButton').prop('disabled', false);
      toastr.success('AI已生成游戏机制，请检查后决定是否上传。');
    } catch (error) {
      console.error(`[${extensionName}] 生成游戏机制失败:`, error);
      $('#aiResponseTextArea-stage4').val(`生成失败: ${error.message}`);
      toastr.error(`操作失败: ${error.message}`);
    } finally {
      $('#generateMechanicsButton').prop('disabled', false).text('设计/补充机制');
    }
  }

  async function handleUploadMechanics() {
    const bookName = projectState.bookName;
    const rawAiResponse = projectState.generatedMechanicsContent;
    if (!bookName || !rawAiResponse) {
      toastr.warning('没有可上传的游戏机制内容。');
      return;
    }

    $('#uploadMechanicsButton').prop('disabled', true).text('上传中...');
    try {
      const cleanedJsonString = extractAndCleanJson(rawAiResponse);
      const newGeneratedEntries = JSON.parse(cleanedJsonString);
      if (!Array.isArray(newGeneratedEntries)) throw new Error('AI返回的数据解析后不是一个JSON数组。');

      for (const entry of newGeneratedEntries) {
        const sanitizedEntry = sanitizeEntry(entry);
        await createLorebookEntry(bookName, sanitizedEntry);
      }

      toastr.success(`成功将 ${newGeneratedEntries.length} 个游戏机制条目添加到世界书 '${bookName}'！`);
      $('#aiResponseTextArea-stage4').val('上传成功！您的世界书已基本完成！');
    } catch (error) {
      console.error(`[${extensionName}] 上传游戏机制失败:`, error);
      toastr.error(`上传失败: ${error.message}`);
    } finally {
      $('#uploadMechanicsButton').prop('disabled', false).text('上传至世界书');
    }
  }

  // -----------------------------------------------------------------
  // 5. 欢迎页面与初始化流程
  // -----------------------------------------------------------------
  async function populateBooksDropdown() {
    try {
      const books = await getLorebooks();
      const dropdown = $('#existingBooksDropdown');
      dropdown.empty().append('<option value="">选择一个已有的世界书...</option>');
      books.forEach(book => dropdown.append($('<option></option>').val(book).text(book)));
    } catch (error) {
      console.error(`[${extensionName}] Failed to populate lorebooks dropdown:`, error);
      if (toastr) {
        toastr.error('无法加载世界书列表。');
      }
    }
  }

  function showLandingPage() {
    $('#wbg-generator-page').hide();
    $('#wbg-auto-generator-page').hide();
    $('#wbg-recharge-page').hide();
    $('#wbg-landing-page').show();
    $('#wbg-back-to-home-button').hide();
    populateBooksDropdown(); // Refresh dropdown when returning home
  }

  function handleStartNew() {
    Object.assign(projectState, {
      bookName: '',
      generatedContent: null,
      generatedOutlineContent: null,
    });
    $('#bookName').val('').prop('disabled', false);
    $('#wbg-landing-page').hide();
    $('#wbg-auto-generator-page').hide();
    $('#wbg-generator-page').show();
    $('#wbg-back-to-home-button').show();
    setActiveStage(1);
  }

  function handleStartAuto() {
    // 如果上次的任务已完成，重置状态以开始新任务
    if (autoGenState.isFinished) {
      resetAutoGenState();
    }

    $('#wbg-landing-page').hide();
    $('#wbg-generator-page').hide();
    $('#wbg-auto-generator-page').show();
    $('#wbg-back-to-home-button').show();
  }

  // 新的UI渲染函数：根据autoGenState渲染进度
  function renderAutoGenProgress() {
    if (!$('#wbg-auto-generator-page').is(':visible')) {
      return; // 如果页面不可见，不执行渲染
    }

    const statusList = $('#auto-gen-status-list');
    statusList.empty();

    const successIcon = '<i class="fa-solid fa-check-circle" style="color: #4CAF50;"></i>';
    const spinnerIcon = '<i class="fas fa-spinner fa-spin"></i>';
    const errorIcon = '<i class="fa-solid fa-times-circle" style="color: #F44336;"></i>';

    autoGenState.progress.forEach((msg, index) => {
      let icon;
      const isLastMessage = index === autoGenState.progress.length - 1;

      if (msg.toLowerCase().startsWith('错误')) {
        icon = errorIcon;
      } else if (isLastMessage && !autoGenState.isFinished) {
        icon = spinnerIcon; // 最后一条消息且未完成，显示旋转
      } else {
        icon = successIcon; // 其他所有（已完成的）消息都显示成功
      }
      statusList.append($(`<li>${icon} ${msg}</li>`));
    });

    // 更新按钮和输入框状态
    if (autoGenState.isRunning) {
      $('#runAutoGenerationButton').prop('disabled', true).text('正在全速生成中...');
      $('#autoBookName').val(autoGenState.bookName).prop('disabled', true);
      $('#autoCoreTheme').val(autoGenState.coreTheme).prop('disabled', true);
    } else {
      $('#runAutoGenerationButton').prop('disabled', false).text('开始全自动生成');
      $('#autoBookName').prop('disabled', false);
      $('#autoCoreTheme').prop('disabled', false);
    }
  }

  // 辅助函数：更新后台任务状态并触发UI渲染
  function updateAutoGenStatus(message) {
    if (message.toLowerCase().startsWith('错误')) {
      autoGenState.error = message;
      autoGenState.isRunning = false;
      autoGenState.isFinished = true;
    }

    autoGenState.progress.push(message);
    renderAutoGenProgress(); // 触发UI更新
  }

  // 真正的后台生成任务
  async function doAutomatedGeneration() {
    const maxRetries = 10;
    const retryDelay = 2000;

    /**
     * 新的、精确的重试辅助函数，增加了手动重试功能
     * @param {Function} taskFn - 要执行的异步任务函数
     * @param {string} taskName - 用于日志记录的任务名称
     * @returns {Promise<any>} - 任务函数的返回值
     */
    const executeTaskWithRetry = async (taskFn, taskName) => {
      let lastError = null;

      while (true) {
        // 外部循环，用于处理手动重试
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            // 在每次尝试前，清除可能存在的旧的重试按钮
            $('#wbg-retry-button-container').remove();
            return await taskFn(); // 尝试执行任务
          } catch (error) {
            lastError = error; // 记录最后一次错误
            const errorMessage = `错误: ${taskName}失败 - ${error.message}.`;
            if (attempt < maxRetries) {
              updateAutoGenStatus(`${errorMessage} 正在进行第 ${attempt}/${maxRetries} 次重试...`);
              await delay(retryDelay);
            } else {
              // 10次自动重试全部失败，跳出内层循环，准备用户交互
              break;
            }
          }
        }

        // 自动重试耗尽，现在需要用户干预
        updateAutoGenStatus(
          `错误: ${taskName}在 ${maxRetries} 次自动重试后仍然失败: ${lastError.message}。请检查错误信息，然后决定是否继续。`,
        );

        // 创建一个Promise，等待用户点击按钮
        await new Promise(resolve => {
          const statusList = $('#auto-gen-status-list');
          // 确保不会重复添加按钮
          if ($('#wbg-retry-button-container').length === 0) {
            const retryContainer = $(`
                            <li id="wbg-retry-button-container" style="list-style-type: none; margin-top: 10px;">
                                <button id="wbg-manual-retry-button" class="wbg-action-button">
                                    <i class="fa-solid fa-rotate-right"></i> 在此步骤上继续重试10次
                                </button>
                            </li>
                        `);
            statusList.append(retryContainer);

            $('#wbg-manual-retry-button').one('click', function () {
              $(this).prop('disabled', true).text('正在准备重试...');
              resolve(); // 用户点击后，Promise完成
            });
          }
        });

        // 用户点击了按钮，外部 while 循环将继续，开始新一轮的10次尝试
        updateAutoGenStatus(`用户选择继续。正在重新尝试任务: ${taskName}...`);
      }
    };

    try {
      const bookName = autoGenState.bookName;
      // 0. 创建世界书
      await createLorebook(bookName);
      projectState.bookName = bookName;
      localStorage.setItem('wbg_lastBookName', bookName);
      updateAutoGenStatus(`已创建世界书 '${bookName}'`);

      // 1. 任务拆解
      updateAutoGenStatus('正在请求“盘古”AI拆解核心任务...');
      const decomposerTask = async () => {
        // 修正：加载正确的“思想钢印”文件 unrestrict-prompt.txt
        const [decomposerTemplate, unrestrictPrompt] = await Promise.all([
          $.get(`${extensionFolderPath}/auto-generator-decomposer-prompt.txt`),
          $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
        ]);

        // 将“无限制”指令作为更高阶的指令，注入到任务拆解提示词的最前端
        const combinedTemplate = `${unrestrictPrompt}\n\n---\n\n${decomposerTemplate}`;

        const decomposerPrompt = combinedTemplate
          .replace('{{core_theme}}', autoGenState.coreTheme)
          .replace('{{stage1_count}}', autoGenState.stageCounts.stage1)
          .replace('{{stage2_count}}', autoGenState.stageCounts.stage2)
          .replace('{{stage3_count}}', autoGenState.stageCounts.stage3)
          .replace('{{stage4_count}}', autoGenState.stageCounts.stage4);

        const decomposerPayload = {
          ordered_prompts: [{ role: 'user', content: decomposerPrompt }],
          max_tokens: 60000,
        };

        // 新增：打印最终发送给“盘古”AI的提示词
        console.groupCollapsed('【发送指令】查看发送给“盘古”AI的完整提示词 (点击展开)');
        console.log(decomposerPrompt);
        console.groupEnd();

        const decomposerResponse = await callApiWithCredits(decomposerPayload);

        // v35.0.0: 无论成功失败，都显示AI的原始返回
        displayDebugInfo('【调试】“盘古”AI 原始返回', decomposerResponse);

        const cleanedDecomposerJson = extractAndCleanJson(decomposerResponse);
        const parsedInstructions = JSON.parse(cleanedDecomposerJson);

        if (!parsedInstructions.stage1_instruction || !Array.isArray(parsedInstructions.stage1_instruction)) {
          throw new Error('AI未返回有效的指令数组结构。');
        }
        return parsedInstructions;
      };
      const instructions = await executeTaskWithRetry(decomposerTask, '任务拆解');
      updateAutoGenStatus('任务拆解成功！');

      // 加载通用提示词
      const [unrestrictPrompt, writingGuide] = await Promise.all([
        $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
        $.get(`${extensionFolderPath}/writing-guide.txt`),
      ]);
      const basePrompt = `${unrestrictPrompt}\n\n${writingGuide}\n\n`;

      // 定义所有阶段
      const stages = [
        {
          name: '一 (世界基石)',
          count: autoGenState.stageCounts.stage1,
          instructions: instructions.stage1_instruction || [],
          promptFile: 'generator-prompt.txt',
          promptReplacer: (template, instruction) =>
            template
              .replace(/{{bookName}}/g, bookName)
              .replace(/{{advancedOptions}}/g, '无')
              .replace(/{{coreTheme}}/g, instruction),
        },
        {
          name: '二 (剧情构思)',
          count: autoGenState.stageCounts.stage2,
          instructions: instructions.stage2_instruction || [],
          promptFile: 'story-prompt.txt',
          promptReplacer: (template, instruction, entries) =>
            template
              .replace(/{{world_book_entries}}/g, JSON.stringify(entries, null, 2))
              .replace(/{{plot_elements}}/g, instruction)
              .replace(/{{plotOptions}}/g, '无'),
        },
        {
          name: '三 (细节填充)',
          count: autoGenState.stageCounts.stage3,
          instructions: instructions.stage3_instruction || [],
          promptFile: 'detail-prompt.txt',
          promptReplacer: (template, instruction, entries) =>
            template
              .replace(/{{world_book_entries}}/g, JSON.stringify(entries, null, 2))
              .replace(/{{detail_elements}}/g, instruction)
              .replace(/{{detailOptions}}/g, '无'),
        },
        {
          name: '四 (机制设计)',
          count: autoGenState.stageCounts.stage4,
          instructions: instructions.stage4_instruction || [],
          promptFile: 'mechanics-prompt.txt',
          promptReplacer: (template, instruction, entries) =>
            template
              .replace(/{{world_book_entries}}/g, JSON.stringify(entries, null, 2))
              .replace(/{{mechanics_elements}}/g, instruction)
              .replace(/{{mechanicsOptions}}/g, '无'),
        },
      ];

      // 循环执行所有阶段
      for (const stage of stages) {
        if (stage.instructions.length === 0) continue;

        const stageTemplate = await $.get(`${extensionFolderPath}/${stage.promptFile}`);

        for (let i = 0; i < stage.count; i++) {
          // 如果“盘古”AI返回的指令数量少于用户的要求，则复用最后一条指令
          const instruction = stage.instructions[i] || stage.instructions[stage.instructions.length - 1];
          const taskDisplayName = `${stage.name} (${i + 1}/${stage.count})`;
          updateAutoGenStatus(`开始执行 ${taskDisplayName}...`);

          // 定义要重试的完整任务：获取上下文、构建提示、调用AI、解析结果
          const generationTask = async () => {
            // 1. 获取最新上下文
            const currentEntries = await getLorebookEntries(bookName);
            // 2. 构建完整提示词
            const finalPrompt = stage.promptReplacer(basePrompt + stageTemplate, instruction, currentEntries);
            const payload = {
              ordered_prompts: [{ role: 'user', content: finalPrompt }],
              max_tokens: 60000,
            };

            // 新增：打印发送给各阶段生成AI的提示词
            console.groupCollapsed(`【发送指令】查看发送给阶段 ${stage.name} AI的完整提示词 (点击展开)`);
            console.log(finalPrompt);
            console.groupEnd();

            // 3. 调用AI
            const response = await callApiWithCredits(payload);

            // v35.0.0: 无论成功失败，都显示AI的原始返回
            displayDebugInfo(`【调试】阶段 ${stage.name} AI 原始返回`, response);

            // 4. 解析并返回结果
            return JSON.parse(extractAndCleanJson(response));
          };

          // 执行带重试的任务
          const entries = await executeTaskWithRetry(generationTask, taskDisplayName);

          // 上传结果 (不在重试循环内)
          for (const entry of entries) {
            await createLorebookEntry(bookName, sanitizeEntry(entry));
          }
          updateAutoGenStatus(`${taskDisplayName} 完成，生成了 ${entries.length} 个条目`);
        }
      }

      // 最终成功
      updateAutoGenStatus('恭喜！全自动生成流程已成功完成！');
      toastr.success(`世界书 '${bookName}' 已全自动生成完毕！`, '任务完成');

      // 新增：自动创建并绑定配套的角色卡
      updateAutoGenStatus('🤖 开始自动生成配套的“导演”角色卡...');
      try {
        await generateAndBindCharacter(autoGenState.bookName);
        updateAutoGenStatus('✅ 配套角色卡创建并绑定成功！', 'success');
      } catch (error) {
        console.error('配套角色卡创建失败:', error);
        updateAutoGenStatus(`❌ 配套角色卡创建失败: ${error.message}`, 'error');
      }

      autoGenState.isFinished = true;
      autoGenState.isRunning = false;
      renderAutoGenProgress(); // Final render to update button state
    } catch (error) {
      const errorMessage = `错误: ${error.message}`;
      console.error(`[${extensionName}] 自动化生成失败:`, error);
      toastr.error(errorMessage, '自动化生成失败');
      updateAutoGenStatus(errorMessage); // This will set isRunning to false
    } finally {
      // 无论成功或失败，任务结束后都显示完成按钮
      /** @type {HTMLElement | null} */
      const finishedButtons = document.querySelector('#wbg-autogen-finished-buttons');
      if (finishedButtons) {
        finishedButtons.style.display = 'flex';
      }
    }
  }

  // 自动化生成的启动器
  function runAutomatedGeneration() {
    if (autoGenState.isRunning) {
      toastr.warning('一个自动化任务已经在后台运行。');
      return;
    }

    const bookName = String($('#autoBookName').val()).trim();
    const coreTheme = String($('#autoCoreTheme').val()).trim();

    if (!bookName || !coreTheme) {
      toastr.warning('请同时提供新世界书的名称和核心创作要求！');
      return;
    }

    // 新增：读取各阶段执行次数
    const stageCounts = {
      stage1: parseInt(String($('#stage1Count').val()), 10) || 1,
      stage2: parseInt(String($('#stage2Count').val()), 10) || 1,
      stage3: parseInt(String($('#stage3Count').val()), 10) || 1,
      stage4: parseInt(String($('#stage4Count').val()), 10) || 1,
    };

    // 重置并初始化状态
    Object.assign(autoGenState, {
      isRunning: true,
      bookName: bookName,
      coreTheme: coreTheme,
      stageCounts: stageCounts, // 存入状态
      progress: [],
      isFinished: false,
      error: null,
    });

    // 更新UI
    $('#auto-gen-status').show();
    renderAutoGenProgress();

    // 异步启动后台任务，不阻塞UI
    doAutomatedGeneration();
  }

  /**
   * 【新增功能】根据世界书内容，自动生成并绑定一个“导演”角色卡。
   * @param {string} bookName - 刚刚创建的世界书的名称。
   */
  /**
   * 【v22.1.0 核心功能】
   * 为新创建的角色更新全局标签索引 (tags 和 tag_map)。
   * 这确保了通过插件添加的标签能被SillyTavern的UI正确识别和筛选。
   * @param {string} characterId - 新角色的头像文件名 (e.g., 'char_12345.png')
   * @param {string} tagsString - 从角色数据中获取的、以逗号分隔的标签字符串
   */
  async function updateGlobalTagMapForCharacter(characterId, tagsString) {
    if (!tagsString || typeof tagsString !== 'string') {
      return; // 没有标签需要处理
    }

    const { tags, tag_map, saveSettingsDebounced } = SillyTavern.getContext();
    if (!tags || !tag_map || !saveSettingsDebounced) {
      console.warn('[插件] 无法获取全局标签系统 (tags, tag_map)，跳过标签更新。');
      return;
    }

    const characterTags = tagsString
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const characterTagIds = [];

    characterTags.forEach(tagName => {
      let tagObject = tags.find(t => t.name === tagName);
      if (!tagObject) {
        // 标签不存在，创建一个新的
        const newId = Date.now() + Math.random(); // 确保ID唯一
        tagObject = {
          id: newId,
          name: tagName,
          color: null, // 或者一个随机颜色
        };
        tags.push(tagObject);
        console.log(`[插件] 创建了新标签: "${tagName}"`);
      }
      characterTagIds.push(tagObject.id);
    });

    // 更新 tag_map
    tag_map[characterId] = characterTagIds;

    // 保存设置
    saveSettingsDebounced();
    console.log(`[插件] 已为角色 ${characterId} 更新了 ${characterTagIds.length} 个标签的全局索引。`);
    toastr.info(`成功为新角色更新了 ${characterTagIds.length} 个标签。`);
  }

  async function generateAndBindCharacter(bookName) {
    // 1. 获取世界书内容作为上下文
    const entries = await tavernHelperApi.getLorebookEntries(bookName);
    const context = JSON.stringify(entries, null, 2);

    // 2. 加载角色生成提示词
    const [unrestrictPrompt, charPromptTemplate] = await Promise.all([
      $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
      $.get(`${extensionFolderPath}/character-generator-prompt.txt`),
    ]);
    const charPrompt = charPromptTemplate
      .replace('{{world_book_entries}}', context)
      .replace('{{user_prompt}}', '请根据世界书内容，生成一个合适的导演角色。'); // 修正：为自动生成添加默认的用户要求
    const finalPrompt = `${unrestrictPrompt}\n\n${charPrompt}`;

    // 3. 调用AI生成角色JSON
    updateAutoGenStatus('🧠 正在调用AI生成角色设定...');
    const payload = {
      ordered_prompts: [{ role: 'user', content: finalPrompt }],
      max_tokens: 60000, // 角色卡生成不需要太大
    };

    const aiResponse = await callApiWithCredits(payload);

    // v35.0.0: 无论成功失败，都显示AI的原始返回
    displayDebugInfo('【调试】“导演”角色卡AI 原始返回', aiResponse);

    const characterJson = extractAndCleanJson(aiResponse);

    if (!characterJson) {
      throw new Error('AI未能返回有效的角色JSON数据。');
    }

    const characterData = JSON.parse(characterJson);
    // 【强制命名】确保角色卡的名称与世界书名称完全一致
    characterData.name = bookName;
    updateAutoGenStatus(`👍 AI已生成角色: ${characterData.name}`);

    // 4. 【架构重构】通过新的API创建角色，并指明来源是'auto'
    await createCharacterWithWorldBook(characterData, bookName, null, 'auto');
  }

  async function handleContinue() {
    const selectedBook = String($('#existingBooksDropdown').val());
    if (!selectedBook) {
      toastr.warning('请先选择一个世界书！');
      return;
    }
    localStorage.setItem('wbg_lastBookName', selectedBook);
    toastr.info(`正在加载世界书 '${selectedBook}'...`);
    try {
      await getLorebookEntries(selectedBook);
      const stage = 4; // For now, let's just assume we can always edit any stage. A more complex logic can be added later.
      projectState.bookName = selectedBook;
      $('#bookName').val(selectedBook).prop('disabled', true);
      $('#wbg-landing-page').hide();
      $('#wbg-generator-page').show();
      $('#wbg-back-to-home-button').show();
      setActiveStage(stage);
      toastr.success(`已加载 '${selectedBook}'，您可以对任意阶段进行创作。`);
    } catch (error) {
      console.error(`[${extensionName}] Failed to continue project:`, error);
      toastr.error(`加载项目失败: ${error.message}`);
    }
  }

  async function handleQuickContinue() {
    const lastBookName = localStorage.getItem('wbg_lastBookName');
    if (!lastBookName) {
      toastr.warning('没有找到上次的项目记录。');
      return;
    }
    toastr.info(`正在快速加载上次的项目 '${lastBookName}'...`);
    try {
      await getLorebookEntries(lastBookName);
      const stage = 4; // 默认可以编辑所有阶段
      projectState.bookName = lastBookName;
      $('#bookName').val(String(lastBookName)).prop('disabled', true);
      $('#wbg-landing-page').hide();
      $('#wbg-generator-page').show();
      $('#wbg-back-to-home-button').show();
      setActiveStage(stage);
      toastr.success(`已加载 '${lastBookName}'，您可以对任意阶段进行创作。`);
      $('#wbg-popup-overlay').addClass('wbg-is-visible'); // 使用类来控制显示
    } catch (error) {
      console.error(`[${extensionName}] Failed to quick continue project:`, error);
      toastr.error(`快速加载项目失败: ${error.message}`);
    }
  }

  /**
   * 【新增】并行加载所有外部数据池JSON文件。
   * 使用Promise.allSettled确保即使某个文件加载失败，其他文件也能成功加载。
   */
  async function loadAllDataPools() {
    const dataFiles = {
      'world_elements.json': 'worldElementPool',
      'detail_elements.json': 'detailElementPool',
      'plot_elements.json': 'plotElementPool',
      'female_plot_elements.json': 'femalePlotElementPool',
      'mechanics_elements.json': 'mechanicsElementPool',
    };

    const promises = Object.keys(dataFiles).map(fileName => {
      const url = `/${extensionFolderPath}/data/${fileName}?v=${Date.now()}`;
      return $.getJSON(url)
        .then(data => ({
          status: 'fulfilled',
          value: data,
          key: dataFiles[fileName],
        }))
        .catch(error => ({
          status: 'rejected',
          reason: `Failed to load ${fileName}: ${error.statusText}`,
          key: dataFiles[fileName],
        }));
    });

    const results = await Promise.allSettled(promises);

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.status === 'fulfilled') {
        const key = result.value.key;
        const data = result.value.value;
        switch (key) {
          case 'worldElementPool':
            worldElementPool = data;
            break;
          case 'detailElementPool':
            detailElementPool = data;
            break;
          case 'plotElementPool':
            plotElementPool = data;
            break;
          case 'femalePlotElementPool':
            femalePlotElementPool = data;
            break;
          case 'mechanicsElementPool':
            mechanicsElementPool = data;
            break;
        }
      } else {
        const reason = result.reason || (result.value && result.value.reason);
        console.error(`[${extensionName}] ${reason}`);
        if (toastr) toastr.warning(reason, '数据池加载部分失败');
      }
    });
  }

  async function initializeExtension() {
    console.log(`[${extensionName}] 1. 开始初始化...`);
    // 动态加载CSS，确保其作用域仅限于本插件创建的元素
    $('head').append(`<link rel="stylesheet" type="text/css" href="${extensionFolderPath}/style.css?v=${Date.now()}">`);
    try {
      console.log(`[${extensionName}] 2. 准备加载外部数据池...`);
      await loadAllDataPools();
      console.log(`[${extensionName}] 3. 外部数据池加载成功。`);

      console.log(`[${extensionName}] 4. 准备加载HTML模板...`);
      const [settingsHtml, popupHtml] = await Promise.all([
        $.get(`${extensionFolderPath}/settings.html`),
        $.get(`${extensionFolderPath}/popup.html?v=${Date.now()}`),
      ]);
      console.log(`[${extensionName}] 5. HTML模板加载成功。`);

      $('#extensions_settings2').append(settingsHtml);

      // 创建一个专用的根容器，避免直接污染body
      const extensionContainer = $('<div id="world-book-generator-container"></div>');
      $('body').append(extensionContainer);
      extensionContainer.append(popupHtml);

      console.log(`[${extensionName}] 6. HTML已注入到专用容器中。`);

      // 新增：加载API设置并绑定事件
      console.log(`[${extensionName}] 9. 准备加载API设置...`);
      loadSettings();
      $('#wbg-ai-source').on('change', () => {
        toggleCustomApiSettings();
        saveSettings(false);
      });
      $('#wbg-api-url').on('input', () => saveSettings(false));
      $('#wbg-api-key').on('input', () => saveSettings(false));
      $('#wbg-api-model').on('change', () => saveSettings(false));
      $('#wbg-save-api').on('click', () => saveSettings(true));
      $('#wbg-fetch-models').on('click', fetchApiModels);
      
      // 更新器UI绑定
      $('#wbg-check-update-button').on('click', () => WBGUpdater.checkForUpdates(true));

      console.log(`[${extensionName}] 10. API设置加载并绑定事件成功。`);
    } catch (error) {
      // 使用 console.error 打印完整的错误对象，而不仅仅是 error.message
      console.error(`[${extensionName}] 初始化过程中断！错误详情:`, error);
      // 确保即使初始化失败，用户也能在UI上看到提示
      if (toastr) {
        toastr.error(`[${extensionName}] 初始化失败，请按F12查看控制台获取详细错误信息。`, '插件错误', { timeOut: 0 });
      }
      return; // 中断执行
    }

    // 将浮动按钮也添加到专用容器中
    $('#world-book-generator-container').append(
      '<div id="wbg-floating-button" title="世界书生成器 (可拖动)"><i class="fa-solid fa-book-bookmark"></i></div>',
    );

    const fab = $('#wbg-floating-button');

    const draggable = makeDraggable(fab);

    // 恢复并优化位置记忆功能
    const savedPosition = localStorage.getItem('wbg_button_position');
    if (savedPosition) {
      try {
        const pos = JSON.parse(savedPosition);
        fab.css({
          top: pos.top,
          left: pos.left,
          right: 'auto', // 清除默认的 right/bottom
          bottom: 'auto',
        });
      } catch (e) {
        console.error('世界书生成器：解析已保存的按钮位置失败', e);
        localStorage.removeItem('wbg_button_position');
      }
    }

    // 确保初始加载时按钮也在屏幕内
    setTimeout(() => draggable.keepInBounds(), 100);

    // 在HTML加载后，初始化更新器
    console.log(`[${extensionName}] 7. 准备初始化更新检查器...`);
    // 替换为新的静默更新检查
    WBGUpdater.checkForUpdates(false);
    console.log(`[${extensionName}] 8. 更新检查器初始化成功。`);

    fab.on('click', async () => {
      // Make the handler async
      // 如果是拖拽事件，则不执行点击逻辑
      if (draggable.wasDragged()) {
        return;
      }

      // 最终修复：将网络请求串行化，并在后台执行，避免竞争和互相干扰
      setTimeout(async () => {
        // 任务一：后台安全地检查待处理订单
        try {
          console.log('[WBG] 后台任务#1: 开始检查待处理订单...');
          await rechargeManager.checkPendingOrders();
          console.log('[WBG] 后台任务#1: 检查待处理订单完成。');
        } catch (error) {
          console.error('[WBG] 后台检查订单时捕获到顶层错误:', error);
        }

        // 任务二：在前一个任务完成后，再开始检查更新
        try {
          console.log('[WBG] 后台任务#2: 开始检查更新...');
          await WBGUpdater.checkForUpdates(false);
          console.log('[WBG] 后台任务#2: 检查更新完成。');
        } catch (error) {
          console.error('[WBG] 后台检查更新时捕获到顶层错误:', error);
        }
      }, 200); // 稍微增加延迟，确保UI完全稳定

      // 检查是否有后台任务正在运行或已完成
      if (autoGenState.isRunning || (autoGenState.isFinished && autoGenState.progress.length > 0)) {
        // 如果有，直接显示自动化页面并渲染进度
        $('#wbg-landing-page').hide();
        $('#wbg-generator-page').hide();
        $('#wbg-auto-generator-page').show();
        $('#auto-gen-status').show();
        renderAutoGenProgress();
      } else {
        // 否则，显示正常的欢迎页面
        const lastBookName = localStorage.getItem('wbg_lastBookName');
        if (lastBookName) {
          $('#quickContinueButton').show().find('span').text(lastBookName);
        } else {
          $('#quickContinueButton').hide();
        }
        $('#wbg-generator-page').hide();
        $('#wbg-auto-generator-page').hide();
        $('#wbg-landing-page').show();
        populateBooksDropdown();
      }

      $('#wbg-popup-overlay').addClass('wbg-is-visible');
    });

    // 修正：使用 .wbg-header .close-button 确保只选择页头内的关闭按钮
    $('#wbg-popup-close-button').on('click', () => $('#wbg-popup-overlay').removeClass('wbg-is-visible'));

    // 新增：返回主页按钮事件
    $('#wbg-back-to-home-button').on('click', showLandingPage);

    $('#wbg-popup').on('click', e => e.stopPropagation());

    // 欢迎页面按钮
    $('#startNewButton').on('click', handleStartNew);
    $('#startAutoButton').on('click', handleStartAuto);
    $('#continueButton').on('click', handleContinue);
    $('#quickContinueButton').on('click', handleQuickContinue);

    // 自动化页面按钮
    $('#runAutoGenerationButton').on('click', runAutomatedGeneration);
    $('#wbg-autogen-back-to-home').on('click', () => {
      $('#wbg-auto-generator-page').hide();
      $('#wbg-landing-page').show();
    });
    $('#wbg-autogen-finish-task').on('click', () => {
      resetAutoGenState();
      $('#wbg-auto-generator-page').hide();
      $('#wbg-landing-page').show();
    });

    // 阶段选择器
    $('#wbg-stage-selector').on('click', '.stage-button', function () {
      const stage = $(this).data('stage');
      setActiveStage(stage);
    });

    // 阶段一按钮
    $('#randomizeAllButton').on('click', handleRandomizeAll);
    $('#generateFoundationButton').on('click', handleGenerateFoundation);
    $('#uploadFoundationButton').on('click', handleUploadFoundation);

    // 阶段二按钮
    $('#randomizePlotButton').on('click', handleRandomizePlotOptions);
    $('#generateOutlineButton').on('click', handleGenerateOutline);
    $('#uploadOutlineButton').on('click', handleUploadOutline);

    // 新增：剧情频道切换逻辑
    $('#plot-channel-selector').on('click', '.channel-button', function () {
      const channel = $(this).data('channel');
      if ($(this).hasClass('active')) {
        return; // 如果已经是激活状态，则不执行任何操作
      }
      // 更新按钮的激活状态
      $('#plot-channel-selector .channel-button').removeClass('active');
      $(this).addClass('active');
      // 根据选择的频道重新填充剧情选项
      populatePlotOptions(channel);
      toastr.info(`已切换到 ${channel === 'male' ? '男频' : '女频'} 创作频道。`);
    });

    // 阶段三按钮
    $('#randomizeDetailButton').on('click', handleRandomizeDetailOptions);
    $('#generateDetailButton').on('click', handleGenerateDetail);
    $('#uploadDetailButton').on('click', handleUploadDetail);

    // 阶段四按钮
    $('#randomizeMechanicsButton').on('click', handleRandomizeMechanicsOptions);
    $('#generateMechanicsButton').on('click', handleGenerateMechanics);
    $('#uploadMechanicsButton').on('click', handleUploadMechanics);

    // 阶段五按钮
    $('#generate-char-button').on('click', handleGenerateCharacter);
    $('#create-char-button').on('click', handleCreateCharacter);

    // 初始化高级选项
    populateAdvancedOptions();
    populatePlotOptions();
    populateDetailOptions();
    populateMechanicsOptions();

  // --- 全面重构：计次与充值功能初始化 ---
  creditManager.init();
  rechargeManager.init();
  userManager.init(); // 新增：初始化用户管理器
  }

  // --- 新增：用户数据管理器 ---
  const userManager = {
      userId: null,
      storageKey: 'wbg_user_id',

      async init() {
          this.userId = localStorage.getItem(this.storageKey);
          // 无论用户ID是否存在，都在启动时同步一次数据
          // 如果ID不存在，服务器会创建一个新的并返回
          await this.sync();
      },

      async sync() {
          try {
              const response = await fetch(`${PAYMENT_SERVER_URL}/api/update-user`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      userId: this.userId,
                      credits: creditManager.get(),
                  }),
              });

              if (!response.ok) {
                  throw new Error(`服务器错误: ${response.status}`);
              }

              const data = await response.json();
              if (data.success && data.userId) {
                  // 如果服务器返回了userId（特别是对于新用户），则更新并保存它
                  if (this.userId !== data.userId) {
                      this.userId = data.userId;
                      localStorage.setItem(this.storageKey, this.userId);
                      console.log(`[UserManager] 已从服务器获取并保存新用户ID: ${this.userId}`);
                  }
              }
          } catch (error) {
              console.error('[UserManager] 同步用户数据失败:', error);
              // 在这里可以添加一些错误处理逻辑，比如稍后重试
          }
      },
  };

  // --- 新增：计次系统管理器 ---
  const creditManager = {
    credits: 100,
    storageKey: 'wbg_credits',
    countElement: null,

    init() {
      this.countElement = $('#wbg-credits-count');
      const savedCredits = localStorage.getItem(this.storageKey);
      if (savedCredits !== null) {
        this.credits = parseInt(savedCredits, 10);
      } else {
        // 首次使用，赠送100次
        this.credits = 100;
        localStorage.setItem(this.storageKey, this.credits);
      }
      this.updateDisplay();
    },

    get() {
      return this.credits;
    },

    use() {
      if (this.credits <= 0) {
        toastr.error('AI调用次数已用完，请充值。');
        // REFACTORED: 不再弹出弹窗，而是切换到充值页面
        rechargeManager.showPage();
        return false; // 表示次数不足
      }
      this.credits--;
      localStorage.setItem(this.storageKey, this.credits);
      this.updateDisplay();
      userManager.sync(); // 同步到服务器
      return true; // 表示扣除成功
    },

    add(amount, showToast = true) {
      this.credits += amount;
      localStorage.setItem(this.storageKey, this.credits);
      this.updateDisplay();
      if (showToast) {
        toastr.success(`成功充值 ${amount} 次！`);
      }
      userManager.sync(); // 同步到服务器
    },

    updateDisplay() {
      if (this.countElement) {
        this.countElement.text(this.credits);
      }
      // 如果次数为0，禁用所有生成按钮
      const allGenerateButtons = $('.wbg-action-button.wbg-primary');
      if (this.credits <= 0) {
        allGenerateButtons.prop('disabled', true);
        $('#runAutoGenerationButton').text('次数不足，请充值');
      } else {
        allGenerateButtons.prop('disabled', false);
        // 恢复按钮原来的文本
        $('#generateFoundationButton').text('生成/补充内容');
        $('#generateOutlineButton').text('生成/补充剧情');
        $('#generateDetailButton').text('生成/补充细节');
        $('#generateMechanicsButton').text('设计/补充机制');
        $('#generate-char-button').text('生成角色数据');
        $('#runAutoGenerationButton').text('开始全自动生成');
      }
    },
  };

  // --- 新增：AI调用封装函数 (集成计次) ---
  async function callApiWithCredits(payload) {
    if (!creditManager.use()) {
      // 如果次数不足，creditManager.use()会返回false并处理UI提示
      throw new Error('AI调用次数已用完。');
    }
    // 次数充足，继续执行API调用
    try {
      return settings.aiSource === 'custom' ? await callCustomApi(payload) : await tavernHelperApi.generateRaw(payload);
    } catch (error) {
      // 如果API调用失败，把扣掉的次数还给用户
      creditManager.add(1);
      toastr.warning('API调用失败，已返还本次消耗的次数。');
      throw error; // 继续向上抛出错误
    }
  }

  // --- REFACTORED: 充值逻辑管理器 (页面切换模式) ---
  const rechargeManager = {
    rechargeButton: null,
    backButton: null,
    tierButtons: null,
    step1: null,
    step2: null,
    priceElement: null,
    codeElement: null,
    statusElement: null,

    previousPage: null, // 用于记录返回地址
    orderId: null,
    pollInterval: null,
    pendingOrdersKey: 'wbg_pending_orders',

    init() {
      this.rechargeButton = $('#wbg-recharge-button');
      this.backButton = $('#wbg-recharge-back-button');
      this.tierButtons = $('#wbg-recharge-page .wbg-tier-button');
      this.step1 = $('#wbg-recharge-step-1');
      this.step2 = $('#wbg-recharge-step-2');
      this.priceElement = $('#wbg-recharge-price');
      this.codeElement = $('#wbg-payment-code');
      this.statusElement = $('#wbg-payment-status');
      this.confirmPaymentButton = $('#wbg-confirm-payment-button');
      this.waitMessage = $('#wbg-payment-wait-message');

      this.rechargeButton.on('click', () => this.showPage());
      this.backButton.on('click', () => this.hidePage());
      this.tierButtons.on('click', event => {
        const tier = $(event.currentTarget).data('tier');
        this.initiateRecharge(tier);
      });
      this.confirmPaymentButton.on('click', () => this.confirmUserPaymentAndStartPolling());
    },

    getPendingOrders() {
      const ordersJson = localStorage.getItem(this.pendingOrdersKey);
      if (!ordersJson) return [];
      let orders = JSON.parse(ordersJson);
      // 从旧格式（字符串数组）到新格式（对象数组）的迁移程序
      if (orders.length > 0 && typeof orders[0] === 'string') {
        orders = orders.map(id => ({ id: id, failures: 0 }));
        localStorage.setItem(this.pendingOrdersKey, JSON.stringify(orders));
      }
      return orders;
    },

    addPendingOrder(orderId) {
      const orders = this.getPendingOrders();
      // 确保不会重复添加同一个订单ID
      if (!orders.some(order => order.id === orderId)) {
        orders.push({ id: orderId, failures: 0 });
        localStorage.setItem(this.pendingOrdersKey, JSON.stringify(orders));
      }
    },

    removePendingOrder(orderId) {
      let orders = this.getPendingOrders();
      orders = orders.filter(order => order.id !== orderId);
      localStorage.setItem(this.pendingOrdersKey, JSON.stringify(orders));
    },

    showPage() {
      // 确定当前显示的页面并保存
      if ($('#wbg-landing-page').is(':visible')) {
        this.previousPage = '#wbg-landing-page';
      } else if ($('#wbg-generator-page').is(':visible')) {
        this.previousPage = '#wbg-generator-page';
      } else if ($('#wbg-auto-generator-page').is(':visible')) {
        this.previousPage = '#wbg-auto-generator-page';
      } else {
        this.previousPage = '#wbg-landing-page'; // 默认返回欢迎页
      }

      // 隐藏当前页面，显示充值页面
      $(this.previousPage).hide();
      $('#wbg-recharge-page').show();

      // 重置充值页面状态
      this.step1.show();
      this.step2.hide();
      this.tierButtons.prop('disabled', false);
      this.statusElement.text('正在等待支付确认...').css('color', ''); // 恢复默认文字和颜色
    },

    hidePage() {
      $('#wbg-recharge-page').hide();
      if (this.previousPage) {
        $(this.previousPage).show();
      } else {
        $('#wbg-landing-page').show(); // 默认返回欢迎页
      }

      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    },

    // 步骤1: 选择档位后，创建订单并获取orderId
    async initiateRecharge(tier) {
      this.tierButtons.prop('disabled', true);
      toastr.info('正在生成支付订单...');

      try {
        const response = await fetch(`${PAYMENT_SERVER_URL}/api/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || '无法连接支付服务器。');
        }

        const data = await response.json();
        this.orderId = data.orderId; // 保存订单ID
        this.addPendingOrder(this.orderId);

        this.priceElement.text(data.price);
        this.codeElement.text(this.orderId); // 显示订单ID作为口令

        this.step1.hide();
        this.step2.show();

        this.statusElement.text('请在付款后，点击下方“我已付款”按钮开始确认。');
        this.confirmPaymentButton.show().prop('disabled', false).text('我已付款');
        this.waitMessage.hide();
      } catch (error) {
        console.error('充值初始化失败:', error);
        toastr.error(`获取支付信息失败: ${error.message}`);
        this.tierButtons.prop('disabled', false);
      }
    },

    // 步骤2: 用户点击“我已付款”后，通知服务器并开始轮询
    async confirmUserPaymentAndStartPolling() {
      if (!this.orderId) {
        toastr.error('无订单信息，请返回重试。');
        return;
      }

      this.confirmPaymentButton.prop('disabled', true).text('正在提交...');
      toastr.info('正在提交您的付款确认...');

      try {
        // 先通知服务器用户已付款
        const confirmResponse = await fetch(`${PAYMENT_SERVER_URL}/api/user-confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: this.orderId }),
        });

        if (!confirmResponse.ok) {
          const errData = await confirmResponse.json();
          throw new Error(errData.message || '提交确认失败。');
        }

        // 提交成功后，更新UI并开始轮询
        this.confirmPaymentButton.hide();
        this.waitMessage.show();
        this.statusElement.html(
          '<b>正在等待管理员审核...</b><br><br>由于存在离线补偿机制，您可以随时关闭此页面。<br>充值成功后，调用次数会自动到账。',
        );

        this.pollInterval = setInterval(() => this.checkRechargeStatus(), 3000);
        this.checkRechargeStatus();
      } catch (error) {
        console.error('提交付款确认失败:', error);
        toastr.error(`操作失败: ${error.message}`);
        this.confirmPaymentButton.prop('disabled', false).text('我已付款');
      }
    },

    async checkRechargeStatus() {
      if (!this.orderId) return;

      try {
        const response = await fetch(`${PAYMENT_SERVER_URL}/api/order-status?orderId=${this.orderId}`);
        if (!response.ok) {
          console.warn('支付状态查询失败，将在下次轮询时重试。');
          return;
        }

        const data = await response.json();

        if (data.status === 'completed') {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
          this.removePendingOrder(this.orderId); // 核心：从待处理列表移除已完成的订单

          creditManager.add(data.credits, true); // 明确显示默认提示

          this.statusElement.text('充值成功！2秒后自动返回...').css('color', '#4CAF50');

          setTimeout(() => {
            this.hidePage();
          }, 2000);
        }
      } catch (error) {
        console.error('轮询支付状态时发生网络错误:', error);
      }
    },

    async checkPendingOrders() {
      let pendingOrders = this.getPendingOrders();
      if (pendingOrders.length === 0) {
        return;
      }

      console.log(`[${extensionName}] 检测到 ${pendingOrders.length} 个待处理的支付订单，正在检查...`);

      let totalCompensatedCredits = 0;
      const maxFailures = 20; // 设置最大失败次数阈值
      let ordersModified = false;

      for (const order of pendingOrders) {
        const orderId = order.id;
        try {
          const response = await fetch(`${PAYMENT_SERVER_URL}/api/order-status?orderId=${orderId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.status === 'completed') {
              creditManager.add(data.credits, false);
              totalCompensatedCredits += data.credits;
              // 标记为待删除，而不是直接修改数组
              order.toDelete = true;
              ordersModified = true;
              console.log(`[${extensionName}] 订单 ${orderId} 已支付，成功补偿 ${data.credits} 次。`);
            }
            // 如果查询成功，重置失败计数器
            if (order.failures > 0) {
              order.failures = 0;
              ordersModified = true;
            }
          } else if (response.status === 404) {
            console.log(`[${extensionName}] 订单 ${orderId} 在服务器上未找到(404)，将从本地永久移除。`);
            order.toDelete = true;
            ordersModified = true;
          } else {
            // 其他HTTP错误（如500），增加失败计数
            order.failures++;
            ordersModified = true;
            console.warn(
              `[${extensionName}] 检查订单 ${orderId} 时服务器返回错误 ${response.status}。失败次数: ${order.failures}`,
            );
          }
        } catch (error) {
          // 网络错误，增加失败计数
          order.failures++;
          ordersModified = true;
          console.error(`[${extensionName}] 检查待处理订单 ${orderId} 时发生网络错误:`, error.message);
          console.warn(`[${extensionName}] 订单 ${orderId} 失败次数: ${order.failures}`);
        }

        // 检查是否达到最大失败次数
        if (order.failures >= maxFailures) {
          console.warn(
            `[${extensionName}] 订单 ${orderId} 已达到最大失败次数 (${maxFailures})，将从本地移除以防垃圾信息。`,
          );
          order.toDelete = true;
          ordersModified = true;
        }
      }

      // 统一处理本地存储的更新
      if (ordersModified) {
        let updatedOrders = pendingOrders.filter(order => !order.toDelete);
        // 清理掉临时的 toDelete 属性
        updatedOrders.forEach(order => delete order.toDelete);
        localStorage.setItem(this.pendingOrdersKey, JSON.stringify(updatedOrders));
      }

      if (totalCompensatedCredits > 0) {
        toastr.success(
          `欢迎回来！检测到您有已支付的订单，已成功为您补充 ${totalCompensatedCredits} 次调用次数。`,
          '充值补偿成功',
        );
      }
    },
  };

  // 运行初始化
  try {
    tavernHelperApi = await waitForTavernHelper();
    await initializeExtension();
    console.log(`[${extensionName}] 扩展已成功加载并重构。`);
  } catch (error) {
    console.error(`[${extensionName}] 扩展初始化失败:`, error);
    if (toastr) {
      toastr.error(`扩展 '${extensionName}' 初始化失败: ${error.message}`);
    } else {
      alert(`扩展 '${extensionName}' 初始化失败: ${error.message}`);
    }
  }
});
