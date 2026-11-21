#!/bin/bash
# Vibe Learning（Codex 版）：安装，或者更新（只支持 Mac）。
#
#   bash <Vibe Learning 文件夹>/install.sh
#
# 做的事：
#   1. 确认这台 Mac 上装了 Codex 命令行（codex）
#   2. 把程序放到 ~/.codex/skills/vibe-learning/（它同时是一个 Codex skill，打 $vibe-learning 就能用）
#   3. 找一个 18 版以上的 Node；没有就下载官方的一份，只放在 ~/.vibe-learning/_node/，不动系统
#   4. 运行 setup.mjs：在「应用程序」里做 Vibe Learning 图标、桌面放一个快捷方式、打开首页
# 学习记录在 ~/.vibe-learning/，更新时不动。
#
# 程序从哪来（按这个顺序找）：
#   · 这个脚本所在的文件夹（从一个下载好的文件夹运行时）
#   · 装好的地方是 git 克隆的：git pull
#   · 写了 REPO（下面，或者环境变量 VIBE_LEARNING_REPO）：从 GitHub 下载。发布到 GitHub 以后，
#     curl -fsSL https://raw.githubusercontent.com/<REPO>/main/install.sh | bash 就能装
#   · 都没有、但已经装过：只重新做图标、重启服务
#
# 测试用的环境变量（平时不用）：VIBE_LEARNING_SOURCE（从本地文件夹装）、VIBE_LEARNING_DIR（装到哪）、
# VIBE_LEARNING_HOME（数据目录）、VIBE_LEARNING_APP_DIR、VIBE_LEARNING_DESKTOP、VIBE_LEARNING_NO_OPEN、VIBE_LEARNING_NODE_DOWNLOAD
set -euo pipefail

# 整个脚本包在 main 里：用 curl … | bash 运行时，bash 先读完整个脚本再执行
main() {

  # 发布到 GitHub 后写成 "用户名/仓库名"
  REPO="${VIBE_LEARNING_REPO:-}"
  BRANCH="main"
  DIR="${VIBE_LEARNING_DIR:-${CODEX_HOME:-$HOME/.codex}/skills/vibe-learning}"
  DATA="${VIBE_LEARNING_HOME:-$HOME/.vibe-learning}"
  NODE_MAJOR=22

  step() { printf '\n▶ %s\n' "$*"; }
  fail() { printf '\n✗ 没装好：%s\n' "$*" >&2; exit 1; }

  [ "$(uname -s)" = "Darwin" ] || fail "Vibe Learning 目前只支持 Mac。"

  # 这个脚本所在的文件夹（用 curl … | bash 运行时没有）
  HERE=""
  if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
    [ -f "$HERE/serve.mjs" ] || HERE=""
  fi

  # ---------- 1. Codex ----------
  step "检查 Codex"
  CODEX="$(command -v codex 2>/dev/null || true)"
  for c in /opt/homebrew/bin/codex /usr/local/bin/codex "$HOME/.local/bin/codex" "$HOME/.npm-global/bin/codex" "$HOME/.volta/bin/codex"; do
    if [ -z "$CODEX" ] && [ -x "$c" ]; then CODEX="$c"; fi
  done
  [ -n "$CODEX" ] || fail "这台电脑上找不到 Codex 命令行（codex）。先装好它并登录（npm install -g @openai/codex 或 brew install --cask codex，然后运行 codex login），再运行一次。"
  # 图标会记下现在的 PATH，确保里面有 codex
  export PATH="$(dirname "$CODEX"):$PATH"
  echo "  找到了：${CODEX}（$("$CODEX" --version 2>/dev/null | head -n 1 || echo '版本不明')）"

  # ---------- 2. 程序 ----------
  step "放好 Vibe Learning"
  mkdir -p "$(dirname "$DIR")"
  if [ -e "$DIR" ] && [ ! -f "$DIR/serve.mjs" ]; then
    fail "$DIR 已经有别的东西了（不是 Vibe Learning）。挪走它再运行一次。"
  fi
  same_dir() { [ -e "$2" ] && [ "$(cd "$1" && pwd -P)" = "$(cd "$2" && pwd -P)" ]; }
  can_git() { /usr/bin/xcode-select -p >/dev/null 2>&1 && command -v git >/dev/null 2>&1; }
  SRC="${VIBE_LEARNING_SOURCE:-}"
  if [ -z "$SRC" ] && [ -n "$HERE" ] && ! same_dir "$HERE" "$DIR"; then SRC="$HERE"; fi
  if [ -n "$SRC" ]; then
    [ -f "$SRC/serve.mjs" ] || fail "$SRC 里没有 Vibe Learning。"
    mkdir -p "$DIR"
    rsync -a --delete --exclude .git --exclude local "$SRC/" "$DIR/"
    echo "  从 $SRC 复制好了"
  elif [ -d "$DIR/.git" ] && can_git; then
    git -C "$DIR" pull --ff-only --quiet || fail "$DIR 里的文件改过，没法自动更新。用 git 自己合并一下，或者删掉这个文件夹再装。"
    echo "  更新好了"
  elif [ -n "$REPO" ] && [ ! -e "$DIR" ] && can_git; then
    git clone --quiet --depth 1 -b "$BRANCH" "https://github.com/$REPO.git" "$DIR" || fail "下载失败，看看网络（上 GitHub 要开代理的话，先打开代理）。"
    echo "  下载好了"
  elif [ -n "$REPO" ]; then
    # 没有 git（新 Mac 上常见）：下载压缩包
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" | tar -xz -C "$TMP" \
      || fail "下载失败，看看网络（上 GitHub 要开代理的话，先打开代理）。"
    GOT="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
    [ -f "$GOT/serve.mjs" ] || fail "下载下来的东西不对。"
    mkdir -p "$DIR"
    rsync -a --delete --exclude .git --exclude local "$GOT/" "$DIR/"
    echo "  下载好了"
  elif [ -f "$DIR/serve.mjs" ]; then
    echo "  没有找到新版（从新版的文件夹运行它的 install.sh 才会更新），只重新做图标、重启服务"
  else
    fail "不知道从哪里装。在下载好的 Vibe Learning 文件夹里运行：bash install.sh"
  fi

  # ---------- 3. Node ----------
  step "检查 Node"
  node_ok() { [ -x "$1" ] && [ "$("$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 18 ]; }
  NODE=""
  # VIBE_LEARNING_NODE_DOWNLOAD=1：测试用，不管有没有 Node 都下载一份
  if [ -z "${VIBE_LEARNING_NODE_DOWNLOAD:-}" ]; then
    for n in "$DATA/_node/bin/node" "$(command -v node 2>/dev/null || true)" /opt/homebrew/bin/node /usr/local/bin/node; do
      if [ -z "$NODE" ] && [ -n "$n" ] && node_ok "$n"; then NODE="$n"; fi
    done
  fi
  if [ -z "$NODE" ]; then
    case "$(uname -m)" in arm64) ARCH=arm64 ;; x86_64) ARCH=x64 ;; *) fail "不认识这台 Mac 的芯片：$(uname -m)" ;; esac
    TMPN="$(mktemp -d)"
    got=""
    # 官方源连不上时，换国内的镜像（内容一样，下面会对校验码）
    for base in "https://nodejs.org/dist/latest-v$NODE_MAJOR.x" "https://npmmirror.com/mirrors/node/latest-v$NODE_MAJOR.x"; do
      echo "  没有合适的 Node，从 $(echo "$base" | cut -d/ -f3) 下载一份（只给 Vibe Learning 用）"
      sums="$(curl -fsSL --retry 3 --retry-delay 2 --retry-all-errors --max-time 60 "$base/SHASUMS256.txt")" || continue
      file="$(printf '%s\n' "$sums" | awk -v a="darwin-$ARCH.tar.gz" '$2 ~ a"$" {print $2; exit}')"
      want="$(printf '%s\n' "$sums" | awk -v f="$file" '$2 == f {print $1; exit}')"
      [ -n "$file" ] && [ -n "$want" ] || continue
      curl -fsSL --retry 3 --retry-delay 2 --retry-all-errors --max-time 900 -o "$TMPN/$file" "$base/$file" || continue
      [ "$(shasum -a 256 "$TMPN/$file" | awk '{print $1}')" = "$want" ] || { echo "  校验码对不上，换一个源"; continue; }
      got="$TMPN/$file"; break
    done
    [ -n "$got" ] || fail "Node 下载失败，看看网络。也可以自己从 https://nodejs.org 装好 Node，再运行一次。"
    rm -rf "$DATA/_node"; mkdir -p "$DATA/_node"
    tar -xzf "$got" -C "$DATA/_node" --strip-components 1
    rm -rf "$TMPN"
    NODE="$DATA/_node/bin/node"
    node_ok "$NODE" || fail "Node 装上了却运行不了：$NODE"
  fi
  echo "  用这个：${NODE}（$("$NODE" -v)）"

  # ---------- 4. 图标、快捷方式、打开 ----------
  step "做图标，打开首页"
  "$NODE" "$DIR/setup.mjs"
}

main "$@"
