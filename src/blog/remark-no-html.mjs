/**
 * remarkNoHtml — a remark plugin that fails the build on any raw HTML in a post's Markdown.
 *
 * Refuses rather than sanitizes: a sanitizer is a second parser to get wrong, and a post has no
 * business with HTML (the shell, the blocks and the door are the build's). Code spans and fenced code
 * are not HTML nodes, so `<script>` shown as code is fine. The page gate in `ci/content-rules.mjs`
 * still checks the rendered output; this stops the input.
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
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}
