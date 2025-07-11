// 使用 jQuery 确保在 DOM 加载完毕后执行我们的代码
jQuery(async () => {
    // -----------------------------------------------------------------
    // 1. 定义常量和状态变量
    // -----------------------------------------------------------------
    const extensionName = "world-book-generator";
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

    // 内置细节深化元素池
    const detailElementPool = {
        "人物传记": ["一位传奇英雄的生平", "一个臭名昭著的反派背景", "一位神秘中立角色的故事", "一个普通小人物的日记", "一位已故历史人物的追忆"],
        "地点描绘": ["一座繁华首都的深度游览", "一处危险禁地的详细介绍", "一个普通村庄的风土人情", "一座宏伟遗迹的探索报告", "一个异次元空间的景象"],
        "组织/势力": ["一个主导帝国的运作方式", "一个秘密结社的内部结构", "一个商业行会的贸易网络", "一个佣兵团体的历史与信条", "一个反抗组织的 manifesto"],
        "历史事件": ["一场决定世界格局的古代战争", "一次导致文明衰落的魔法灾难", "一个王朝的兴衰史", "一次重要的和平谈判", "一个改变世界的科学发现"],
        "文化风俗": ["一个主要种族的节庆与仪式", "特定地区的饮食文化", "世界的艺术与音乐风格", "婚姻与家庭观念", "独特的法律与道德准则"],
        "神秘生物/怪物": ["一种常见怪物的生态习性", "一只传说级神兽的背景故事", "一种危险植物的图鉴", "一个地区的怪物生态链", "一种人造构装体的设计图"],
        "神器/物品": ["一把传奇武器的锻造与传承", "一件拥有自我意识的魔法物品", "一种稀有材料的来源与用途", "一套古代套装的历史", "一件看似普通却有大用的物品"],
        "世界之谜": ["对一个古老预言的深度解读", "调查一桩悬而未决的历史谜案", "探索一个无法解释的自然现象", "关于世界起源的多种假说", "一个种族集体消失的秘密"],
        "日常生活": ["一个普通市民一天的生活", "贵族阶层的社交礼仪", "冒险者在酒馆的日常", "工匠的制作流程", "农民的耕作与收获"],
        "语言/文字": ["一种古代语言的语法结构", "符文魔法的释义", "不同种族间的通用语", "密码与暗号的体系", "诗歌与文学的风格"]
    };

    // 内置游戏机制元素池
    const mechanicsElementPool = {
        "魔法系统": ["基于元素亲和的施法规则", "消耗生命力或理智的禁术", "需要特定材料的仪式魔法", "基于语言或符文的咒语体系", "可组合的模块化魔法"],
        "科技体系": ["义体改造与排异反应规则", "蒸汽朋克机械的燃料与维护", "生物科技的基因编辑与突变风险", "AI与网络的交互规则", "能量武器的充能与过载"],
        "经济/贸易": ["主要货币与汇率体系", "稀有资源的产地与贸易路线", "主要商会与关税政策", "黑市与违禁品交易规则", "制作与修理物品的成本"],
        "声望/阵营": ["主要势力的声望等级与奖励", "提升或降低声望的行为准则", "敌对阵营的交互规则", "中立地区的法律与秩序", "个人荣誉与头衔系统"],
        "战斗/技能": ["基于耐力/行动点的回合制战斗", "物理/魔法/精神伤害类型与抗性", "暴击与失手（Fumble）规则", "组合技或特殊招式的触发条件", "潜行与暗杀的判定规则"],
        "生存/环境": ["饥饿/口渴/疲劳度的影响", "不同地形与天气的环境效果", "疾病与毒素的判定与治疗", "庇护所的建立与防御", "极端环境下的生存检定"],
        "制作/合成": ["基础的采矿/伐木/采药规则", "装备/药水/卷轴的制作配方", "物品的强化/附魔/镶嵌系统", "特殊材料的获取方式", "制作失败的可能性与后果"],
        "社交/说服": ["说服/威吓/欺骗的检定规则", "NPC的好感度系统与影响", "情报收集与流言传播机制", "谈判与交易的博弈规则", "谎言被揭穿的后果"],
        "解谜/探索": ["调查/侦查/陷阱拆除的判定", "古代符文或密码的解读", "地图与导航系统", "隐藏门或密室的发现", "与环境的互动规则"],
        "成长/升级": ["基于经验值的等级提升系统", "通过使用提升的技能熟练度系统", "学习新技能的条件（导师/技能书）", "属性点的分配与加成", "转职或进阶的试炼"]
    };

    // 内-置世界设定元素池
    const worldElementPool = {
        "宏观环境设定": {
            "宇宙形态": ["球状", "平面", "分层", "环状", "虚拟模拟", "坍缩中"],
            "世界运作机制": ["魔法驱动", "科技驱动", "神祇意志主导", "自洽物理规律", "随机生成", "群体生物意志驱动"],
            "维度状态": ["单一维度", "多重维度", "重叠维度", "残缺维度", "维度破碎，交错频繁"],
            "时间特性": ["线性不可逆", "可循环碎片", "区域流速差异", "因果律薄弱区"],
            "法则稳定性": ["恒定不变", "周期性潮汐", "崩坏临界态"]
        },
        "技术或神秘体系": {
            "魔法体系": ["规则型（严密公式）", "混沌型（随机、失控）", "献祭型（必须付出代价）", "元素亲和型"],
            "科技体系": ["赛博科技", "蒸汽工业", "生物科技", "克苏鲁风（异质科技）", "反乌托邦式监控科技"],
            "能源类型": ["灵魂驱动", "数据驱动", "梦境燃料", "生物能量/生命能量", "虫群聚合能源"],
            "知识载体": ["基因刻印", "神经植入体", "活体寄生虫", "可交易记忆晶体"],
            "体系冲突": ["魔法科技互斥", "生物-克苏鲁畸变融合", "数据魔法杂交"]
        },
        "主导范式": {
            "主导范式": ["理性/工具范式", "生物/群体意识范式", "虫族模型", "菌类共生体", "寄生智能体", "器官世界", "生态优先文明", "思维交融体", "精神/意识范式", "语言/认知范式", "神学/命定范式", "混沌/随机范式", "腐败/腐蚀范式", "拼贴/模拟范式"],
            "核心资源定义": ["理性范式：数据", "精神范式：信仰浓度", "腐败范式：堕落能量", "生态范式：生命熵值"],
            "个体与集体关系": ["集体可拆卸零件", "超级个体幻觉", "强制意识上传"]
        },
        "政治/社会结构": {
            "主流政体": ["帝国制", "议会制", "帮派联盟", "无政府状态", "蜂群等级制"],
            "权力来源": ["血统继承", "武力支配", "信息操控", "神启预言", "演算法（算法治理）", "生物等级天赋"],
            "阶级构成": ["种族压迫体系", "职业分层社会", "灵魂等级社会", "机械与生物融合体系", "生物共生与寄生阶级"],
            "权力更迭方式": ["算力竞争", "群体意识投票", "神谕抽签", "器官移植继承"],
            "边缘组织": ["维度偷渡公社", "现实漏洞黑帮", "永生拒绝者隐修会"]
        },
        "文化与常识偏差": {
            "道德观念": ["杀戮为荣", "沉默为美德", "时间至上主义", "集体意志第一", "繁殖与扩张至上"],
            "社交规则": ["禁止直视上级", "必须用诗歌对话", "隐语与象征性沟通", "信息素交流"],
            "死亡观念": ["灵魂轮回", "生命重置", "附生机制", "永生诅咒惩罚", "个体死亡无意义，整体存续优先"],
            "艺术美学": ["熵增纹路崇拜", "个体独特性恐惧", "痛苦频率音乐"],
            "知识传承": ["梦境灌输", "情感献祭换智", "食脑继承记忆"]
        },
        "地理生态": {
            "地貌构成": ["漂浮岛链", "深渊裂谷", "巨型植物城市", "生物体构成的大陆"],
            "特殊生态法则": ["昼夜混乱", "气候受思想波动影响", "地形可编程", "生态平衡强制维持"],
            "异界交错": ["虫洞频发", "梦境渗透", "思维物理具现", "生物感知共享区"],
            "资源特性": ["迁徙性能源兽群", "噩梦深渊矿脉", "歌声唤醒水晶"],
            "极端环境适应": ["反重力器官", "集体冥想气象局", "情绪绝缘外壳"]
        },
        "特殊力场/异常点": {
            "诡异区域": ["理智消解场域", "语言失效区域", "重力逆转空间", "生物进化突变点"],
            "现实漏洞": ["世界设定的补丁位置，可用于触发事件", "生物共同记忆异常点"],
            "可利用性": ["武器化消解场域", "进化突变训练营", "时间农场"],
            "动态属性": ["移动型异常", "星象触发点", "寄生性空间瘤"]
        },
        "核心冲突/世界之谜": {
            "外部冲突": ["资源枯竭", "文明的谎言", "失落的遗产", "不可避免的预言", "外神入侵/模因污染", "轮回的诅咒"],
            "内部撕裂": ["统治层加速末日", "拯救派VS享乐派"],
            "存在危机": ["高等文明实验场", "虚拟牢狱论"]
        },
        "主导物种/族群构成": {
            "形态": ["碳基", "硅基", "能量体", "信息生命", "机械造物", "共生体集群"],
            "心智": ["个体心智", "蜂巢思维", "分布式意识", "无心智（纯粹本能驱动）"],
            "繁衍": ["二元性别", "无性分裂", "精神感孕", "寄生孵化", "机械复制"],
            "特殊族群": ["记忆吞噬者", "情绪寄生体", "次元漫游者", "基因盗火者"],
            "环境互动": ["硅基光合", "辐射吞噬", "器官定期更换"],
            "社会本能": ["绝对孤独（接触即死）", "强制共生（离群衰亡）"]
        }
    };

    // -----------------------------------------------------------------
    // 2. SillyTavern API 封装
    // -----------------------------------------------------------------
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    async function waitForTavernHelper(retries = 20, interval = 500) {
        for (let i = 0; i < retries; i++) {
            if (window.TavernHelper && typeof window.TavernHelper.getLorebooks === "function") {
                console.log(`[${extensionName}] TavernHelper API is available.`);
                return window.TavernHelper;
            }
            await delay(interval);
        }
        throw new Error("TavernHelper API is not available. Please ensure JS-Slash-Runner extension is installed and enabled.");
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
        if (!rawText || typeof rawText !== "string") return "";

        // 1. 从Markdown代码块或原始文本中提取JSON字符串
        const match = rawText.match(/```json\s*([\s\S]*?)\s*```/);
        let jsonString = match ? match[1] : rawText;
        if (!match) {
            const firstBracket = jsonString.indexOf("[");
            const lastBracket = jsonString.lastIndexOf("]");
            if (firstBracket !== -1 && lastBracket > firstBracket) {
                jsonString = jsonString.substring(firstBracket, lastBracket + 1);
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
            }
        );

        return healedJsonString;
    }

    function sanitizeEntry(entry) {
        // 定义世界书条目允许的字段白名单
        const allowedKeys = [
            'key', 'keys', 'comment', 'content', 'type', 'position', 
            'depth', 'prevent_recursion', 'order'
        ];
        const sanitized = {};
        // 遍历白名单，只保留entry中存在的、且在白名单内的字段
        for (const key of allowedKeys) {
            if (entry.hasOwnProperty(key)) {
                sanitized[key] = entry[key];
            }
        }
        return sanitized;
    }

    function determineProjectStage(entries) {
        if (!Array.isArray(entries) || entries.length === 0) return 1;
        const hasStoryEntries = entries.some(entry => (entry.key && (entry.key.includes('主线任务') || entry.key.includes('剧情'))) || (entry.comment && entry.comment.includes('【主线任务】')));
        if (hasStoryEntries) return 3;
        const hasFoundationEntries = entries.some(entry => (entry.key && (entry.key.includes('世界观') || entry.key.includes('核心设定'))) || (entry.comment && entry.comment.includes('【总览】')));
        if (hasFoundationEntries) return 2;
        return 1;
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

    // 内置剧情设定元素池
    const plotElementPool = {
        "核心冲突": ["生存与毁灭", "自由与奴役", "秩序与混沌", "理想与现实", "知识与愚昧"],
        "故事驱动力": ["复仇", "探索", "守护", "逃亡", "追求力量"],
        "主要情节钩子": ["一个神秘的预言", "一件失落的神器", "一场突发的灾难", "一个无辜者的请求", "一个古老的阴谋"],
        "故事节奏": ["紧张急促", "悬念迭起", "缓慢铺陈", "张弛有度", "多线并行"],
        "世界转折点": ["旧神归来", "科技突破", "魔法失效", "新物种诞生", "社会革命"],
        "主角初始状态": ["一无所有", "身负血海深仇", "迷茫的继承者", "秩序的维护者", "局外观察者"],
        "反派核心动机": ["扭曲的正义", "纯粹的破坏欲", "求知欲的极端化", "为生存不择手段", "对主角的私人仇恨"],
        "关键配角类型": ["睿智的导师", "忠诚的伙伴", "神秘的引路人", "亦敌亦友的对手", "不可或缺的累赘"],
        "叙事风格": ["史诗宏大", "黑色幽默", "悬疑惊悚", "浪漫主义", "残酷写实"],
        "情感基调": ["悲壮苍凉", "热血激昂", "绝望压抑", "温馨治愈", "荒诞讽刺"],
        "核心谜题": ["主角的身世之谜", "世界的真相", "反派的真实目的", "历史的空白", "神秘力量的来源"],
        "故事发生地": ["一座孤立的城市", "一片无垠的废土", "一个繁华的帝国首都", "一个异次元空间", "一艘星际飞船"],
        "关键道具": ["能控制时间的怀表", "记录着禁忌知识的书", "一把弑神的武器", "唯一的解药", "通往新世界地图"],
        "中期重大转折": ["导师的背叛", "盟友的死亡", "主角发现自己是反派的棋子", "世界是虚假的", "真正的敌人另有其人"],
        "力量体系冲突": ["魔法与科技的对决", "新旧两种力量的更迭", "力量失控的代价", "对力量的不同理解", "无力者对抗强权"],
        "社会派系冲突": ["贵族与平民", "教会与王权", "激进派与保守派", "本土势力与外来者", "人类与非人种族"],
        "故事结局倾向": ["光明的胜利", "惨烈的胜利", "开放式结局", "主角与反派同归于尽", "世界进入新纪元"],
        "道德困境": ["牺牲少数拯救多数", "为达目的不择手段", "谎言与真相的选择", "复仇与宽恕", "个人情感与大义"],
        "故事主题": ["探讨人性的复杂", "反思科技的伦理", "歌颂自由意志", "揭示命运的无常", "描绘文明的兴衰"],
        "独特设定": ["所有人的记忆每天重置", "语言具有物理力量", "梦境可以影响现实", "情绪会物化成怪物", "时间倒流的世界"]
    };

    function populateAdvancedOptions() {
        const container = $('#advanced-options-content');
        container.empty();
        for (const category in worldElementPool) {
            const subcategories = worldElementPool[category];
            for (const subcategory in subcategories) {
                const options = subcategories[subcategory];
                const selectId = `adv-opt-${category}-${subcategory}`.replace(/\s/g, '-');
                let selectHtml = `<div class="advanced-option-item"><label for="${selectId}">${subcategory}:</label><select id="${selectId}" data-category="${subcategory}"><option value="">(AI自由发挥)</option>`;
                options.forEach(option => {
                    selectHtml += `<option value="${option}">${option}</option>`;
                });
                selectHtml += `</select></div>`;
                container.append(selectHtml);
            }
        }
    }

    function handleRandomizeAll() {
        $('#advanced-options-content select').each(function() {
            const options = $(this).find('option');
            // 从第二个选项开始随机选择（跳过“AI自由发挥”）
            const randomIndex = Math.floor(Math.random() * (options.length - 1)) + 1;
            $(this).prop('selectedIndex', randomIndex);
        });
        toastr.info('已为所有高级设定随机选择完毕！');
    }

    function populatePlotOptions() {
        const container = $('#plot-options-content');
        container.empty();
        for (const category in plotElementPool) {
            const options = plotElementPool[category];
            const selectId = `plot-opt-${category}`.replace(/\s/g, '-');
            let selectHtml = `<div class="advanced-option-item"><label for="${selectId}">${category}:</label><select id="${selectId}" data-category="${category}"><option value="">(AI自由发挥)</option>`;
            options.forEach(option => {
                selectHtml += `<option value="${option}">${option}</option>`;
            });
            selectHtml += `</select></div>`;
            container.append(selectHtml);
        }
    }

    function handleRandomizePlotOptions() {
        $('#plot-options-content select').each(function() {
            const options = $(this).find('option');
            const randomIndex = Math.floor(Math.random() * (options.length - 1)) + 1;
            $(this).prop('selectedIndex', randomIndex);
        });
        toastr.info('已为所有剧情设定随机选择完毕！');
    }

    function populateDetailOptions() {
        const container = $('#detail-options-content');
        container.empty();
        for (const category in detailElementPool) {
            const options = detailElementPool[category];
            const selectId = `detail-opt-${category}`.replace(/\s/g, '-');
            let selectHtml = `<div class="advanced-option-item"><label for="${selectId}">${category}:</label><select id="${selectId}" data-category="${category}"><option value="">(AI自由发挥)</option>`;
            options.forEach(option => {
                selectHtml += `<option value="${option}">${option}</option>`;
            });
            selectHtml += `</select></div>`;
            container.append(selectHtml);
        }
    }

    function handleRandomizeDetailOptions() {
        $('#detail-options-content select').each(function() {
            const options = $(this).find('option');
            const randomIndex = Math.floor(Math.random() * (options.length - 1)) + 1;
            $(this).prop('selectedIndex', randomIndex);
        });
        toastr.info('已为所有细节深化选项随机选择完毕！');
    }

    function populateMechanicsOptions() {
        const container = $('#mechanics-options-content');
        container.empty();
        for (const category in mechanicsElementPool) {
            const options = mechanicsElementPool[category];
            const selectId = `mech-opt-${category}`.replace(/\s/g, '-');
            let selectHtml = `<div class="advanced-option-item"><label for="${selectId}">${category}:</label><select id="${selectId}" data-category="${category}"><option value="">(AI自由发挥)</option>`;
            options.forEach(option => {
                selectHtml += `<option value="${option}">${option}</option>`;
            });
            selectHtml += `</select></div>`;
            container.append(selectHtml);
        }
    }

    function handleRandomizeMechanicsOptions() {
        $('#mechanics-options-content select').each(function() {
            const options = $(this).find('option');
            const randomIndex = Math.floor(Math.random() * (options.length - 1)) + 1;
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
        $('#advanced-options-content select').each(function() {
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
            const [unrestrictPrompt, writingGuide, promptTemplate] = await Promise.all([
                $.get(`${extensionFolderPath}/unrestrict-prompt.txt`),
                $.get(`${extensionFolderPath}/writing-guide.txt`),
                $.get(`${extensionFolderPath}/generator-prompt.txt`)
            ]);
            const combinedPromptTemplate = `${unrestrictPrompt}\n\n${writingGuide}\n\n${promptTemplate}`;
            let finalPrompt = combinedPromptTemplate
                .replace(/{{bookName}}/g, bookName)
                .replace(/{{advancedOptions}}/g, advancedOptionsString || '无')
                .replace(/{{coreTheme}}/g, coreTheme || '无');

            console.log(`[${extensionName}] Final prompt for Foundation:`, finalPrompt);
            const rawAiResponse = await tavernHelperApi.generateRaw({
                ordered_prompts: [{ role: "user", content: finalPrompt }],
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
            $('#generateFoundationButton').prop('disabled', false).text('生成/补充内容');
        }
    }

    async function handleUploadFoundation() {
        const bookName = projectState.bookName;
        const rawAiResponse = projectState.generatedContent;
        if (!bookName || !rawAiResponse) {
            toastr.warning("没有可上传的内容。");
            return;
        }

        $('#uploadFoundationButton').prop('disabled', true).text("上传中...");
        try {
            const cleanedJsonString = extractAndCleanJson(rawAiResponse);
            const newGeneratedEntries = JSON.parse(cleanedJsonString);
            if (!Array.isArray(newGeneratedEntries)) throw new Error("AI返回的数据解析后不是一个JSON数组。");
            
            await createLorebook(bookName);
            for (const entry of newGeneratedEntries) {
                const sanitizedEntry = sanitizeEntry(entry);
                await createLorebookEntry(bookName, sanitizedEntry);
            }
            
            toastr.success(`成功上传 ${newGeneratedEntries.length} 个新条目到世界书 "${bookName}"！`);
            $('#aiResponseTextArea').val(`上传成功！您可以继续补充内容，或通过上方按钮切换到下一阶段。`);
            setActiveStage(2); // 自动切换到下一阶段
        } catch (error) {
            console.error(`[${extensionName}] 上传世界内容失败:`, error);
            toastr.error(`上传失败: ${error.message}`);
        } finally {
            $('#uploadFoundationButton').prop('disabled', false).text("上传至世界书");
        }
    }

    async function handleGenerateOutline() {
        const bookName = projectState.bookName;
        if (!bookName) {
            toastr.error("项目状态丢失，请返回第一步重新开始。");
            return;
        }

        const plotElements = $('#plotElements').val().trim();
        let plotOptionsString = '';
        $('#plot-options-content select').each(function() {
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
                getLorebookEntries(bookName)
            ]);
            const combinedPromptTemplate = `${unrestrictPrompt}\n\n${writingGuide}\n\n${promptTemplate}`;
            const currentBookContent = JSON.stringify(currentEntries, null, 2);
            let finalPrompt = combinedPromptTemplate
                .replace(/{{world_book_entries}}/g, currentBookContent)
                .replace(/{{plot_elements}}/g, plotElements || '无')
                .replace(/{{plotOptions}}/g, plotOptionsString || '无');

            console.log(`[${extensionName}] Final prompt for Outline:`, finalPrompt);
            const rawAiResponse = await tavernHelperApi.generateRaw({
                ordered_prompts: [{ role: "user", content: finalPrompt }],
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
            $('#generateOutlineButton').prop('disabled', false).text('生成/补充剧情');
        }
    }

    async function handleUploadOutline() {
        const bookName = projectState.bookName;
        const rawAiResponse = projectState.generatedOutlineContent;
        if (!bookName || !rawAiResponse) {
            toastr.warning("没有可上传的剧情内容。");
            return;
        }

        $('#uploadOutlineButton').prop('disabled', true).text("上传中...");
        try {
            const cleanedJsonString = extractAndCleanJson(rawAiResponse);
            const newGeneratedEntries = JSON.parse(cleanedJsonString);
            if (!Array.isArray(newGeneratedEntries)) throw new Error("AI返回的数据解析后不是一个JSON数组。");
            
            for (const entry of newGeneratedEntries) {
                const sanitizedEntry = sanitizeEntry(entry);
                await createLorebookEntry(bookName, sanitizedEntry);
            }
            
            toastr.success(`成功将 ${newGeneratedEntries.length} 个剧情条目添加到世界书 "${bookName}"！`);
            $('#aiResponseTextArea-stage2').val("上传成功！您可以继续补充剧情，或通过上方按钮切换到下一阶段。");
            setActiveStage(3); // 自动切换到下一阶段
        } catch (error) {
            console.error(`[${extensionName}] 上传剧情内容失败:`, error);
            toastr.error(`上传失败: ${error.message}`);
        } finally {
            $('#uploadOutlineButton').prop('disabled', false).text("上传至世界书");
        }
    }

    async function handleGenerateDetail() {
        const bookName = projectState.bookName;
        if (!bookName) {
            toastr.error("项目状态丢失，请返回第一步重新开始。");
            return;
        }

        const detailElements = $('#detailElements').val().trim();
        let detailOptionsString = '';
        $('#detail-options-content select').each(function() {
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
                getLorebookEntries(bookName)
            ]);
            const combinedPromptTemplate = `${unrestrictPrompt}\n\n${writingGuide}\n\n${promptTemplate}`;
            const currentBookContent = JSON.stringify(currentEntries, null, 2);
            let finalPrompt = combinedPromptTemplate
                .replace(/{{world_book_entries}}/g, currentBookContent)
                .replace(/{{detail_elements}}/g, detailElements || '无')
                .replace(/{{detailOptions}}/g, detailOptionsString || '无');

            console.log(`[${extensionName}] Final prompt for Detail:`, finalPrompt);
            const rawAiResponse = await tavernHelperApi.generateRaw({
                ordered_prompts: [{ role: "user", content: finalPrompt }],
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
            $('#generateDetailButton').prop('disabled', false).text('生成/补充细节');
        }
    }

    async function handleUploadDetail() {
        const bookName = projectState.bookName;
        const rawAiResponse = projectState.generatedDetailContent;
        if (!bookName || !rawAiResponse) {
            toastr.warning("没有可上传的细节内容。");
            return;
        }

        $('#uploadDetailButton').prop('disabled', true).text("上传中...");
        try {
            const cleanedJsonString = extractAndCleanJson(rawAiResponse);
            const newGeneratedEntries = JSON.parse(cleanedJsonString);
            if (!Array.isArray(newGeneratedEntries)) throw new Error("AI返回的数据解析后不是一个JSON数组。");
            
            for (const entry of newGeneratedEntries) {
                const sanitizedEntry = sanitizeEntry(entry);
                await createLorebookEntry(bookName, sanitizedEntry);
            }
            
            toastr.success(`成功将 ${newGeneratedEntries.length} 个细节条目添加到世界书 "${bookName}"！`);
            $('#aiResponseTextArea-stage3').val("上传成功！您可以继续补充细节，或通过上方按钮切换到下一阶段。");
            setActiveStage(4); // 自动切换到下一阶段
        } catch (error) {
            console.error(`[${extensionName}] 上传细节内容失败:`, error);
            toastr.error(`上传失败: ${error.message}`);
        } finally {
            $('#uploadDetailButton').prop('disabled', false).text("上传至世界书");
        }
    }

    async function handleGenerateMechanics() {
        const bookName = projectState.bookName;
        if (!bookName) {
            toastr.error("项目状态丢失，请返回第一步重新开始。");
            return;
        }

        // 修正：使用与其他阶段一致的、通过ID获取textarea内容的方式
        const mechanicsElements = $('#mechanicsElements').val().trim();
        let mechanicsOptionsString = '';
        // 修正：使用与其他阶段一致的、更简洁的select元素选择器
        $('#mechanics-options-content select').each(function() {
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
                getLorebookEntries(bookName)
            ]);
            const combinedPromptTemplate = `${unrestrictPrompt}\n\n${writingGuide}\n\n${promptTemplate}`;
            const currentBookContent = JSON.stringify(currentEntries, null, 2);
            let finalPrompt = combinedPromptTemplate
                .replace(/{{world_book_entries}}/g, currentBookContent)
                .replace(/{{mechanics_elements}}/g, mechanicsElements || '无')
                .replace(/{{mechanicsOptions}}/g, mechanicsOptionsString || '无');

            console.log(`[${extensionName}] Final prompt for Mechanics:`, finalPrompt);
            const rawAiResponse = await tavernHelperApi.generateRaw({
                ordered_prompts: [{ role: "user", content: finalPrompt }],
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
            $('#generateMechanicsButton').prop('disabled', false).text('设计/补充机制');
        }
    }

    async function handleUploadMechanics() {
        const bookName = projectState.bookName;
        const rawAiResponse = projectState.generatedMechanicsContent;
        if (!bookName || !rawAiResponse) {
            toastr.warning("没有可上传的游戏机制内容。");
            return;
        }

        $('#uploadMechanicsButton').prop('disabled', true).text("上传中...");
        try {
            const cleanedJsonString = extractAndCleanJson(rawAiResponse);
            const newGeneratedEntries = JSON.parse(cleanedJsonString);
            if (!Array.isArray(newGeneratedEntries)) throw new Error("AI返回的数据解析后不是一个JSON数组。");
            
            for (const entry of newGeneratedEntries) {
                const sanitizedEntry = sanitizeEntry(entry);
                await createLorebookEntry(bookName, sanitizedEntry);
            }
            
            toastr.success(`成功将 ${newGeneratedEntries.length} 个游戏机制条目添加到世界书 "${bookName}"！`);
            $('#aiResponseTextArea-stage4').val("上传成功！您的世界书已基本完成！");
        } catch (error) {
            console.error(`[${extensionName}] 上传游戏机制失败:`, error);
            toastr.error(`上传失败: ${error.message}`);
        } finally {
            $('#uploadMechanicsButton').prop('disabled', false).text("上传至世界书");
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
            toastr.error('无法加载世界书列表。');
        }
    }

    function handleStartNew() {
        Object.assign(projectState, { bookName: '', generatedContent: null, generatedOutlineContent: null });
        $('#bookName').val('').prop('disabled', false);
        $('#wbg-landing-page').hide();
        $('#wbg-generator-page').show();
        setActiveStage(1);
    }

    async function handleContinue() {
        const selectedBook = $('#existingBooksDropdown').val();
        if (!selectedBook) {
            toastr.warning('请先选择一个世界书！');
            return;
        }
        localStorage.setItem('wbg_lastBookName', selectedBook);
        toastr.info(`正在加载世界书 "${selectedBook}"...`);
        try {
            const entries = await getLorebookEntries(selectedBook);
            const stage = 4; // For now, let's just assume we can always edit any stage. A more complex logic can be added later.
            projectState.bookName = selectedBook;
            $('#bookName').val(selectedBook).prop('disabled', true);
            $('#wbg-landing-page').hide();
            $('#wbg-generator-page').show();
            setActiveStage(stage);
            toastr.success(`已加载 "${selectedBook}"，您可以对任意阶段进行创作。`);
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
        toastr.info(`正在快速加载上次的项目 "${lastBookName}"...`);
        try {
            const entries = await getLorebookEntries(lastBookName);
            const stage = 4; // 默认可以编辑所有阶段
            projectState.bookName = lastBookName;
            $('#bookName').val(lastBookName).prop('disabled', true);
            $('#wbg-landing-page').hide();
            $('#wbg-generator-page').show();
            setActiveStage(stage);
            toastr.success(`已加载 "${lastBookName}"，您可以对任意阶段进行创作。`);
            $('#wbg-popup-overlay').css("display", "flex"); // 确保弹窗可见
        } catch (error) {
            console.error(`[${extensionName}] Failed to quick continue project:`, error);
            toastr.error(`快速加载项目失败: ${error.message}`);
        }
    }

    async function initializeExtension() {
        $("head").append(`<link rel="stylesheet" type="text/css" href="${extensionFolderPath}/style.css?v=${Date.now()}">`);
        try {
            const [settingsHtml, popupHtml] = await Promise.all([
                $.get(`${extensionFolderPath}/settings.html`),
                $.get(`${extensionFolderPath}/popup.html?v=${Date.now()}`),
            ]);
            $("#extensions_settings2").append(settingsHtml);
            $("body").append(popupHtml);
        } catch (error) {
            console.error(`[${extensionName}] Failed to load HTML files.`, error);
            return;
        }

        $("body").append(`<div id="wbg-floating-button" title="世界书生成器"><i class="fa-solid fa-wand-magic-sparkles"></i></div>`);
        
        $("#wbg-floating-button").on("click", () => {
            const lastBookName = localStorage.getItem('wbg_lastBookName');
            if (lastBookName) {
                $('#quickContinueButton').show().find('span').text(lastBookName);
            } else {
                $('#quickContinueButton').hide();
            }
            $('#wbg-generator-page').hide();
            $('#wbg-landing-page').show();
            $('#wbg-popup-overlay').css("display", "flex");
            populateBooksDropdown();
        });

        $("#wbg-popup-close-button").on("click", () => $("#wbg-popup-overlay").hide());
        // $("#wbg-popup-overlay").on("click", function(event) {
        //     if (event.target === this) $(this).hide();
        // }); // 已禁用点击外部关闭
        $("#wbg-popup").on("click", (e) => e.stopPropagation());

        // 欢迎页面按钮
        $('#startNewButton').on('click', handleStartNew);
        $('#continueButton').on('click', handleContinue);
        $('#quickContinueButton').on('click', handleQuickContinue);

        // 阶段选择器
        $('#wbg-stage-selector').on('click', '.stage-button', function() {
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

        // 阶段三按钮
        $('#randomizeDetailButton').on('click', handleRandomizeDetailOptions);
        $('#generateDetailButton').on('click', handleGenerateDetail);
        $('#uploadDetailButton').on('click', handleUploadDetail);

        // 阶段四按钮
        $('#randomizeMechanicsButton').on('click', handleRandomizeMechanicsOptions);
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
        toastr.error(`扩展 "${extensionName}" 初始化失败: ${error.message}`);
    }
});
