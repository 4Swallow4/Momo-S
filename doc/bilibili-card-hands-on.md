# B 站卡片：对着你现在的文件改完

> 本文件是**操作单**，不是我替你改代码。你打开对应文件，按 Task 从上到下改。
>
> 行号以你此刻仓库为准。若你先插了几行，后面行号会漂，**以「搜这段原文」为准**。
>
> 当前进度：插件已改名、DOM 骨架和 class 已换成 bili；**API 还是网易云**；CSS 只写了外框；**还没注册**到 `astro.config.mjs`。

---

## 0. 你现在的文件状态

| 文件 | 状态 |
|---|---|
| `src/plugins/rehype-component-bilibili-card.mjs` | 骨架完成，**第 42、58 行仍在请求网易云** |
| `src/styles/markdown.css` 481–500 行 | 只有 `.card-bilibili` 外框和 hover，**内部封面/标题/UP 样式还没有** |
| `astro.config.mjs` | **未注册** `bilibili` → 现在写 `::bilibili` 也不会出卡 |
| CMS 三处 | 未做（博客跑通后再做） |

目标语法：

```md
::bilibili{id="BV1xx411c7mD"}
::bilibili{id="av2"}
::bilibili{id="2"}
```

卡片：和音乐卡一样的条；标题 + `UP：作者名`；封面；整卡点进 B 站。

---

## Task A — 插件：修残留 + 解析 id + 外链

文件：`src/plugins/rehype-component-bilibili-card.mjs`  
函数：`BilibiliCardComponent(properties, children)`（第 12 行开始）  
这是 rehype-components 在编译 Markdown 时调用的**唯一入口**。`properties.id` 就是 `{id="..."}` 里的值。

### A1. 第 15 行 — 复制残留的报错文案

**现在：**

```js
'Invalid directive. ("music" directive must be leaf type "::bilibili{id="videoId"}")',
```

**改成：**

```js
'Invalid directive. ("bilibili" directive must be leaf type "::bilibili{id="videoId"}")',
```

**这是什么：** 作者误写成 `:::bilibili`（带正文的容器）时，组件拒绝渲染，丢一个 `hidden` 的 div。  
**起什么作用：** 防止错误语法撑出乱 DOM。只改字，逻辑不用动。

---

### A2. 第 25 行后面 — 新增「解析 AV / BV」（API 和外链都靠它）

**位置：** `const videoId = properties.id;` **这一行留着**，在它和 `const cardUuid` 之间插入解析。

**现在（25–26 行）：**

```js
    const videoId = properties.id;
    const cardUuid = `BC${Math.random().toString(36).slice(-6)}`;
```

**改成：**

```js
    const videoId = String(properties.id).trim();
    const isBv = /^bv/i.test(videoId);
    const isAvPrefix = /^av/i.test(videoId);
    const isAid = /^\d+$/.test(videoId);
    if (!isBv && !isAvPrefix && !isAid) {
        return h("div", { class: "hidden" }, 'Invalid video id. (use BV… / av… / 纯数字)');
    }
    // 官方接口的 aid 不能带 "av" 前缀；BV 保持原样
    const apiKind = isBv ? "bv" : "av";
    const apiValue = isBv ? videoId : (isAvPrefix ? videoId.slice(2) : videoId);
    if (!/^[A-Za-z0-9]+$/.test(apiValue)) {
        return h("div", { class: "hidden" }, 'Invalid video id characters.');
    }
    const watchUrl = isBv
        ? `https://www.bilibili.com/video/${videoId}`
        : `https://www.bilibili.com/video/av${apiValue}`;
    // 先用保罗接口（浏览器可跨域）。官方接口见本文件末尾「备用」
    const apiUrl = apiKind === "bv"
        ? `https://api.paugram.com/bili/?bv=${apiValue}`
        : `https://api.paugram.com/bili/?av=${apiValue}`;
    const cardUuid = `BC${Math.random().toString(36).slice(-6)}`;
```

**这是什么 / 在哪个函数：** 仍在 `BilibiliCardComponent` 里、**还没拼 DOM 之前**。这是 Node 构建期代码，不是浏览器。

| 变量 | 作用 |
|---|---|
| `isBv` / `isAvPrefix` / `isAid` | 三种作者写法：`BV…`、`av2`、`2` |
| `apiKind` + `apiValue` | 送给 API 的参数。`av2` → kind=av, value=`2` |
| 字符白名单 | `apiValue` 稍后会插进 `<script>` 字符串，只许字母数字，避免弄坏 JS |
| `watchUrl` | 卡片 `<a href>`。纯数字 `2` 必须变成 `/video/av2`，你现在第 95 行写成 `/video/2` 是错的 |
| `apiUrl` | 一会儿塞进浏览器脚本的 `fetch(...)`。**在这里算好**，脚本里就不用再解析一遍 |

**为什么不在浏览器里解析：** 模板字符串 `${videoId}` 已经在构建时展开。构建期算好 `apiUrl` / `watchUrl`，脚本更短、也更安全。

---

### A3. 第 95 行 — 外链改用 `watchUrl`

**现在：**

```js
            href: `https://www.bilibili.com/video/${videoId}`,
```

**改成：**

```js
            href: watchUrl,
```

**这是什么：** 根节点 `h("a#…-card", { href, target, rel })` 的链接。  
**起什么作用：** 整张卡可点击、新标签打开 B 站。这就是「有外链」，没有 `onclick`。  
**在哪个函数：** 还是 `BilibiliCardComponent` 的 `return h(...)`。

`target` / `rel` / `class: "card-bilibili fetch-waiting no-styling"` 不要动。

---

## Task B — 插件：把网易云 fetch 换成 B 站（你卡在的 API 步）

文件还是 `rehype-component-bilibili-card.mjs`  
位置：第 32–87 行 `const nScript = h("script", …)`  
函数：表面上在 `BilibiliCardComponent` 里，但 **`nScript` 的第三个参数是字符串**，这个字符串会原样进页面，由**浏览器**执行。

两层不要混：

- 外层（Node）：`` `${cardUuid}` `` `${apiUrl}` 现在就会被替换成真实值
- 内层（浏览器）：`fetch` / `getElementById` / `innerText`

### B1. 第 37、84、85 行 — 函数名残留

**搜：** `initMusicCard`  
**全部改成：** `initBiliCard`（三处：定义、立即调用、`astro:page-load`）

**这是什么：** 浏览器里真正拉数据的函数。  
**起什么作用：**

1. 定义后立刻跑一次（普通刷新）
2. 再监听 `astro:page-load`（Astro 切页时普通 script 不重跑，必须靠这个事件）

不改名也能跑，但日志/阅读会晕。

---

### B2. 第 42–75 行 — 整段 fetch 换成一次 B 站请求

**现在（还在打网易云，必须整段换掉）：**

```js
                fetch('https://open.motues.top/music?server=netease&type=details&id=${videoId}', { referrerPolicy: "no-referrer" })
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.id) {
                            // 更新标题
                            const titleEl = document.getElementById('${cardUuid}-title');
                            if (titleEl) titleEl.innerText = data.name || "未知曲目";
                            
                            // 更新艺术家
                            const artistEl = document.getElementById('${cardUuid}-artist');
                            const artistName = Array.isArray(data.artist) ? data.artist.join(', ') : (data.artist || '未知艺术家');
                            if (artistEl) artistEl.innerText = artistName;
                            
                            // 更新封面 - 先获取封面 URL
                            const coverEl = document.getElementById('${cardUuid}-cover');
                            if (coverEl) {
                                fetch('https://open.motues.top/music?server=netease&type=cover&id=${videoId}', { referrerPolicy: "no-referrer" })
                                    .then(res => res.json())
                                    .then(coverData => {
                                        if (coverData && coverData.url) {
                                            coverEl.style.backgroundImage = 'url(' + coverData.url + ')';
                                            coverEl.style.backgroundColor = 'transparent';
                                        }
                                    })
                                    .catch(err => {
                                        console.warn("[BILI-CARD] Error loading cover:", err);
                                    });
                            }

                            // 移除等待状态并加锁
                            card.classList.remove("fetch-waiting");
                            card.dataset.loaded = "true";
                            console.log("[BILIBILI-CARD] Loaded: ${videoId}");
                        }
                    })
```

**改成（只换这一段，它外面的 `if (!card || …) return;` 和后面的 `.catch` 都留着）：**

```js
                fetch('${apiUrl}', { referrerPolicy: "no-referrer" })
                    .then(response => response.json())
                    .then(data => {
                        console.log("[BILI-CARD] raw", data);
                        // 官方接口是 { code, data: { title, pic, owner } }
                        // 保罗接口是扁平 { title, author, pic/cover }
                        const info = data.data || data;
                        const title = info && info.title;
                        const up = (info && info.owner && info.owner.name) || (info && info.author);
                        const pic = info && (info.pic || info.cover);
                        if (title) {
                            const titleEl = document.getElementById('${cardUuid}-title');
                            if (titleEl) titleEl.innerText = title;

                            const artistEl = document.getElementById('${cardUuid}-artist');
                            if (artistEl) artistEl.innerText = up ? ('UP：' + up) : 'UP：未知';

                            const coverEl = document.getElementById('${cardUuid}-cover');
                            if (coverEl && pic) {
                                const picUrl = String(pic).replace(/^http:\/\//, 'https://');
                                coverEl.style.backgroundImage = 'url(' + picUrl + ')';
                                coverEl.style.backgroundColor = 'transparent';
                            }

                            card.classList.remove("fetch-waiting");
                            card.dataset.loaded = "true";
                            console.log("[BILI-CARD] Loaded: ${videoId}");
                        } else {
                            throw new Error("no title in response");
                        }
                    })
```

**逐段是什么：**

| 代码 | 在哪执行 | 作用 |
|---|---|---|
| `` fetch('${apiUrl}', …) `` | 浏览器 | `${apiUrl}` 构建期已展开。一次请求同时拿标题/UP/封面（音乐卡要两次是因为网易云 API 拆开了） |
| `referrerPolicy: "no-referrer"` | 浏览器 | 不带当前博客地址当 Referer，减少防盗链/隐私问题，和音乐卡相同 |
| `.then(response => response.json())` | 浏览器 | HTTP 体 → 对象 |
| `const info = data.data \|\| data` | 浏览器 | 适配两种 JSON 形状，避免换接口时再改一遍 DOM 赋值 |
| `titleEl.innerText = title` | 浏览器 | 填第 29 行预埋的 `#BC…-title`（class `bili-title`） |
| `'UP：' + up` | 浏览器 | 填第 30 行 `#BC…-artist`。class 仍叫 artist，只是显示成 UP |
| `coverEl.style.backgroundImage` | 浏览器 | 封面是 `div` 不是 `<img>`，和音乐卡一样用背景图，方便圆角 |
| `http` → `https` | 浏览器 | B 站 `pic` 经常是 `http://i0.hdslb.com/...`，页面若是 https 会混合内容拦截 |
| `classList.remove("fetch-waiting")` | 浏览器 | 去掉等待态（目前没单独写 waiting 样式，但和音乐卡对齐） |
| `dataset.loaded = "true"` | 浏览器 | 幂等锁。配合第 40 行，避免 `astro:page-load` 再 fetch 一次 |
| `throw` → 落到第 77 行 `.catch` | 浏览器 | 给卡片加 `fetch-error`（红底），和音乐卡失败态一样 |

**不要删：**

- 第 38–40 行：找卡 + `dataset.loaded` 早退
- 第 77–81 行：`.catch` 加 `fetch-error`

**占位文字（可选，第 29–30 行）：** `"Waiting for API..."` / `"Waiting..."` 可改成 `"Waiting for Bilibili..."`，不影响功能。

---

### B3. 改完后，这段 script 在整张卡里的位置

`return h("a", …, [ 内层 .bili-card, nScript ])`

script 是 `<a>` 的子节点。页面有这张卡，就会带上这段 JS。CMS 预览 iframe 开了 `allow-scripts`，同样会跑。

---

## Task C — 注册到博客管线（不注册 = 永远没卡）

文件：`astro.config.mjs`  
作用：告诉 `rehype-components`：HAST 里遇到标签名 `bilibili`，就调用你的函数。

### C1. 第 13 行下面加 import

**现在：**

```js
import { MusicCardComponent } from "./src/plugins/rehype-component-music-card.mjs";
import { GithubCardComponent } from './src/plugins/rehype-component-github-card.mjs';
```

**在 Music 那行下面插入：**

```js
import { BilibiliCardComponent } from "./src/plugins/rehype-component-bilibili-card.mjs";
```

**这是什么：** ESM 导入。`export function BilibiliCardComponent` 对上这里的名字。

### C2. 第 70–71 行 `components` 表加一项

**现在：**

```js
            components: {
              github: GithubCardComponent,
              music: MusicCardComponent,
              quote: QuoteComponent,
```

**改成（music 旁边加一行）：**

```js
            components: {
              github: GithubCardComponent,
              music: MusicCardComponent,
              bilibili: BilibiliCardComponent,
              quote: QuoteComponent,
```

**这是什么：** 映射表。左边 `bilibili` 必须等于 Markdown 的 `::bilibili`。  
**起什么作用：** `parseDirectiveNode` 已经把指令变成 `<bilibili id="...">`，这里把它换成你拼的 `<a class="card-bilibili">`。  
**写错 key**（例如写成 `bili:`）→ 页面上是未知标签，CSS 全对也看不见卡。

改完 **重启** `pnpm dev`（动了 `astro.config.mjs`）。

---

## Task D — 补完博客 CSS（你只写了外框）

文件：`src/styles/markdown.css`  
**现在：** 481–500 行有 `.card-bilibili` 和 `:hover`，501 行空行后直接 GitHub。  
内部 class 你插件里已经在用：`.bili-card` `.bili-cover-wrapper` `.bili-cover` `.bili-info` `.bili-header` `.bili-title` `.bili-artist` —— **CSS 还没有，所以现在即使 DOM 出来也没有左图右文。**

**位置：** 第 500 行 `.card-bilibili:hover { … }` 的 `}` 后面、第 503 行 `/* GitHub Card Styles */` 前面，插入下面整段。  
数字和音乐卡相同，不要改 400/12/80/8/0.8s。

```css
.bili-card {
    display: flex;
    padding: 16px;
    gap: 16px;
    align-items: center;
}

.bili-cover-wrapper {
    width: 80px;
    height: 80px;
    flex-shrink: 0;
    position: relative;
}

.bili-cover {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    background-size: cover;
    background-position: center;
    background-color: var(--button-hover-color);
    transition: all 0.3s ease;
}

.bili-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.bili-header {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.bili-title {
    font-weight: 600;
    color: var(--text-color);
    font-size: 1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bili-artist {
    color: var(--text-color-70);
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

[data-theme="dark"] .bili-title {
    color: #ffffff;
}

[data-theme="dark"] .bili-artist {
    color: #aaa;
}
```

**每一块干什么：**

| 选择器 | 作用 |
|---|---|
| `.bili-card` | 内层 flex：左封面右字。伪元素 logo 也挂在这个节点上 |
| `.bili-cover-wrapper` | 锁死 80×80，`flex-shrink:0` 防止被长标题挤扁 |
| `.bili-cover` | 封面 div；`background-size:cover` 对应 JS 设的 `backgroundImage`；没图时用 `--button-hover-color` 当灰底 |
| `.bili-info` | `flex:1; min-width:0` 让省略号生效（flex 子项默认 min-width:auto，不写这个会撑破卡） |
| `.bili-title` / `.bili-artist` | 字重/字号/颜色/单行省略，对标音乐卡标题和歌手 |
| `[data-theme="dark"]` | 暗色下标题纯白、UP 灰色 |

`.fetch-error` 和 `.no-styling` **不要再写**，文件里 471 行和后面 GitHub 段落后面已经有了。

### D2. 右上角 B 站 logo（可先跳过，空角落也能跑）

仍插在 `.bili-card { … }` **后面**。对标音乐卡 `.music-card::before`（markdown.css 413–429 行）。

定位参照的是外层 `.card-bilibili { position: relative }`（你已写在 493 行），不是 `.bili-card` 自己。

```css
.bili-card::before {
    content: "";
    position: absolute;
    top: 15px;
    right: 15px;
    width: 24px;
    height: 24px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300A1D6'%3E%3Cpath d='M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.868c0-.308.104-.575.312-.801.208-.226.462-.339.754-.339.304 0 .56.104.769.312L9.653 4.62h4.693l2.964-2.784c.207-.208.462-.312.769-.312.29 0 .546.113.754.339s.312.493.312.801c0 .192-.038.355-.113.489-.075.134-.18.254-.312.361zm.854 2.346H5.333c-.73.018-1.337.256-1.819.713-.482.458-.733 1.04-.754 1.747v7.467c.018.707.272 1.29.754 1.747.482.457 1.089.695 1.819.713h13.334c.73-.018 1.337-.256 1.819-.713.482-.457.733-1.04.754-1.747V9.36c-.018-.708-.272-1.29-.754-1.747-.482-.457-1.089-.695-1.819-.713zM8 11.333c.373 0 .684.124.933.373.25.249.373.562.373.934v1.813c0 .373-.124.687-.373.936-.249.25-.56.374-.933.374s-.687-.125-.936-.374c-.25-.249-.373-.563-.373-.936v-1.813c0-.372.124-.685.373-.934.249-.249.563-.373.936-.373zm8 0c.373 0 .683.124.933.373.25.249.373.562.373.934v1.813c0 .373-.123.687-.373.936-.25.25-.56.374-.933.374s-.687-.125-.936-.374c-.25-.249-.373-.563-.373-.936v-1.813c0-.372.123-.685.373-.934.249-.249.563-.373.936-.373z'/%3E%3C/svg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    z-index: 2;
}

[data-theme="dark"] .bili-card::before {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23008BB0'%3E%3Cpath d='M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.868c0-.308.104-.575.312-.801.208-.226.462-.339.754-.339.304 0 .56.104.769.312L9.653 4.62h4.693l2.964-2.784c.207-.208.462-.312.769-.312.29 0 .546.113.754.339s.312.493.312.801c0 .192-.038.355-.113.489-.075.134-.18.254-.312.361zm.854 2.346H5.333c-.73.018-1.337.256-1.819.713-.482.458-.733 1.04-.754 1.747v7.467c.018.707.272 1.29.754 1.747.482.457 1.089.695 1.819.713h13.334c.73-.018 1.337-.256 1.819-.713.482-.457.733-1.04.754-1.747V9.36c-.018-.708-.272-1.29-.754-1.747-.482-.457-1.089-.695-1.819-.713zM8 11.333c.373 0 .684.124.933.373.25.249.373.562.373.934v1.813c0 .373-.124.687-.373.936-.249.25-.56.374-.933.374s-.687-.125-.936-.374c-.25-.249-.373-.563-.373-.936v-1.813c0-.372.124-.685.373-.934.249-.249.563-.373.936-.373zm8 0c.373 0 .683.124.933.373.25.249.373.562.373.934v1.813c0 .373-.123.687-.373.936-.25.25-.56.374-.933.374s-.687-.125-.936-.374c-.25-.249-.373-.563-.373-.936v-1.813c0-.372.123-.685.373-.934.249-.249.563-.373.936-.373z'/%3E%3C/svg%3E");
}
```

`fill='%2300A1D6'` 是 B 站蓝（`#00A1D6`，`%23` = `#`）。这是 CSS 伪元素，**插件 DOM 不用加 logo 节点**。

---

## Task E — 文章里写一行并跑

文件：`src/content/blog/first_blog/zh-cn.md`  
**位置：** 第 15 行 `::music{id="2727720014"}` 下面另起一行：

```md
::bilibili{id="BV1xx411c7mD"}
```

把 `BV1xx411c7mD` 换成你浏览器地址栏里真实的 BV（或 `av2` / `2`）。不要编造。

然后：

```bash
pnpm dev
```

打开这篇文章。

**成功：** 和音乐卡并排两条；B 站卡先 Waiting 再出标题/`UP：`/封面；hover 有阴影；点击新标签打开视频。  
**Console：** 应有 `[BILI-CARD] raw …` 和 `Loaded:`。

**失败对照：**

| 现象 | 查 |
|---|---|
| 完全没有卡 | Task C 的 key 是否 `bilibili`；是否重启 dev；语法是否单独一行 |
| 有框无左图右文 | Task D 内部 class 是否漏粘 |
| 一直 Waiting | Network 看 `api.paugram.com` 是否 200；Console 是否 CORS；把 raw JSON 发出来对字段 |
| 有字封面裂 | `pic` 是否仍是 `http://` |
| 点进去 404 | Task A3 是否用了 `watchUrl`；纯数字是否变成 `/video/av…` |
| 像蓝色下划线链接 | 根节点 class 是否仍有 `no-styling` |

保罗接口挂了时，把 Task A2 的 `apiUrl` 改成官方（**浏览器常 CORS 失败**，只作对照）：

```js
    const apiUrl = apiKind === "bv"
        ? `https://api.bilibili.com/x/web-interface/view?bvid=${apiValue}`
        : `https://api.bilibili.com/x/web-interface/view?aid=${apiValue}`;
```

官方成功时 JSON 在 `data.data.title` / `data.data.owner.name` / `data.data.pic`。Task B2 的 `info = data.data || data` 两种都能吃。

---

## Task F — CMS（博客能跑后再做）

改 `cms/server/` 必须重启 `pnpm cms`（服务端不走 HMR，见 `cms/AGENT.md`）。

### F1. `cms/server/preview.mjs`

**第 28 行下面插 import：**

```js
import { BilibiliCardComponent } from '../../src/plugins/rehype-component-bilibili-card.mjs'
```

**第 128 行 `music: MusicCardComponent,` 旁边：**

```js
        bilibili: BilibiliCardComponent,
```

**这是什么：** CMS 预览自己有一条 unified 管线，**不会**读 `astro.config.mjs`。组件函数同一份，注册必须写第二次。

### F2. `cms/server/prose.css` 文件末尾（第 336 行后）

CMS 变量名是 `--border / --link / --text-sub`，不要抄博客的 `--button-border-color`。

```css
/* B 站卡片 */
.markdown-content .card-bilibili {
  display: block;
  max-width: 400px;
  margin: 1.5rem auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  text-decoration: none;
  color: var(--text);
  background: var(--bg);
}
.markdown-content .card-bilibili:hover { border-color: var(--link); }
.markdown-content .bili-card { display: flex; gap: 1rem; padding: 1rem; }
.markdown-content .bili-cover-wrapper { flex-shrink: 0; }
.markdown-content .bili-cover {
  width: 72px; height: 72px; border-radius: 8px;
  background: var(--code-bg); background-size: cover;
}
.markdown-content .bili-info { display: flex; flex-direction: column; justify-content: center; }
.markdown-content .bili-title { font-weight: 600; }
.markdown-content .bili-artist { font-size: 0.85em; color: var(--text-sub); }
```

选择器必须带 `.markdown-content`，和上面音乐卡 315–335 行同一约定。

### F3. `cms/src/pages/EditorPage.ts` 第 118 行后面

函数：`createToolbar()`。只负责往 textarea **插入语法**，不渲染卡片。

```ts
    btn({ label: 'B站', title: 'B站视频卡片 ::bilibili{id="BV号或av号"}', template: '::bilibili{id="{cur}BVxxxxxx"}' }),
```

`{cur}` = 插入后光标位置。

### F4. `cms/AGENT.md` 第 77 行表里加一行

```md
| `::bilibili{id="av号或BV号"}` | B站视频卡片 |
```

---

## 验收（做完自己勾）

- [ ] `::bilibili{id="真实BV"}` 单独一行能出卡
- [ ] 标题和 `UP：作者名` 不是 Waiting
- [ ] 左侧有封面
- [ ] 整卡点击 → 新标签 B 站对应视频
- [ ] hover：边框变色 + 阴影，不上浮
- [ ] 和旁边音乐卡同宽、同圆角、同 80×80 封面
- [ ] `id="av数字"` 和 `id="纯数字"` 也能跳到 `/video/av…`
- [ ] CMS 预览能出卡（F 做完并重启后）

---

## 这些改动在整条链上的位置（做完再看）

```
.md  ::bilibili{id="BV…"}
        │  remark-directive 认出 leaf 指令（已有，不用改）
        ▼
parseDirectiveNode  →  HAST <bilibili id="BV…">
        │  astro.config.mjs components.bilibili = 你的函数  ← Task C
        ▼
BilibiliCardComponent(properties, children)      ← Task A/B 你正在改的函数
        │  构建期：校验、解析 AV/BV、算出 watchUrl / apiUrl
        │  产出：<a href=watchUrl> 骨架 + <script>fetch(apiUrl)</script>
        ▼
浏览器：initBiliCard → 填 title / UP / cover
markdown.css：.card-bilibili / .bili-* 画成和音乐卡一样      ← Task D
```

依赖都已在项目里：`remark-directive`、`rehype-components`、`hastscript`。不要 `pnpm add`。

---

改完 Task A+B+C+D+E 后，把现象（出卡 / CORS / 没有卡）和下一条 Console 原文记下。CMS 放到博客成功之后。
