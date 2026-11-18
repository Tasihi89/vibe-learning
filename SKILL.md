---
name: vibe-learning
description: 打开 Vibe Learning：一个在本机网页里学东西的小程序，问一句，AI 边讲边画一张图讲给你听。用户说「/vibe-learning」「打开 Vibe Learning」「打开学习页」「我想学 X」「用 Vibe Learning 学 X」「Vibe Learning 怎么用」「更新 Vibe Learning」「让 Vibe Learning 能读我电脑上的文件」「Vibe Learning 打不开 / 报错」「卸载 Vibe Learning」时使用。
---

# Vibe Learning

这个 skill 所在的文件夹（上面写的 Base directory，一般是 `~/.claude/skills/vibe-learning`）就是整个程序。学是在浏览器的网页里学，Claude Code 只负责打开、更新、修问题。跟用户说话用中文、用大白话，不讲技术细节，除非他问。

下面的命令里，`$VL` 指这个文件夹。

## 打开

```
open -a "Vibe Learning"
```

它会在后台开好本机服务（`http://127.0.0.1:4178`），再在浏览器里打开首页。找不到这个应用，运行 `node "$VL/setup.mjs"` 重新做图标、打开首页（没有 `node` 命令，就用 `~/.vibe-learning/_node/bin/node`）。

打开以后，用一两句话告诉他首页在浏览器里开好了。他是第一次用、或者问怎么用，照下面「怎么用」讲给他。

## 我想学 X

先照「打开」把服务开起来，等 `curl -s --noproxy '*' http://127.0.0.1:4178/__vl` 有回应，再替他开一个项目（`<他的原话>` 照原样放进 JSON）：

```
curl -s --noproxy '*' -X POST -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:4178' -d '{"q":"<他的原话>"}' http://127.0.0.1:4178/api/new
```

拿到 `slug` 后运行 `open "http://127.0.0.1:4178/<slug>/?ask=<他的原话，URL 编码>"`，页面会自己开始回答这句话。告诉他回答在浏览器里。

## 怎么用（讲给他听）

- 在首页写一句想学的东西，按回车。AI 一边讲一边画图；有先后的事，图会分几页，点「下一步」往下翻。
- 哪一段没看懂，用鼠标选中它，点「问 Claude」，问答会挂在旁边；还能在旁边接着追问，或者点开成一整页。
- 想看看自己懂没懂：鼠标移到回答上，点右上角的复述图标，用自己的话讲一遍，AI 会把他讲的画出来、帮他改对。改好的图能收进首页的「思维模型」。
- 用的是他自己 Claude Code 的额度，每个回答用 Opus，比平时聊天花得多。学习记录只存在这台电脑的 `~/.vibe-learning/` 里。

## 更新

```
bash "$VL/install.sh"
```

会下载最新版、重新做图标、重启服务，学习记录不动。跑完把最后那段「装好了」的话照着告诉他。

## 让它能读电脑上的文件

页面上的 AI 默认只读得到每个学习项目自己的文件夹。他想让它讲自己电脑上的代码、软件、设置时，先用一句话说清：打开以后它能读这台电脑上的所有文件；它也会上网查资料，网页里万一藏着骗 AI 的话，可能被骗去读私人文件。他同意了，在 `~/.vibe-learning/settings.json` 里写 `{"readAnywhere": true}`（文件已经有别的内容就只加这一项），下一次提问起生效。想关掉，删掉这一项。

## 出问题

- **点图标没反应、首页打不开**：运行 `node "$VL/serve.mjs"` 看它说什么；日志在 `~/.vibe-learning/server.log`。端口被占了，告诉他是哪个程序占的。
- **页面上说「找不到 claude 命令」**：Claude Code 换了位置或者重装过，运行 `node "$VL/setup.mjs"` 重新做图标。
- **页面上说「没有登录」**：让他在终端运行 `claude`，照提示登录。
- **页面上说「连不上 Claude」**：先看终端里的 Claude Code 能不能用。他上网要开代理的话，让他打开代理；代理写在 `~/.zshrc` 里的，图标每次打开会自己读到，改过代理要重新点一下图标（服务已经开着的，先运行 `node "$VL/serve.mjs" stop`）。
- **用量到上限**：等额度恢复再问。

## 卸载

先 `node "$VL/serve.mjs" stop`，再删掉「应用程序」里的 `Vibe Learning.app`、桌面上的「Vibe Learning」快捷方式和 `$VL` 这个文件夹。学习记录在 `~/.vibe-learning/`，要不要删问他。

## 改它

想改页面、回答的样子，或者换成别的 AI，在 `$VL` 里开一个 Claude Code 会话，先读 `AGENTS.md`。
