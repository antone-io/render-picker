import type { FC } from "react";

import { HOVER_BG, MUTED, PRIMARY } from "../../core/inspector/constants/theme";
import { shortUrl, type PlanRow as PlanRowData } from "../../core/source/site-plan";

export interface PlanRowProps {
  row: PlanRowData;
}

/** Une page du plan : titre cliquable (même onglet), chemin cliquable (nouvel onglet), puis
 * ses modules en pastilles. */
export const PlanRow: FC<PlanRowProps> = ({ row }) => (
  <li style={{ listStyle: "none", padding: "6px 8px", borderRadius: 6 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
      <a
        href={row.url}
        style={{ color: PRIMARY, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.textDecoration = "underline";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.textDecoration = "none";
        }}
      >
        {row.label}
      </a>
      <a
        href={row.url}
        target="_blank"
        rel="noopener"
        title="Ouvrir dans un nouvel onglet"
        style={{
          color: MUTED,
          fontSize: 11,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textDecoration: "underline",
        }}
      >
        {shortUrl(row.url)}
      </a>
      {row.error !== null && (
        <span style={{ color: MUTED, fontSize: 11, whiteSpace: "nowrap" }}>
          (erreur HTTP {row.error || "réseau"})
        </span>
      )}
    </div>
    {row.modules.length > 0 && (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
        {row.modules.map((mod) => (
          <span
            key={mod}
            style={{
              padding: "1px 6px",
              borderRadius: 4,
              background: HOVER_BG,
              color: MUTED,
              fontSize: 10,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {mod}
          </span>
        ))}
      </div>
    )}
  </li>
);
