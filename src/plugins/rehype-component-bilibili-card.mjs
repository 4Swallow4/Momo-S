/// <reference types="mdast" />
import { h } from "hastscript";
import { visit } from "unist-util-visit";

/**
 * 解析 ::bilibili{id}：BV… / av123 / 123
 * @param {unknown} raw
 * @returns {{ apiKind: "bv" | "av", apiValue: string, watchUrl: string, videoId: string } | null}
 */
function parseBiliId(raw) {
    if (raw == null) return null;
    const videoId = String(raw).trim();
    const isBv = /^bv/i.test(videoId);
    const isAvPrefix = /^av/i.test(videoId);
    const isAid = /^\d+$/.test(videoId);
    if (!isBv && !isAvPrefix && !isAid) return null;
    const apiKind = isBv ? "bv" : "av";
    const apiValue = isBv ? videoId : isAvPrefix ? videoId.slice(2) : videoId;
    if (!/^[A-Za-z0-9]+$/.test(apiValue)) return null;
    const watchUrl = isBv
        ? `https://www.bilibili.com/video/${videoId}`
        : `https://www.bilibili.com/video/av${apiValue}`;
    return { apiKind, apiValue, watchUrl, videoId };
}

/**
 * 构建期 Node 请求（避开浏览器 CORS）。
 * 保罗 /bili 现已返回 HTML；官方接口常 412。uapis 无 Origin 时可用。
 */
async function fetchBiliInfo(parsed) {
    const urls =
        parsed.apiKind === "bv"
            ? [
                  `https://uapis.cn/api/v1/social/bilibili/videoinfo?bvid=${parsed.apiValue}`,
                  `https://api.bilibili.com/x/web-interface/view?bvid=${parsed.apiValue}`,
              ]
            : [
                  `https://uapis.cn/api/v1/social/bilibili/videoinfo?aid=${parsed.apiValue}`,
                  `https://api.bilibili.com/x/web-interface/view?aid=${parsed.apiValue}`,
              ];

    for (const url of urls) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 8000);
        try {
            const res = await fetch(url, {
                signal: ac.signal,
                headers: {
                    accept: "application/json",
                    "user-agent": "Mozilla/5.0 (compatible; MomoBlog/1.0)",
                },
            });
            if (!res.ok) continue;
            const data = await res.json();
            const info = data?.data && data.data.title ? data.data : data;
            if (!info?.title) continue;
            const pic = String(info.pic || info.cover || "").replace(/^http:\/\//, "https://");
            return {
                title: info.title,
                up: info.owner?.name || info.author || "",
                pic,
            };
        } catch {
            /* 试下一个源 */
        } finally {
            clearTimeout(timer);
        }
    }
    return null;
}

/**
 * unified 插件工厂（和 customFigurePlugin 一样：配置里写名字，不要加 ()）。
 * 必须排在 rehype-components 之前。
 * 在这里 await 拉数据，并直接换成卡片 HAST，避免把对象挂在 properties 上被丢掉。
 */
export function rehypeBilibiliPrefetch() {
    return async (tree) => {
        const targets = [];
        visit(tree, "element", (node, index, parent) => {
            if (node.tagName === "bilibili" && parent && typeof index === "number") {
                targets.push({ node, index, parent });
            }
        });
        const cards = await Promise.all(
            targets.map(async ({ node }) => {
                const parsed = parseBiliId(node.properties?.id);
                const info = parsed ? await fetchBiliInfo(parsed) : null;
                return BilibiliCardComponent(
                    { ...node.properties, _bili: info },
                    node.children || [],
                );
            }),
        );
        targets.forEach((target, i) => {
            target.parent.children[target.index] = cards[i];
        });
    };
}

/**
 * 同步画卡。rehype-components 的 `bilibili:` 映射仍指向这里，作为 prefetch 未跑时的兜底。
 *
 * @param {Object} properties
 * @param {string} properties.id
 * @param {{ title?: string, up?: string, pic?: string } | null} [properties._bili]
 * @param {import('mdast').RootContent[]} children
 */
export function BilibiliCardComponent(properties, children) {
    if (Array.isArray(children) && children.length !== 0)
        return h("div", { class: "hidden" }, [
            'Invalid directive. ("bilibili" directive must be leaf type "::bilibili{id="videoId"}")',
        ]);

    if (!properties?.id)
        return h(
            "div",
            { class: "hidden" },
            'Invalid video id. ("id" attribute must be provided)',
        );

    const parsed = parseBiliId(properties.id);
    if (!parsed) {
        return h(
            "div",
            { class: "hidden" },
            "Invalid video id. (use BV… / av… / 纯数字)",
        );
    }

    const { videoId, watchUrl } = parsed;
    const info = properties._bili || null;
    const cardUuid = `BC${Math.random().toString(36).slice(-6)}`;
    const pic = info?.pic ? String(info.pic).replace(/[)"']/g, "") : "";

    const nCover = h(`div#${cardUuid}-cover`, {
        class: "bili-cover",
        style: pic
            ? `background-image:url("${pic}");background-color:transparent`
            : undefined,
    });
    const nTitle = h(
        `div#${cardUuid}-title`,
        { class: "bili-title" },
        info?.title || videoId,
    );
    const nArtist = h(
        `div#${cardUuid}-artist`,
        { class: "bili-artist" },
        info?.up ? `UP：${info.up}` : "UP：",
    );

    return h(
        `a#${cardUuid}-card`,
        {
            class: `card-bilibili no-styling${info ? "" : " fetch-error"}`,
            "data-video-id": videoId,
            href: watchUrl,
            target: "_blank",
            rel: "noopener noreferrer",
        },
        [
            h("div", { class: "bili-card" }, [
                h("div", { class: "bili-cover-wrapper", id: `${cardUuid}-cover-wrapper` }, [
                    nCover,
                ]),
                h("div", { class: "bili-info" }, [
                    h("div", { class: "bili-header" }, [nTitle, nArtist]),
                ]),
            ]),
        ],
    );
}
