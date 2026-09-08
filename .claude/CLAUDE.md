# 读取BLOG结构
@cms/AGENT.md


## 语言要求
- 所有对话使用中文回答
- 所有输出文档使用中文编写
- 所有代码注释使用中文

## 内容约定
- 文章在 src/content/blog/<slug>/ 下,每篇含 zh-cn.md + en.md 双语版本
- frontmatter 必需:title / pubDate / description / category / image / slugId / draft
- slugId 与文件夹路径解耦;手写文章改了 slug 保存时不会移动文件夹(CMS 新建的才会)

## Git 约定
- 提交信息用中文 conventional commits(feat:/fix:/chore: + 中文描述)
- 发布类提交格式:feat: 发布 v<版本> 版本
