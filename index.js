// 使用 jQuery 确保在 DOM 加载完毕后执行我们的代码
jQuery(async () => {
    // -----------------------------------------------------------------
    // 1. 定义常量和状态变量
    // -----------------------------------------------------------------
    const extensionName = 'world-book-generator';
    const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
    let tavernHelperApi; // 存储 TavernHelper API

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

    // 用于存储从外部JSON文件加载的数据的全局变量
    let worldElementPool = {};
    let detailElementPool = {};
    let plotElementPool = {};
    let femalePlotElementPool = {};
    let mechanicsElementPool = {};

    /**
     * 异步加载所有外部数据池。
     * @returns {Promise<void>}
     */
    async function loadAllDataPools() {
        try {
            const pools = [
                { name: 'worldElementPool', path: 'data/world_elements.json' },
                {
                    name: 'detailElementPool',
                    path: 'data/detail_elements.json',
                },
                { name: 'plotElementPool', path: 'data/plot_elements.json' },
                {
                    name: 'femalePlotElementPool',
                    path: 'data/female_plot_elements.json',
                },
                {
                    name: 'mechanicsElementPool',
                    path: 'data/mechanics_elements.json',
                },
            ];

            const responses = await Promise.all(
                pools.map((pool) =>
                    fetch(`/${extensionFolderPath}/${pool.path}`),
                ),
            );

            for (const response of responses) {
                if (!response.ok) {
                    throw new Error(
                        `HTTP error! status: ${response.status} for ${response.url}`,
                    );
                }
            }

            const data = await Promise.all(responses.map((res) => res.json()));

            worldElementPool = data[0];
            detailElementPool = data[1];
            plotElementPool = data[2];
            femalePlotElementPool = data[3];
            mechanicsElementPool = data[4];

            console.log('世界书生成器：所有数据池已成功加载。');
        } catch (error) {
            console.error('世界书生成器：加载数据池失败！', error);
            if (window.toastr) {
                toastr.error(
                    '加载核心数据失败，请检查控制台获取更多信息。',
                    '错误',
                );
            }
        }
    }

    /**
     * 新的、简化的更新检查器类
     */
    class WBGUpdater {
        constructor() {
            this.owner = '1830488003';
            this.repo = 'world-book-generator';
            this.currentVersion = '';
            this.latestVersion = '';
            this.storageKey = 'wbg_auto_update_enabled';

            this.elements = {
                versionDisplay: null,
                checkButton: null,
                autoUpdateToggle: null,
            };
        }

        async init() {
            // 总是尝试获取UI元素，无论在哪个页面
            this.elements.versionDisplay = document.getElementById(
                'wbg-current-version',
            );
            this.elements.checkButton = document.getElementById(
                'wbg-check-update-button',
            );
            this.elements.autoUpdateToggle = document.getElementById(
                'wbg-auto-update-toggle',
            );

            // 加载本地版本号并显示
            await this.loadManifest();

            // 仅在设置页面绑定事件和加载设置
            if (this.elements.checkButton && this.elements.autoUpdateToggle) {
                this.setupEventListeners();
                this.loadSettings();
                if (this.elements.autoUpdateToggle.checked) {
                    this.checkForUpdates(false); // 页面加载时静默检查
                }
            } else {
                // 如果不在设置页面，但开启了自动更新，则静默检查
                const autoUpdateEnabled =
                    localStorage.getItem(this.storageKey) !== 'false';
                if (autoUpdateEnabled) {
                    this.checkForUpdates(false);
                }
            }
        }

        async loadManifest() {
            try {
                const response = await fetch(
                    `/${extensionFolderPath}/manifest.json?v=${new Date().getTime()}`,
                );
                const manifest = await response.json();
                this.currentVersion = manifest.version;
                // 修正：直接使用获取到的元素，而不是依赖 this.elements
                const versionDisplay = document.getElementById(
                    'wbg-current-version',
                );
                if (versionDisplay) {
                    versionDisplay.textContent = `v${this.currentVersion}`;
                }
            } catch (error) {
                console.error('WBGUpdater: 加载 manifest.json 失败', error);
                const versionDisplay = document.getElementById(
                    'wbg-current-version',
                );
                if (versionDisplay) {
                    versionDisplay.textContent = '错误';
                }
            }
        }

        setupEventListeners() {
            this.elements.checkButton.addEventListener('click', () =>
                this.checkForUpdates(true),
            );
            this.elements.autoUpdateToggle.addEventListener(
                'change',
                (event) => {
                    localStorage.setItem(this.storageKey, event.target.checked);
                    toastr.info(
                        `自动检查更新已${event.target.checked ? '开启' : '关闭'}`,
                    );
                },
            );
        }

        loadSettings() {
            const autoUpdateEnabled = localStorage.getItem(this.storageKey);
            this.elements.autoUpdateToggle.checked =
                autoUpdateEnabled !== 'false';
        }

        async checkForUpdates(manual = false) {
            if (manual) {
                toastr.info('正在检查更新...');
                this.elements.checkButton.disabled = true;
                this.elements.checkButton.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i> 检查中...';
            }
            try {
                // Fetch remote manifest from raw.githubusercontent.com
                const response = await fetch(
                    `https://raw.githubusercontent.com/${this.owner}/${
                        this.repo
                    }/main/manifest.json?v=${new Date().getTime()}`,
                );
                if (!response.ok) {
                    throw new Error(
                        `从 Github 获取 manifest 失败: ${response.statusText}`,
                    );
                }
                const remoteManifest = await response.json();
                this.latestVersion = remoteManifest.version;

                console.log(
                    `[${extensionName}] 当前版本: ${this.currentVersion}, 最新版本: ${this.latestVersion}`,
                );

                if (
                    this.compareVersions(
                        this.latestVersion,
                        this.currentVersion,
                    ) > 0
                ) {
                    const releaseUrl = `https://github.com/${this.owner}/${this.repo}/`;
                    toastr.success(
                        `发现新版本 v${this.latestVersion}！点击这里前往Github仓库页面。`,
                        '更新提示',
                        {
                            onclick: () => window.open(releaseUrl, '_blank'),
                            timeOut: 0, // 永不自动消失
                            extendedTimeOut: 0, // 鼠标悬停时也永不消失
                        },
                    );
                } else if (manual) {
                    toastr.success('您当前使用的是最新版本。');
                }
            } catch (error) {
                console.error('WBGUpdater: 检查更新失败', error);
                if (manual) {
                    toastr.error(
                        `检查更新失败: ${error.message}。请稍后再试或查看浏览器控制台获取更多信息。`,
                    );
                }
            } finally {
                if (manual) {
                    this.elements.checkButton.disabled = false;
                    this.elements.checkButton.innerHTML =
                        '<i class="fa-solid fa-cloud-arrow-down"></i> 检查更新';
                }
            }
        }

        compareVersions(v1, v2) {
            const parts1 = v1.split('.').map(Number);
            const parts2 = v2.split('.').map(Number);
            const len = Math.max(parts1.length, parts2.length);
            for (let i = 0; i < len; i++) {
                const p1 = parts1[i] || 0;
                const p2 = parts2[i] || 0;
                if (p1 > p2) return 1;
                if (p1 < p2) return -1;
            }
            return 0;
        }
    }

    // -----------------------------------------------------------------
    // 2. SillyTavern API 封装
    // -----------------------------------------------------------------
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    async function waitForTavernHelper(retries = 20, interval = 500) {
        for (let i = 0; i < retries; i++) {
            if (
                window.TavernHelper &&
                typeof window.TavernHelper.getLorebooks === 'function' &&
                window.toastr
            ) {
                console.log(
                    `[${extensionName}] TavernHelper API and Toastr are available.`,
                );
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
        const bookExists = (await tavernHelperApi.getLorebooks()).includes(
            bookName,
        );
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
                jsonString = jsonString.substring(
                    firstBracket,
                    lastBracket + 1,
                );
            }
        }
        jsonString = jsonString.trim();

        // 2. "治愈"JSON：通过正则表达式查找所有 "content": "..." 结构
        // 并仅在其内部的字符串值中，将未转义的换行符和回车符替换为转义形式
        const healedJsonString = jsonString.replace(
            /"content":\s*"((?:[^"\\]|\\.)*)"/g,
            (match, contentValue) => {
                // 对捕获到的 content 字符串值进行处理
                const escapedContent = contentValue
                    .replace(/\n/g, '\\n') // 转义换行符
                    .replace(/\r/g, '\\r'); // 转义回车符
                // 重构 "content": "..." 部分
                return `"content": "${escapedContent}"`;
            },
        );

        return healedJsonString;
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

    // 新增：使元素可拖动的函数
    function makeDraggable(element) {
        let isDragging = false;
        let offsetX, offsetY;
        // 用于区分点击和拖拽的标志
        // mousedown后，如果mousemove移动了超过一个阈值，就判定为拖拽
        let dragThreshold = 5;
        let startX, startY;

        element.on('mousedown', function (e) {
            isDragging = false; // 重置拖拽状态
            startX = e.clientX;
            startY = e.clientY;

            // 确保使用的是 left/top 定位
            if (!this.style.left || !this.style.top) {
                const rect = this.getBoundingClientRect();
                this.style.left = `${rect.left}px`;
                this.style.top = `${rect.top}px`;
                this.style.right = ''; // 清除 right/bottom
                this.style.bottom = '';
            }

            offsetX = e.clientX - this.getBoundingClientRect().left;
            offsetY = e.clientY - this.getBoundingClientRect().top;

            // 绑定移动和松开事件到 document
            $(document).on('mousemove.wbg-drag', function (moveEvent) {
                // 检查是否超过拖拽阈值
                if (
                    !isDragging &&
                    (Math.abs(moveEvent.clientX - startX) > dragThreshold ||
                        Math.abs(moveEvent.clientY - startY) > dragThreshold)
                ) {
                    isDragging = true;
                    element.css('cursor', 'grabbing');
                }

                if (isDragging) {
                    let newX = moveEvent.clientX - offsetX;
                    let newY = moveEvent.clientY - offsetY;

                    // 限制在视窗内移动
                    const viewportWidth = $(window).width();
                    const viewportHeight = $(window).height();
                    const elementWidth = element.outerWidth();
                    const elementHeight = element.outerHeight();

                    newX = Math.max(
                        0,
                        Math.min(newX, viewportWidth - elementWidth),
                    );
                    newY = Math.max(
                        0,
                        Math.min(newY, viewportHeight - elementHeight),
                    );

                    element.css({
                        top: newY + 'px',
                        left: newX + 'px',
                    });
                }
            });

            $(document).on('mouseup.wbg-drag', function () {
                // 解绑事件
                $(document).off('mousemove.wbg-drag');
                $(document).off('mouseup.wbg-drag');
                if (isDragging) {
                    element.css('cursor', 'grab');
                }
            });

            // 阻止默认行为，如文本选择
            e.preventDefault();
        });

        // 返回一个函数，用于在 click 事件中检查是否发生了拖拽
        return {
            wasDragged: () => isDragging,
        };
    }

    function populateAdvancedOptions() {
        const container = $('#advanced-options-content');
        container.empty();
        for (const category in worldElementPool) {
            const subcategories = worldElementPool[category];
            for (const subcategory in subcategories) {
                const options = subcategories[subcategory];
                const selectId = `adv-opt-${category}-${subcategory}`.replace(
                    /\s/g,
                    '-',
                );
                let selectHtml = `<div class="advanced-option-item"><label for="${selectId}">${subcategory}:</label><select id="${selectId}" data-category="${subcategory}"><option value="">(AI自由发挥)</option>`;
                options.forEach((option) => {
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
            const randomIndex =
                Math.floor(Math.random() * (options.length - 1)) + 1;
            $(this).prop('selectedIndex', randomIndex);
        });
        toastr.info('已为所有高级设定随机选择完毕！');
    }

    function populatePlotOptions(channel = 'male') {
        const container = $('#plot-options-content');
        const pool =
            channel === 'female' ? femalePlotElementPool : plotElementPool;
        container.empty();
        for (const category in pool) {
            const subcategories = pool[category];
            for (const subcategory in subcategories) {
                const options = subcategories[subcategory];
                const selectId = `plot-opt-${category}-${subcategory}`.replace(
                    /\s/g,
                    '-',
                );
                let selectHtml = `<div class="advanced-option-item"><label for="${selectId}">${subcategory}:</label><select id="${selectId}" data-category="${subcategory}"><option value="">(AI自由发挥)</option>`;
                options.forEach((option) => {
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
            const randomIndex =
                Math.floor(Math.random() * (options.length - 1)) + 1;
            $(this).prop('selectedIndex', randomIndex);
        });
        toastr.info('已为当前频道的剧情设定随机选择完毕！');
    }

    function populateDetailOptions() {
        const container = $('#detail-options-content');
        container.empty();
        for (const category in detailElementPool) {
            const subcategories = detailElementPool[category];
            for (const subcategory in subcategories) {
                const options = subcategories[subcategory];
                const selectId =
                    `detail-opt-${category}-${subcategory}`.replace(/\s/g, '-');
                let selectHtml = `<div class="advanced-option-item"><label for="${selectId}">${subcategory}:</label><select id="${selectId}" data-category="${subcategory}"><option value="">(AI自由发挥)</option>`;
                options.forEach((option) => {
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
            const randomIndex =
                Math.floor(Math.random() * (options.length - 1)) + 1;
            $(this).prop('selectedIndex', randomIndex);
        });
        toastr.info('已为所有细节深化选项随机选择完毕！');
    }

    function populateMechanicsOptions() {
        const container = $('#mechanics-options-content');
        container.empty();
        for (const category in mechanicsElementPool) {
            const subcategories = mechanicsElementPool[category];
            for (const subcategory in subcategories) {
                const options = subcategories[subcategory];
                const selectId = `mech-opt-${category}-${subcategory}`.replace(
                    /\s/g,
                    '-',
                );
                let selectHtml = `<div class="advanced-option-item"><label for="${selectId}">${subcategory}:</label><select id="${selectId}" data-category="${subcategory}"><option value="">(AI自由发挥)</option>`;
                options.forEach((option) => {
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
            const randomIndex =
                Math.floor(Math.random() * (options.length - 1)) + 1;
            $(this).prop('selectedIndex', randomIndex);
        });
        toastr.info('已为所有游戏机制选项随机选择完毕！');
    }

    // -----------------------------------------------------------------
    // 4. 核心逻辑
    // -----------------------------------------------------------------
    async function handleGenerateFoundation() {
        const bookName = $('#bookName').val().trim();
        if (!bookName) {
            toastr.warning('在开始前，请为你的世界命名！');
            return;
        }
        projectState.bookName = bookName;
        localStorage.setItem('wbg_lastBookName', bookName);

        const coreTheme = $('#coreTheme').val().trim();
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
        $('#aiResponseTextArea').val('AI正在思考...');

        try {
            const [unrestrictPrompt, writingGuide, promptTemplate] =
                await Promise.all([
                    $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
                    $.get(`${extensionFolderPath}/writing-guide.txt`),
                    $.get(`${extensionFolderPath}/generator-prompt.txt`),
                ]);
            const combinedPromptTemplate = `${unrestrictPrompt}\n\n${writingGuide}\n\n${promptTemplate}`;
            let finalPrompt = combinedPromptTemplate
                .replace(/{{bookName}}/g, bookName)
                .replace(/{{advancedOptions}}/g, advancedOptionsString || '无')
                .replace(/{{coreTheme}}/g, coreTheme || '无');

            console.log(
                `[${extensionName}] Final prompt for Foundation:`,
                finalPrompt,
            );
            const rawAiResponse = await tavernHelperApi.generateRaw({
                ordered_prompts: [{ role: 'user', content: finalPrompt }],
                max_new_tokens: 8192,
            });

            projectState.generatedContent = rawAiResponse;
            $('#aiResponseTextArea').val(rawAiResponse);
            $('#uploadFoundationButton').prop('disabled', false);
            toastr.success('AI已生成回复，请检查内容后决定是否上传。');
        } catch (error) {
            console.error(`[${extensionName}] 生成世界基石失败:`, error);
            $('#aiResponseTextArea').val(`生成失败: ${error.message}`);
            toastr.error(`操作失败: ${error.message}`);
        } finally {
            $('#generateFoundationButton')
                .prop('disabled', false)
                .text('生成/补充内容');
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
            if (!Array.isArray(newGeneratedEntries))
                throw new Error('AI返回的数据解析后不是一个JSON数组。');

            await createLorebook(bookName);
            for (const entry of newGeneratedEntries) {
                const sanitizedEntry = sanitizeEntry(entry);
                await createLorebookEntry(bookName, sanitizedEntry);
            }

            toastr.success(
                `成功上传 ${newGeneratedEntries.length} 个新条目到世界书 '${bookName}'！`,
            );
            $('#aiResponseTextArea').val(
                '上传成功！您可以继续补充内容，或通过上方按钮切换到下一阶段。',
            );
            // setActiveStage(2); // 根据用户要求，禁用自动跳转
        } catch (error) {
            console.error(`[${extensionName}] 上传世界内容失败:`, error);
            toastr.error(`上传失败: ${error.message}`);
        } finally {
            $('#uploadFoundationButton')
                .prop('disabled', false)
                .text('上传至世界书');
        }
    }

    async function handleGenerateOutline() {
        const bookName = projectState.bookName;
        if (!bookName) {
            toastr.error('项目状态丢失，请返回第一步重新开始。');
            return;
        }

        const plotElements = $('#plotElements').val().trim();
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
            const [
                unrestrictPrompt,
                writingGuide,
                promptTemplate,
                currentEntries,
            ] = await Promise.all([
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

            console.log(
                `[${extensionName}] Final prompt for Outline:`,
                finalPrompt,
            );
            const rawAiResponse = await tavernHelperApi.generateRaw({
                ordered_prompts: [{ role: 'user', content: finalPrompt }],
                max_new_tokens: 8192,
            });

            projectState.generatedOutlineContent = rawAiResponse;
            $('#aiResponseTextArea-stage2').val(rawAiResponse);
            $('#uploadOutlineButton').prop('disabled', false);
            toastr.success('AI已生成剧情大纲，请检查后决定是否上传。');
        } catch (error) {
            console.error(`[${extensionName}] 生成剧情大纲失败:`, error);
            $('#aiResponseTextArea-stage2').val(`生成失败: ${error.message}`);
            toastr.error(`操作失败: ${error.message}`);
        } finally {
            $('#generateOutlineButton')
                .prop('disabled', false)
                .text('生成/补充剧情');
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
            if (!Array.isArray(newGeneratedEntries))
                throw new Error('AI返回的数据解析后不是一个JSON数组。');

            for (const entry of newGeneratedEntries) {
                const sanitizedEntry = sanitizeEntry(entry);
                await createLorebookEntry(bookName, sanitizedEntry);
            }

            toastr.success(
                `成功将 ${newGeneratedEntries.length} 个剧情条目添加到世界书 '${bookName}'！`,
            );
            $('#aiResponseTextArea-stage2').val(
                '上传成功！您可以继续补充剧情，或通过上方按钮切换到下一阶段。',
            );
            // setActiveStage(3); // 根据用户要求，禁用自动跳转
        } catch (error) {
            console.error(`[${extensionName}] 上传剧情内容失败:`, error);
            toastr.error(`上传失败: ${error.message}`);
        } finally {
            $('#uploadOutlineButton')
                .prop('disabled', false)
                .text('上传至世界书');
        }
    }

    async function handleGenerateDetail() {
        const bookName = projectState.bookName;
        if (!bookName) {
            toastr.error('项目状态丢失，请返回第一步重新开始。');
            return;
        }

        const detailElements = $('#detailElements').val().trim();
        let detailOptionsString = '';
        $('#detail-options-content select').each(function () {
            const selectedValue = $(this).val();
            if (selectedValue) {
                const categoryName = $(this).data('category');
                detailOptionsString += `- ${categoryName}: ${selectedValue}\\n`;
            }
        });

        if (!detailOptionsString && !detailElements) {
            toastr.warning(
                '请至少选择一个“细节深化”选项或输入一些“核心主题”！',
            );
            return;
        }

        toastr.info('正在获取现有世界观并注入思想钢印，请稍候...');
        $('#generateDetailButton').prop('disabled', true).text('生成中...');
        $('#uploadDetailButton').prop('disabled', true);
        $('#aiResponseTextArea-stage3').val('AI正在思考...');

        try {
            const [
                unrestrictPrompt,
                writingGuide,
                promptTemplate,
                currentEntries,
            ] = await Promise.all([
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

            console.log(
                `[${extensionName}] Final prompt for Detail:`,
                finalPrompt,
            );
            const rawAiResponse = await tavernHelperApi.generateRaw({
                ordered_prompts: [{ role: 'user', content: finalPrompt }],
                max_new_tokens: 8192,
            });

            projectState.generatedDetailContent = rawAiResponse;
            $('#aiResponseTextArea-stage3').val(rawAiResponse);
            $('#uploadDetailButton').prop('disabled', false);
            toastr.success('AI已生成细节内容，请检查后决定是否上传。');
        } catch (error) {
            console.error(`[${extensionName}] 生成细节内容失败:`, error);
            $('#aiResponseTextArea-stage3').val(`生成失败: ${error.message}`);
            toastr.error(`操作失败: ${error.message}`);
        } finally {
            $('#generateDetailButton')
                .prop('disabled', false)
                .text('生成/补充细节');
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
            if (!Array.isArray(newGeneratedEntries))
                throw new Error('AI返回的数据解析后不是一个JSON数组。');

            for (const entry of newGeneratedEntries) {
                const sanitizedEntry = sanitizeEntry(entry);
                await createLorebookEntry(bookName, sanitizedEntry);
            }

            toastr.success(
                `成功将 ${newGeneratedEntries.length} 个细节条目添加到世界书 '${bookName}'！`,
            );
            $('#aiResponseTextArea-stage3').val(
                '上传成功！您可以继续补充细节，或通过上方按钮切换到下一阶段。',
            );
            // setActiveStage(4); // 根据用户要求，禁用自动跳转
        } catch (error) {
            console.error(`[${extensionName}] 上传细节内容失败:`, error);
            toastr.error(`上传失败: ${error.message}`);
        } finally {
            $('#uploadDetailButton')
                .prop('disabled', false)
                .text('上传至世界书');
        }
    }

    async function handleGenerateMechanics() {
        const bookName = projectState.bookName;
        if (!bookName) {
            toastr.error('项目状态丢失，请返回第一步重新开始。');
            return;
        }

        const mechanicsElements = $('#mechanicsElements').val().trim();
        let mechanicsOptionsString = '';
        $('#mechanics-options-content select').each(function () {
            const selectedValue = $(this).val();
            if (selectedValue) {
                const categoryName = $(this).data('category');
                mechanicsOptionsString += `- ${categoryName}: ${selectedValue}\\n`;
            }
        });

        if (!mechanicsOptionsString && !mechanicsElements) {
            toastr.warning(
                '请至少选择一个“游戏机制”选项或输入一些“核心主题”！',
            );
            return;
        }

        toastr.info('正在获取现有世界观并注入思想钢印，请稍候...');
        $('#generateMechanicsButton').prop('disabled', true).text('生成中...');
        $('#uploadMechanicsButton').prop('disabled', true);
        $('#aiResponseTextArea-stage4').val('AI正在思考...');

        try {
            const [
                unrestrictPrompt,
                writingGuide,
                promptTemplate,
                currentEntries,
            ] = await Promise.all([
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
                .replace(
                    /{{mechanicsOptions}}/g,
                    mechanicsOptionsString || '无',
                );

            console.log(
                `[${extensionName}] Final prompt for Mechanics:`,
                finalPrompt,
            );
            const rawAiResponse = await tavernHelperApi.generateRaw({
                ordered_prompts: [{ role: 'user', content: finalPrompt }],
                max_new_tokens: 8192,
            });

            projectState.generatedMechanicsContent = rawAiResponse;
            $('#aiResponseTextArea-stage4').val(rawAiResponse);
            $('#uploadMechanicsButton').prop('disabled', false);
            toastr.success('AI已生成游戏机制，请检查后决定是否上传。');
        } catch (error) {
            console.error(`[${extensionName}] 生成游戏机制失败:`, error);
            $('#aiResponseTextArea-stage4').val(`生成失败: ${error.message}`);
            toastr.error(`操作失败: ${error.message}`);
        } finally {
            $('#generateMechanicsButton')
                .prop('disabled', false)
                .text('设计/补充机制');
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
            if (!Array.isArray(newGeneratedEntries))
                throw new Error('AI返回的数据解析后不是一个JSON数组。');

            for (const entry of newGeneratedEntries) {
                const sanitizedEntry = sanitizeEntry(entry);
                await createLorebookEntry(bookName, sanitizedEntry);
            }

            toastr.success(
                `成功将 ${newGeneratedEntries.length} 个游戏机制条目添加到世界书 '${bookName}'！`,
            );
            $('#aiResponseTextArea-stage4').val(
                '上传成功！您的世界书已基本完成！',
            );
        } catch (error) {
            console.error(`[${extensionName}] 上传游戏机制失败:`, error);
            toastr.error(`上传失败: ${error.message}`);
        } finally {
            $('#uploadMechanicsButton')
                .prop('disabled', false)
                .text('上传至世界书');
        }
    }

    // -----------------------------------------------------------------
    // 5. 欢迎页面与初始化流程
    // -----------------------------------------------------------------
    async function populateBooksDropdown() {
        try {
            const books = await getLorebooks();
            const dropdown = $('#existingBooksDropdown');
            dropdown
                .empty()
                .append('<option value="">选择一个已有的世界书...</option>');
            books.forEach((book) =>
                dropdown.append($('<option></option>').val(book).text(book)),
            );
        } catch (error) {
            console.error(
                `[${extensionName}] Failed to populate lorebooks dropdown:`,
                error,
            );
            toastr.error('无法加载世界书列表。');
        }
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
        setActiveStage(1);
    }

    function handleStartAuto() {
        // 如果上次的任务已完成，重置状态以开始新任务
        if (autoGenState.isFinished) {
            Object.assign(autoGenState, {
                isRunning: false,
                bookName: '',
                coreTheme: '',
                progress: [],
                isFinished: false,
                error: null,
            });
            // 清理UI
            $('#autoBookName').val('').prop('disabled', false);
            $('#autoCoreTheme').val('').prop('disabled', false);
            $('#auto-gen-status-list').empty();
            $('#auto-gen-status').hide();
        }

        $('#wbg-landing-page').hide();
        $('#wbg-generator-page').hide();
        $('#wbg-auto-generator-page').show();
    }

    // 新的UI渲染函数：根据autoGenState渲染进度
    function renderAutoGenProgress() {
        if (!$('#wbg-auto-generator-page').is(':visible')) {
            return; // 如果页面不可见，不执行渲染
        }

        const statusList = $('#auto-gen-status-list');
        statusList.empty();

        const successIcon =
            '<i class="fa-solid fa-check-circle" style="color: #4CAF50;"></i>';
        const spinnerIcon = '<i class="fas fa-spinner fa-spin"></i>';
        const errorIcon =
            '<i class="fa-solid fa-times-circle" style="color: #F44336;"></i>';

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
            $('#runAutoGenerationButton')
                .prop('disabled', true)
                .text('正在全速生成中...');
            $('#autoBookName').val(autoGenState.bookName).prop('disabled', true);
            $('#autoCoreTheme')
                .val(autoGenState.coreTheme)
                .prop('disabled', true);
        } else {
            $('#runAutoGenerationButton')
                .prop('disabled', false)
                .text('开始全自动生成');
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
        try {
            const bookName = autoGenState.bookName;
            // 0. 创建世界书
            await createLorebook(bookName);
            projectState.bookName = bookName;
            localStorage.setItem('wbg_lastBookName', bookName);
            updateAutoGenStatus(`已创建世界书 '${bookName}'`);

            // 1. 任务拆解
            updateAutoGenStatus('正在请求“盘古”AI拆解核心任务...');
            const decomposerTemplate = await $.get(
                `${extensionFolderPath}/auto-generator-decomposer-prompt.txt`,
            );
            const decomposerPrompt = decomposerTemplate.replace(
                '{{core_theme}}',
                autoGenState.coreTheme,
            );

            const decomposerResponse = await tavernHelperApi.generateRaw({
                ordered_prompts: [{ role: 'user', content: decomposerPrompt }],
                max_new_tokens: 2048,
            });

            const cleanedDecomposerJson =
                extractAndCleanJson(decomposerResponse);
            const instructions = JSON.parse(cleanedDecomposerJson);
            if (!instructions.stage1_instruction) {
                throw new Error(
                    '任务拆解失败，AI未返回有效的指令结构。请检查AI后端或提示词。',
                );
            }
            updateAutoGenStatus('任务拆解成功！');

            // 加载通用提示词
            const [unrestrictPrompt, writingGuide] = await Promise.all([
                $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
                $.get(`${extensionFolderPath}/writing-guide.txt`),
            ]);
            const basePrompt = `${unrestrictPrompt}\n\n${writingGuide}\n\n`;

            // 2. 执行阶段一
            updateAutoGenStatus('开始执行第一阶段：世界基石生成...');
            const stage1Template = await $.get(
                `${extensionFolderPath}/generator-prompt.txt`,
            );
            const stage1FinalPrompt = (basePrompt + stage1Template)
                .replace(/{{bookName}}/g, bookName)
                .replace(/{{advancedOptions}}/g, '无')
                .replace(/{{coreTheme}}/g, instructions.stage1_instruction);

            const stage1Response = await tavernHelperApi.generateRaw({
                ordered_prompts: [
                    { role: 'user', content: stage1FinalPrompt },
                ],
                max_new_tokens: 8192,
            });
            const stage1Entries = JSON.parse(
                extractAndCleanJson(stage1Response),
            );
            for (const entry of stage1Entries) {
                await createLorebookEntry(bookName, sanitizeEntry(entry));
            }
            updateAutoGenStatus(
                `第一阶段完成，生成了 ${stage1Entries.length} 个条目`,
            );

            // 3. 执行阶段二
            updateAutoGenStatus('开始执行第二阶段：剧情构思...');
            const stage2Template = await $.get(
                `${extensionFolderPath}/story-prompt.txt`,
            );
            const currentEntriesS2 = await getLorebookEntries(bookName);
            const stage2FinalPrompt = (basePrompt + stage2Template)
                .replace(
                    /{{world_book_entries}}/g,
                    JSON.stringify(currentEntriesS2, null, 2),
                )
                .replace(
                    /{{plot_elements}}/g,
                    instructions.stage2_instruction,
                )
                .replace(/{{plotOptions}}/g, '无');

            const stage2Response = await tavernHelperApi.generateRaw({
                ordered_prompts: [
                    { role: 'user', content: stage2FinalPrompt },
                ],
                max_new_tokens: 8192,
            });
            const stage2Entries = JSON.parse(
                extractAndCleanJson(stage2Response),
            );
            for (const entry of stage2Entries) {
                await createLorebookEntry(bookName, sanitizeEntry(entry));
            }
            updateAutoGenStatus(
                `第二阶段完成，生成了 ${stage2Entries.length} 个条目`,
            );

            // 4. 执行阶段三
            updateAutoGenStatus('开始执行第三阶段：细节填充...');
            const stage3Template = await $.get(
                `${extensionFolderPath}/detail-prompt.txt`,
            );
            const currentEntriesS3 = await getLorebookEntries(bookName);
            const stage3FinalPrompt = (basePrompt + stage3Template)
                .replace(
                    /{{world_book_entries}}/g,
                    JSON.stringify(currentEntriesS3, null, 2),
                )
                .replace(
                    /{{detail_elements}}/g,
                    instructions.stage3_instruction,
                )
                .replace(/{{detailOptions}}/g, '无');

            const stage3Response = await tavernHelperApi.generateRaw({
                ordered_prompts: [
                    { role: 'user', content: stage3FinalPrompt },
                ],
                max_new_tokens: 8192,
            });
            const stage3Entries = JSON.parse(
                extractAndCleanJson(stage3Response),
            );
            for (const entry of stage3Entries) {
                await createLorebookEntry(bookName, sanitizeEntry(entry));
            }
            updateAutoGenStatus(
                `第三阶段完成，生成了 ${stage3Entries.length} 个条目`,
            );

            // 5. 执行阶段四
            updateAutoGenStatus('开始执行第四阶段：机制设计...');
            const stage4Template = await $.get(
                `${extensionFolderPath}/mechanics-prompt.txt`,
            );
            const currentEntriesS4 = await getLorebookEntries(bookName);
            const stage4FinalPrompt = (basePrompt + stage4Template)
                .replace(
                    /{{world_book_entries}}/g,
                    JSON.stringify(currentEntriesS4, null, 2),
                )
                .replace(
                    /{{mechanics_elements}}/g,
                    instructions.stage4_instruction,
                )
                .replace(/{{mechanicsOptions}}/g, '无');

            const stage4Response = await tavernHelperApi.generateRaw({
                ordered_prompts: [
                    { role: 'user', content: stage4FinalPrompt },
                ],
                max_new_tokens: 8192,
            });
            const stage4Entries = JSON.parse(
                extractAndCleanJson(stage4Response),
            );
            for (const entry of stage4Entries) {
                await createLorebookEntry(bookName, sanitizeEntry(entry));
            }
            updateAutoGenStatus(
                `第四阶段完成，生成了 ${stage4Entries.length} 个条目`,
            );

            // 最终成功
            updateAutoGenStatus('恭喜！全自动生成流程已成功完成！');
            toastr.success(
                `世界书 '${bookName}' 已全自动生成完毕！`,
                '任务完成',
            );
            autoGenState.isFinished = true;
            autoGenState.isRunning = false;
            renderAutoGenProgress(); // Final render to update button state
        } catch (error) {
            const errorMessage = `错误: ${error.message}`;
            console.error(`[${extensionName}] 自动化生成失败:`, error);
            toastr.error(errorMessage, '自动化生成失败');
            updateAutoGenStatus(errorMessage); // This will set isRunning to false
        }
    }

    // 自动化生成的启动器
    function runAutomatedGeneration() {
        if (autoGenState.isRunning) {
            toastr.warning('一个自动化任务已经在后台运行。');
            return;
        }

        const bookName = $('#autoBookName').val().trim();
        const coreTheme = $('#autoCoreTheme').val().trim();

        if (!bookName || !coreTheme) {
            toastr.warning('请同时提供新世界书的名称和核心创作要求！');
            return;
        }

        // 重置并初始化状态
        Object.assign(autoGenState, {
            isRunning: true,
            bookName: bookName,
            coreTheme: coreTheme,
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

    async function handleContinue() {
        const selectedBook = $('#existingBooksDropdown').val();
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
            setActiveStage(stage);
            toastr.success(
                `已加载 '${selectedBook}'，您可以对任意阶段进行创作。`,
            );
        } catch (error) {
            console.error(
                `[${extensionName}] Failed to continue project:`,
                error,
            );
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
            $('#bookName').val(lastBookName).prop('disabled', true);
            $('#wbg-landing-page').hide();
            $('#wbg-generator-page').show();
            setActiveStage(stage);
            toastr.success(
                `已加载 '${lastBookName}'，您可以对任意阶段进行创作。`,
            );
            $('#wbg-popup-overlay').css('display', 'flex'); // 确保弹窗可见
        } catch (error) {
            console.error(
                `[${extensionName}] Failed to quick continue project:`,
                error,
            );
            toastr.error(`快速加载项目失败: ${error.message}`);
        }
    }

    async function initializeExtension() {
        $('head').append(
            `<link rel="stylesheet" type="text/css" href="${extensionFolderPath}/style.css?v=${Date.now()}">`,
        );
        try {
            // 在加载任何UI之前，首先加载所有外部数据
            await loadAllDataPools();

            const [settingsHtml, popupHtml] = await Promise.all([
                $.get(`${extensionFolderPath}/settings.html`),
                $.get(`${extensionFolderPath}/popup.html?v=${Date.now()}`),
            ]);
            $('#extensions_settings2').append(settingsHtml);
            $('body').append(popupHtml);

            // 在HTML加载后，初始化更新器
            const updater = new WBGUpdater();
            await updater.init();
        } catch (error) {
            console.error(
                `[${extensionName}] Failed to load HTML files.`,
                error,
            );
            return;
        }

        $('body').append(
            '<div id="wbg-floating-button" title="世界书生成器 (可拖动)"><i class="fa-solid fa-book-bookmark"></i></div>',
        );

        const fab = $('#wbg-floating-button');
        const draggable = makeDraggable(fab);

        fab.on('click', () => {
            // 如果是拖拽事件，则不执行点击逻辑
            if (draggable.wasDragged()) {
                return;
            }

            // 检查是否有后台任务正在运行或已完成
            if (
                autoGenState.isRunning ||
                (autoGenState.isFinished && autoGenState.progress.length > 0)
            ) {
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
                    $('#quickContinueButton')
                        .show()
                        .find('span')
                        .text(lastBookName);
                } else {
                    $('#quickContinueButton').hide();
                }
                $('#wbg-generator-page').hide();
                $('#wbg-auto-generator-page').hide();
                $('#wbg-landing-page').show();
                populateBooksDropdown();
            }

            $('#wbg-popup-overlay').css('display', 'flex');
        });

        // 修正：使用 .wbg-header .close-button 确保只选择页头内的关闭按钮
        $('#wbg-popup-close-button').on('click', () =>
            $('#wbg-popup-overlay').hide(),
        );

        $('#wbg-popup').on('click', (e) => e.stopPropagation());

        // 欢迎页面按钮
        $('#startNewButton').on('click', handleStartNew);
        $('#startAutoButton').on('click', handleStartAuto);
        $('#continueButton').on('click', handleContinue);
        $('#quickContinueButton').on('click', handleQuickContinue);

        // 自动化页面按钮
        $('#runAutoGenerationButton').on('click', runAutomatedGeneration);

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
            toastr.info(
                `已切换到 ${channel === 'male' ? '男频' : '女频'} 创作频道。`,
            );
        });

        // 阶段三按钮
        $('#randomizeDetailButton').on('click', handleRandomizeDetailOptions);
        $('#generateDetailButton').on('click', handleGenerateDetail);
        $('#uploadDetailButton').on('click', handleUploadDetail);

        // 阶段四按钮
        $('#randomizeMechanicsButton').on(
            'click',
            handleRandomizeMechanicsOptions,
        );
        $('#generateMechanicsButton').on('click', handleGenerateMechanics);
        $('#uploadMechanicsButton').on('click', handleUploadMechanics);

        // 初始化高级选项
        populateAdvancedOptions();
        populatePlotOptions();
        populateDetailOptions();
        populateMechanicsOptions();
    }

    // 运行初始化
    try {
        tavernHelperApi = await waitForTavernHelper();
        await initializeExtension();
        console.log(`[${extensionName}] 扩展已成功加载并重构。`);
    } catch (error) {
        console.error(`[${extensionName}] 扩展初始化失败:`, error);
        toastr.error(`扩展 '${extensionName}' 初始化失败: ${error.message}`);
    }
});
