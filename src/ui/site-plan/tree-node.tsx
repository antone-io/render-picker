import type { FC } from "react";

import { MUTED, PRIMARY } from "../../core/inspector/constants/theme";
import type { PageTreeNode } from "../../core/source/site-plan";

export interface TreeNodeProps {
  node: PageTreeNode;
}

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Un segment de l'arbre des pages : le segment d'URL, le titre de la page en lien s'il y
 * en a une à cet endroit, puis ses enfants indentés. */
export const TreeNode: FC<TreeNodeProps> = ({ node }) => (
  <li style={{ listStyle: "none" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "2px 0" }}>
      <span style={{ color: MUTED, fontFamily: mono, fontSize: 11 }}>{node.segment}</span>
      {node.row && (
        <a href={node.row.url} style={{ color: PRIMARY, fontWeight: 600, textDecoration: "none" }}>
          {node.row.label}
        </a>
      )}
    </div>
    {node.children.length > 0 && (
      <ul style={{ margin: 0, paddingLeft: 16, borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
        {node.children.map((child) => (
          <TreeNode key={child.segment} node={child} />
        ))}
      </ul>
    )}
  </li>
);
