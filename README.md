# RPG Maker Agent

给 AI 一篇文章，自动生成一款可以玩的 RPG Maker MZ 游戏

![](./assets/images/cover.png)

[(原谅我懒得P图了, 直接用了视频封面... 视频在这里)](https://www.bilibili.com/video/BV1QwPqznE4g)

说实话, 项目其实还处于原型阶段, 目前我觉得快速搭建1-3个场景的demo 或者给小朋友玩的游戏还是可以的.  

另外只有场景, 事件和对话, 战斗系统是没有实装的, 感兴趣的朋友可以fork添加. 很期待看到孔乙己暴打丁举人 (反过来也行...)

## 快速开始

首先把项目下载后放到 RPG Maker MZ 的目录中哈, 比如你的 RPG Maker MZ 在:

```
C:\SteamLibrary\steamapps\common\RPG Maker MZ\
```

就把它放在这里:


```
C:\SteamLibrary\steamapps\common\RPG Maker MZ\rpgmaker-agent
```

然后初始化项目:

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 API Key 和模型配置

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000，进入项目管理界面。

## 使用流程

1. **新建项目** — 输入项目名称，粘贴一篇文章
2. **分步生成** — 依次执行 6 个 AI 管线步骤，每步可暂停检查
3. **审查与批注** — 点击任意结构化元素可添加批注（修改建议）
4. **AI 修改** — 点击「AI 按批注修改」按钮，AI 会根据你的批注自动修订 JSON
5. **手动微调** — 也可以切换到 JSON 编辑器直接修改数据
6. **生成工程** — 最后一步生成完整的 RPG Maker MZ 工程文件
7. **运行游戏** — 参照下方说明试玩

## 运行生成的游戏

生成完毕后，页面会显示工程输出路径（如 `generated/project-xxx`）。有三种方式运行游戏：

### 方法一：用 RPG Maker MZ 编辑器打开（推荐）

1. 打开 RPG Maker MZ 编辑器（`RPGMZ.exe`）
2. 菜单 → 文件 → 打开项目
3. 选择生成的工程目录（即 `generated/project-xxx` 文件夹）
4. 点击工具栏上的 ▶ (Play Test) 按钮即可试玩
5. 你还可以在编辑器中进一步修改地图、事件、对话等

### 方法二：用 NW.js 直接运行（无需编辑器）

RPG Maker MZ 自带了 NW.js 运行时，可以直接启动游戏：

```powershell
# Windows — 在 RPG Maker MZ 安装目录下执行
.\nwjs-win\nw.exe "生成的工程绝对路径"

# 例如
.\nwjs-win\nw.exe "C:\SteamLibrary\steamapps\common\RPG Maker MZ\rpgmaker-agent\generated\project-1772459497898"
```

### 方法三：浏览器运行（HTML5）

生成的工程包含 `index.html`，可以用本地 HTTP 服务器启动：

```bash
cd generated/project-xxx
npx serve .
```

然后在浏览器中打开 http://localhost:3000 即可游玩。

> **注意**：直接双击 `index.html` 不行，因为浏览器安全策略会阻止本地文件加载。必须通过 HTTP 服务器访问。

## 工作原理

管线通过 6 个 AI 驱动的阶段处理你的文章：

1. **文本分析** — 提取角色、地点、时间线、情感弧线
2. **游戏设计** — 创建锚定事件、决策节点、游戏流程图
3. **场景规划** — 规划 5-10 个地图场景及其连接关系
4. **场景构建** — 为每个场景创建详细的事件、NPC、对话
5. **素材映射** — 将角色/场景映射到 RPG Maker MZ 内置素材
6. **工程生成** — 生成可直接运行的 MZ 工程文件

每一步都使用流式输出实时展示 AI 响应，支持检查、回退、批注和 AI 交互式修改。所有数据持久化到本地 SQLite 数据库。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | API 密钥 | （必填） |
| `OPENAI_BASE_URL` | API 地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 使用的模型 | `gpt-4o` |
| `RPGMAKER_TEMPLATE_PATH` | MZ 模板工程路径 | `newdata` |
| `RPGMAKER_SAMPLEMAPS_PATH` | 示例地图路径 | `samplemaps` |

## 项目结构

```
src/
├── app/                     # Next.js 页面和 API 路由
│   ├── page.tsx             # 首页 — 项目列表 Dashboard
│   ├── projects/new/        # 新建项目页
│   ├── projects/[id]/       # 项目详情 — 分步交互
│   └── api/                 # REST API
│       ├── projects/        # 项目 CRUD
│       ├── projects/[id]/run-step/     # 执行步骤 (SSE)
│       ├── projects/[id]/annotations/  # 批注 CRUD
│       ├── projects/[id]/ai-revise/    # AI 按批注修改 (SSE)
│       └── download/[id]/   # 下载 ZIP
├── components/              # React 组件
│   ├── StepStepper.tsx      # 步骤进度指示器
│   ├── StepResultViewer.tsx # 步骤结果结构化展示
│   ├── Annotatable.tsx      # 可批注元素包装
│   ├── AnnotationPopover.tsx # 批注气泡弹窗
│   └── ConsolePanel.tsx     # 底部 Console 面板
├── pipeline/                # AI 管线模块
│   ├── types.ts             # 中间数据类型定义
│   ├── orchestrator.ts      # 管线编排器（分步执行）
│   ├── prompts.ts           # System prompt 统一映射
│   ├── text-analyzer.ts     # 模块1：文本分析
│   ├── game-designer.ts     # 模块2：游戏设计
│   ├── scene-planner.ts     # 模块3：场景规划
│   ├── scene-builder.ts     # 模块4：场景构建
│   ├── asset-mapper.ts      # 模块5：素材映射
│   └── rpgmaker-adapter.ts  # 模块6：MZ 工程生成
├── rpgmaker/                # RPG Maker MZ 工具库
│   ├── types.ts             # MZ JSON 类型定义
│   ├── constants.ts         # 事件指令码常量
│   ├── event-builder.ts     # 事件指令构建器
│   ├── map-builder.ts       # 地图数据工具
│   ├── project-builder.ts   # 工程组装器
│   └── asset-catalog.ts     # 内置素材索引
├── llm/
│   └── client.ts            # LLM SDK 封装（流式 + 日志）
└── lib/
    └── db.ts                # SQLite 数据库（项目、步骤、日志、批注）
```

## 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: SQLite (better-sqlite3)
- **AI**: 兼容 OpenAI API 的大语言模型
- **输出**: RPG Maker MZ (JSON 工程文件)
