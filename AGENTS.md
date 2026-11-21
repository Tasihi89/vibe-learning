# Vibe Learning：给维护它的 AI 看

新开一个会话，先读这一页：产品是什么、怎么运转、改东西要守的规矩。在这个目录里开 Codex 会话，它会自动读到这一页。给人看的说明在 `README.md`；页面和回答为什么是现在这样，在 `docs/design.md`。

**本机如果有 `local/` 文件夹**（不进 git），里面是维护者自己的笔记，先读 `local/NOTES.md`，它补充、也优先于这一页。

学习者用中文，回复也用中文，用大白话，少用缩写和行话。

## 一分钟了解

一个在自己电脑上运行的学习小产品。学习者在首页写一句想学的，AI 回答，每个回答配一张 AI 自己画的图（SVG），帮他在脑子里搭起模型；讲的是有先后的事，这张图分几页亮出来，边讲边画：每页出一个变化，讲它的话就画在图里、挨着它（`answer-spec.md`「一步步翻」）。回答里哪段没懂，选中它接着问，问答挂在旁边的备注里，备注还能展开成整页；左边的目录、顶上的地图记着一路是怎么问下来的。想检查自己懂没懂，点白框右上角的图标开一页复述，用自己的话讲，AI 把他讲的模型画出来、和正确的对比、改正；改好的图可以收进首页的「思维模型」。

```
浏览器里的页面  ⇄  serve.mjs（本机服务，127.0.0.1:4178）  ⇄  codex app-server（学习者自己的 Codex 登录和额度）
                         │
                  ~/.vibe-learning/<项目>/：topic.json、data/qa/<id>.json、files/
```

- **装**：`install.sh` 把这个文件夹复制到 `~/.codex/skills/vibe-learning/`（它本身就是一个 Codex skill，`SKILL.md` 在根目录），没有合适的 Node 就下载一份放进 `~/.vibe-learning/_node/`，再运行 `setup.mjs`：做 Mac 图标、桌面放快捷方式、打开首页。从新版的文件夹再运行一次 `install.sh` 就是更新。
- **打开**：点「Vibe Learning」图标，或者 `node serve.mjs`，两者一样：服务没开就在后台开起来，再在浏览器里打开首页 `http://127.0.0.1:4178/`。服务一直开到关机。在 Codex 里输入 `$vibe-learning` 也行（照 `SKILL.md` 打开图标）。
- **开新项目**。首页提交问题，或从聊天通过标准输入传给 `node serve.mjs --ask`。两个入口都用 `POST /api/new` 创建项目，然后打开 `/<项目>/#ask=<编码后的问题>`。页面取出问题，清掉地址里的 `ask`，开始回答。后台的 `prepareTopic` 另行生成标题、底稿和引导问题，写回 `topic.json` 后页面会更新。
- **提问**：`template.html` 里的 `buildPrompt()` 把材料拼成一条消息：学习者是谁、项目、资料在哪、底稿、`answer-spec.md` 全文、这一页是怎么一路长出来的、这一页最近 5 个问答、是不是在备注卡片里问的、问题本身。发到 `api/ask`，服务用 `runAgent()` 起 `codex app-server`（学习者 Codex 的默认模型，思考力度 high）。回答是一行一个 JSON（文字块、图块），服务边收边转给页面，页面边收边画，写完存成 `data/qa/<id>.json`。
- **AI 的文件和网络权限**。回答时沙箱允许写入项目的 `files/` 和系统临时目录，开题时使用只读模式。AI 可以用网页搜索，本地命令没有网络访问权限。默认提示词要求它只读当前项目和 `sources` 列出的路径，沙箱没有强制限定这个读取范围。`settings.json` 中的 `readAnywhere: true` 会去掉这条提示。见 `serve.mjs` 的 `startAgent()`。
- **页面自己更新**：开着的页面每两秒问一次 `api/rev`。`template.html`、`home.html`、`answer-spec.md` 改了就刷新；`topic.json` 变了就重新取项目信息。

## Codex 怎么接的

只有 `serve.mjs` 的 `startAgent()` 在调 Codex。每次提问（还有后台开题）起一个 `codex app-server`，在标准输入输出上说 JSON-RPC（一行一条）：

1. `initialize`（带 `clientInfo`），再发一条 `initialized` 通知。
2. `config/read`、`skills/list`：找出学习者自己配的 MCP 服务和技能的名字，下一步在这次会话里关掉（不改他的设置）。
3. `thread/start`：`cwd`（回答问题时是项目的 `files/`，开题时是项目文件夹）、`approvalPolicy: "never"`、`sandbox`、`ephemeral: true`、`baseInstructions`（换掉 Codex 默认的写代码说明）、`config`（关掉的功能、`web_search: "live"`、关掉的 MCP 和技能）；设置里写了 `model` 才带。
4. `turn/start`：问题拼成一段文字放进 `input`，`effort`，`sandboxPolicy`（写死成只写工作目录和临时目录、命令不联网，学习者 config.toml 里的沙箱设置不算数）。
5. 收通知：`item/agentMessage/delta` 是正在写的字（交给 `onDelta`，页面边收边画）；`item/started` 里 `commandExecution`、`webSearch`、`fileChange` 是在查资料（交给 `onStatus`，之前写的字作废）；`error` 带 `willRetry: true` 是在重连；`turn/completed` 结束，`turn.status` 是 `completed`、`failed` 或 `interrupted`，失败时看 `turn.error.codexErrorInfo` 换成页面认识的错（`codexError()`）。
6. 结束就关掉进程。它要是发来请求（提问、要权限），一律回错误：页面上没人能答。

`app-server` 的接口标着实验性。Codex 升级后页面答不出来，先看 `~/.vibe-learning/server.log`，再用 `codex app-server generate-ts --out <临时目录>` 生成当前版本的接口定义，对照上面几步改 `startAgent()`。不用 `codex exec --json`：它只在一段话写完后才交出来，页面没法边收边画。

测提问不用花额度：Codex 能接自己配的模型服务。起一个假的 Responses 接口（收 `POST /v1/responses`，回 `response.created`、`response.output_item.added`、`response.output_text.delta`、`response.output_item.done`、`response.completed` 这几种 SSE 事件），再用一个临时的 `CODEX_HOME`，里面的 `config.toml` 写 `model_provider` 指向它（`wire_api = "responses"`），另起一个测试服务（见「测试」）去问。

## 文件

| 文件 | 用途 |
|---|---|
| `SKILL.md` | Codex 的 skill：打开、我想学 X、更新、能读整台电脑、换模型、出问题、卸载 |
| `install.sh` | 安装和更新（Mac）：把它所在的文件夹复制到 `~/.codex/skills/vibe-learning/`（或者 git pull、从 GitHub 下载）、找或下载 Node、运行 `setup.mjs` |
| `setup.mjs` | 装好以后做的事：检查 Codex、做图标、桌面快捷方式、打开首页，最后打印给用户的几句用法 |
| `serve.mjs` | 本机服务和命令行入口。`node serve.mjs` 打开首页，`--ask` 读取标准输入并开新题，`<项目>` 打开已有项目，`stop` 关闭服务，`run` 在前台运行。也负责存取问答和调用 Codex。 |
| `render.mjs` | 现场把 `topic.json` 和回答格式填进 `template.html`；首页的项目列表；检查一个项目的数据格式 |
| `template.html` | 学习页，所有项目共用，不为某个项目改它。AI 画的 SVG 在这里清理（去掉脚本和外部资源、给 id 加前缀）后放进页面 |
| `home.html` | 首页：开新项目、学过的项目、收进来的思维模型 |
| `answer-spec.md` | 回答格式：页面上的 AI 每次都照它答 |
| `topic-spec.md` | 开题：新项目建好后，后台的 AI 照它起标题、写底稿、想接着问的问题 |
| `schema.md` | 数据目录、`topic.json`、`data/qa/` 的格式 |
| `check.mjs` | `node check.mjs <项目目录>`：查数据格式，再用无头 Chrome 打开学习页，宽屏、中等窗口、大屏、手机各一次，把各项交互都点一遍 |
| `e2e.mjs` | `node e2e.mjs <服务地址> <一句话> <截图目录>`：用 Chrome 调试协议按真实时间走一遍「首页写一句话 → 跳进新项目 → 等回答写完」，会真的花一次回答的额度 |
| `mac/make-app.mjs` | `node mac/make-app.mjs [文件夹]`：做「Vibe Learning.app」，点它等于运行 `node serve.mjs`。应用里记着 node、这个文件夹的位置和做的时候的 PATH；每次打开从登录 shell 里取代理设置交给 codex。名字不要改：改了，用户桌面上的快捷方式会失效 |
| `mac/icon.svg`、`mac/icon.icns` | 应用的图标。改了 `icon.svg`，用无头 Chrome 截成 1024 的透明 PNG，`sips` 缩成各个尺寸，`iconutil` 生成 `icon.icns`。图里不要自带阴影，系统会加 |
| `vendor/` | 页面用的开源库（marked、DOMPurify、KaTeX），服务从 `/_vendor/` 发给页面，不从 CDN 取 |
| `docs/design.md` | 设计记录 |
| `docs/learning-science.md` | 设计背后的研究证据 |
| `docs/images/` | `README.md` 里的截图 |

服务固定在 `127.0.0.1:4178`（`VIBE_LEARNING_PORT` 可改），数据目录 `~/.vibe-learning/`（`VIBE_LEARNING_HOME` 可改），见 `schema.md`。`serve.mjs`、`render.mjs` 改过以后再运行 `node serve.mjs`，会自动重启服务；`template.html`、`home.html`、`answer-spec.md` 改了不用重启，开着的页面两秒内自己刷新。

## 改东西

- 对页面有意见，改 `template.html`；要改回答格式，改 `answer-spec.md`；改了数据结构，同时改 `schema.md`。改完对每个项目跑 `check.mjs`，有新交互就在 `check.mjs` 里加一项检查，并确认改之前的版本过不了这项检查。
- 想要的是少。加功能前先问学习者；页面上不放操作说明类的文字。`docs/design.md` 里记着试过、去掉了的东西。
- 回答格式和发给 AI 的材料里，不写要不要读文件、要不要上网查，让它自己安排。
- 改了 `serve.mjs` 或 `render.mjs`，服务又正开着（`curl --noproxy '*' 127.0.0.1:4178/__vl` 有回应、`code` 和现在的文件对不上），改完重启一次：打开「Vibe Learning」应用（`open -a "Vibe Learning"`），它发现代码变了会自己重启。页面会自己刷新，服务不会。
- 只在本地提交 git，推送前问学习者。提交说明、代码注释、文档会公开，不写学习者个人的事和他的原话。
- 定下来的设计决定，写进 `docs/design.md`，写清原因。

## 数据

- 学习者的问答和资料，不改不删，除非他要求。改数据前先看清 `data/qa/` 里有哪些文件、各是什么时候写的，他可能刚在页面上问过。
- 他对回答不满意（看不懂、太简略、太白话）：先找 `answer-spec.md` 里是哪一条让回答变成这样，改它。要重画已有的回答时，先把项目的 `data/` 和 `topic.json` 复制到数据目录下的 `_backup/<日期时间>-<项目>/`，再按新格式改写 `blocks`，问题和时间不动。
- 重画被备注引用过的回答：别的问答的 `anchor.text` 是在这个回答里选中的原文，页面靠它找位置。重画后要在新回答里挑对应的那一段，改掉 `anchor` 的 `text`、`start`、`end`，再用 `check.mjs` 确认备注还对得上。

## 测试

- 截图只看得到静态画面，滚动、溢出、图有没有画出来靠 `check.mjs`。看效果用无头 Chrome 截图：`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=<文件> --window-size=1500,1000 --virtual-time-budget=6000 <地址>`。
- 要测真实的提问、开题，另起一个服务，用临时的数据目录和端口（`VIBE_LEARNING_HOME=<临时目录> VIBE_LEARNING_PORT=4188 node serve.mjs run`），测完删掉，别动学习者真实的数据。关这个测试服务用 `VIBE_LEARNING_PORT=4188 node serve.mjs stop`，不要用 `pkill -f "serve.mjs run"`：学习者自己的服务也是这条命令，会被一起关掉。
- 测安装：`VIBE_LEARNING_SOURCE=<本地文件夹> VIBE_LEARNING_DIR=<临时目录>/skill VIBE_LEARNING_HOME=<临时目录>/data VIBE_LEARNING_APP_DIR=<临时目录>/apps VIBE_LEARNING_DESKTOP=<临时目录>/desktop VIBE_LEARNING_NO_OPEN=1 bash install.sh`，不碰真的「应用程序」、桌面和 skill。
- 在 Codex 里测服务时用当前会话的权限访问 `127.0.0.1`。如果宿主拦住了这次访问，按它支持的权限流程处理。用 `curl` 时加 `--noproxy '*'`，让本机请求直连。
