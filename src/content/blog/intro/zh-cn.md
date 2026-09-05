---
title: 首次部署博客
pubDate: 2026-09-06
description: 使用 cloudflare pages 部署博客
category: 技术
image: ""
draft: false
slugId: momo/intro/on
---
### 1.微调页面
简要熟悉主题的各种页面展示配置和相关语法，初步把内容改成了个人内容  
借助 AI 熟悉了一下项目结构。暑假的时候学过一点 React ＋ codex vibe 了个半成品前端，多少得心应手了一点，也终于感觉我的前置知识终于足够支撑我开始摸索和规划学习道路了  

不过实际上还不是很熟悉，大概了解了一下 astro 的结构，页面最终应该是路由到 src/pages 里，主要是学习了一下别人项目结构。数据驱动页面和文档驱动页面区别，选择场景  

还有文字部分，有好几层，大概是页面顶部/底部，写在 config.ts 里；博客的纯 markdown 就在 src/blog 里直接写，而且还有不知道从哪引入的特殊语法；页面小标题又写在i18n里，而且那个还管所有多语言切换的样式，目前还没分清具体分层依据  

组件和页面构成/样式定义还完全没研究，纯依赖模板本身效果(老实说本来就挺简洁漂亮的)  

大概这样，继续研究，可能之后还会改这篇

### 2.cloudflare pages 部署
这个就相对轻松很多了，注册cloudflare之后直接就用他的 work&pages 栏创建应用程序，直接选择部署 Pages 链到 Github 博客仓库，设置好  
- 生产构建 pnpm build
- 环境变量 NODE_VERSION=24 && PNPM_VERSION=11
- 项目名称  

就直接部署上线，免费域名即可访问了


---