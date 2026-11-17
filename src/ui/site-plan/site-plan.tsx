import { useEffect, useMemo, useState, type FC } from "react";
import { createPortal } from "react-dom";

import { IGNORE_ATTR } from "../../core/inspector/constants/behavior";
import { UI_Z } from "../../core/inspector/constants/picker";
import { CARD_SHADOW, MUTED, PANEL_BORDER, SECONDARY_BORDER, SOLID_BG } from "../../core/inspector/constants/theme";
import {
  buildPageTree,
  buildSitePlan,
  pageTreeText,
  sitePlanMarkdown,
  sortPlan,
  type PlanRow as PlanRowData,
  type SitePlan as SitePlanData,
} from "../../core/source/site-plan";
import { CopyIcon, GitBranchIcon } from "../icons";
import { PlanRow } from "./plan-row";
import { TreeNode } from "./tree-node";

export interface SitePlanProps {
  /** URL de l'index des pages (`window.renderPickerPagesUrl`, contrôleur `pages` du module). */
  indexUrl: string;
  onClose: () => void;
  /** Appelé après une copie (Markdown ou arbre), avec le message du toast. */
  onCopied?: (message: string) => void;
}

type LoadState =
  | { status: "loading"; done: number; total: number }
  | { status: "error" }
  | { status: "ready"; plan: SitePlanData };

const matches = (row: PlanRowData, q: string) =>
  row.label.toLowerCase().includes(q) ||
  row.url.toLowerCase().includes(q) ||
  row.modules.some((m) => m.toLowerCase().includes(q));

type View = "list" | "tree";

const headerButton = (active = false) =>
  ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 6,
    color: "#fff",
    background: active ? "rgba(255,255,255,0.12)" : "transparent",
    border: SECONDARY_BORDER,
    cursor: "pointer",
  }) as const;

const sectionTitle = {
  margin: "12px 8px 4px",
  fontSize: 12,
  fontWeight: 700,
  color: "#fff",
} as const;

/**
 * Fenêtre « Plan du site » (PrestaShop) : charge l'index des pages puis chaque page, et
 * liste toutes les pages CMS et les pages avec modules, de A à Z, avec des liens
 * cliquables. Deux affichages : liste, ou arbre des pages d'après leur URL. Copie en
 * Markdown ou de l'arbre. Filtre par page, URL ou module. Échap ou clic sur le fond ferme.
 */
export const SitePlan: FC<SitePlanProps> = ({ indexUrl, onClose, onCopied }) => {
  const [state, setState] = useState<LoadState>({ status: "loading", done: 0, total: 0 });
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("list");

  useEffect(() => {
    let alive = true;
    buildSitePlan(indexUrl, fetch, (done, total) => {
      if (alive) setState({ status: "loading", done, total });
    })
      .then((plan) => {
        if (alive) setState({ status: "ready", plan: sortPlan(plan) });
      })
      .catch(() => {
        if (alive) setState({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [indexUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (state.status !== "ready") return null;
    const q = query.trim().toLowerCase();
    if (!q) return state.plan;
    return {
      cms: state.plan.cms.filter((r) => matches(r, q)),
      pages: state.plan.pages.filter((r) => matches(r, q)),
      links: state.plan.links.filter((r) => matches(r, q)),
    };
  }, [state, query]);

  const tree = useMemo(() => (filtered && view === "tree" ? buildPageTree(filtered) : null), [filtered, view]);

  const copyText = (text: string, message: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    onCopied?.(message);
  };

  return createPortal(
    <div
      {...{ [IGNORE_ATTR]: "" }}
      data-rp-site-plan=""
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: UI_Z,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        role="dialog"
        aria-label="Plan du site"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, calc(100vw - 32px))",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: SOLID_BG,
          border: PANEL_BORDER,
          borderRadius: 10,
          boxShadow: CARD_SHADOW,
          color: "#fff",
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: PANEL_BORDER }}>
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Plan du site</span>
          {state.status === "ready" && (
            <>
              <div role="group" aria-label="Affichage" style={{ display: "inline-flex", gap: 2 }}>
                <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")} style={headerButton(view === "list")}>
                  Liste
                </button>
                <button type="button" aria-pressed={view === "tree"} onClick={() => setView("tree")} style={headerButton(view === "tree")}>
                  Arbre
                </button>
              </div>
              <button type="button" onClick={() => copyText(sitePlanMarkdown(state.plan), "Plan copié ✓")} style={headerButton()}>
                <CopyIcon />
                Copier en Markdown
              </button>
              <button type="button" onClick={() => copyText(pageTreeText(state.plan), "Arbre copié ✓")} style={headerButton()}>
                <GitBranchIcon />
                Copier l'arbre
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: MUTED, fontSize: 18, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {state.status === "ready" && (
          <input
            type="search"
            placeholder="Filtrer par page, URL ou module"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              margin: "8px 12px 0",
              padding: "6px 8px",
              borderRadius: 6,
              border: SECONDARY_BORDER,
              background: "transparent",
              color: "#fff",
              fontSize: 12,
              outline: "none",
            }}
          />
        )}

        <div style={{ overflowY: "auto", padding: "0 4px 12px" }}>
          {state.status === "loading" && (
            <p style={{ padding: "12px 8px", color: MUTED, margin: 0 }}>
              {state.total ? `Chargement des pages (${state.done}/${state.total})…` : "Chargement de la liste des pages…"}
            </p>
          )}
          {state.status === "error" && (
            <p style={{ padding: "12px 8px", color: MUTED, margin: 0 }}>
              Liste des pages indisponible. Vérifie que le module PrestaShop renderpicker est à jour.
            </p>
          )}
          {tree && (
            <ul style={{ margin: "8px 0 0", padding: "0 8px" }}>
              <TreeNode node={tree} />
            </ul>
          )}
          {filtered && view === "list" && (
            <>
              <p style={sectionTitle}>Pages CMS ({filtered.cms.length})</p>
              <ul style={{ margin: 0, padding: 0 }}>
                {filtered.cms.map((row) => (
                  <PlanRow key={row.url} row={row} />
                ))}
              </ul>
              <p style={sectionTitle}>Pages avec modules ({filtered.pages.length})</p>
              <ul style={{ margin: 0, padding: 0 }}>
                {filtered.pages.map((row) => (
                  <PlanRow key={row.url} row={row} />
                ))}
              </ul>
              {filtered.links.length > 0 && (
                <>
                  <p style={sectionTitle}>Autres liens ({filtered.links.length})</p>
                  <p style={{ margin: "0 8px 4px", color: MUTED, fontSize: 11 }}>
                    Liens trouvés dans les pages ci-dessus (catégories, marques, blog, produits…), non chargés.
                  </p>
                  <ul style={{ margin: 0, padding: 0 }}>
                    {filtered.links.map((row) => (
                      <PlanRow key={row.url} row={row} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
