/**
 * remarkNoHtml — a remark plugin that fails the build on any raw HTML in a post's Markdown.
 *
 * Refuses rather than sanitizes: a sanitizer is a second parser to get wrong, and a post has no
 * business with HTML (the shell, the blocks and the door are the build's). Code spans and fenced code
 * are not HTML nodes, so `<script>` shown as code is fine.
 *
 * It also refuses a Markdown image (`![alt](src)`): a post's one picture is the `image` front-matter field,
 * which the schema holds to the image directory and which carries its alt text, source and licence, and the
 * template prints it as a figure with a caption. A body image would bypass all three.
 *
 * This does NOT cover Markdown-native URLs: `[x](javascript:…)` and `![x](data:…)` are not HTML nodes
 * and render as live `href`/`src`. The page gate in `ci/content-rules.mjs` (`isSafeHref`, root-relative
 * images) is what stops those; do not remove it believing this plugin covers them.
 */

/** @returns {(tree: any, file: any) => void} */
export function remarkNoHtml() {
  return (tree, file) => {
    const walk = (node) => {
      if (node.type === "html") {
        const line = node.position?.start?.line;
        const where = file?.path ? ` in ${file.path}` : "";
        throw new Error(`raw HTML in a blog post's Markdown${where}${line ? ` at line ${line}` : ""}: ${JSON.stringify(String(node.value).slice(0, 60))}. Posts are Markdown only.`);
      }
      if (node.type === "image" || node.type === "imageReference") {
        const line = node.position?.start?.line;
        const where = file?.path ? ` in ${file.path}` : "";
        throw new Error(`a Markdown image in a blog post${where}${line ? ` at line ${line}` : ""}. A post's picture is the \`image\` front-matter field (alt text, source and licence), not a body image.`);
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}
