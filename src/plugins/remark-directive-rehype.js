import { h } from "hastscript";
import { visit } from "unist-util-visit";

//解析桥接 remark-directive 的节点，转换为自定义元素
export function parseDirectiveNode() {
	return (tree, file) => {
		visit(tree, (node) => {
			if (
				node.type === "containerDirective" || //块级容器
				node.type === "leafDirective" || //块级无子内容（叶子）
				node.type === "textDirective" //行内指令
			) {
				// biome-ignore lint/suspicious/noAssignInExpressions: <check later>
				const data = node.data || (node.data = {});
				node.attributes = node.attributes || {};
				if (
					node.children.length > 0 &&
					node.children[0].data &&
					node.children[0].data.directiveLabel
				) {
					// Add a flag to the node to indicate that it has a directive label
					node.attributes["has-directive-label"] = true;
				}
				const hast = h(node.name, node.attributes); //hastscript 创建一个虚拟DOM节点

				data.hName = hast.tagName; //之后会变成自定义元素名如 music
				data.hProperties = hast.properties; //→{id:"..."}
			}
		});
	};
}
