/**
 * Plan du site PrestaShop : liste les pages CMS et les pages qui contiennent des modules,
 * triées de A à Z. La liste des pages vient du contrôleur front du module
 * (`integrations/prestashop/renderpicker/controllers/front/pages.php`) ; chaque page est
 * chargée en `fetch` et ses modules sont lus dans les marqueurs `rp-module` du HTML rendu
 * par le serveur (override `Module.php`). Les autres liens internes trouvés dans ces pages
 * (catégories, marques, blog, produits…) sont relevés sans être chargés. Sans React :
 * testable sous jsdom (`DOMParser`).
 */

export interface SitePlanIndex {
  cms: { id: number; title: string; url: string }[];
  pages: { label: string; url: string }[];
}

export interface PlanRow {
  label: string;
  url: string;
  modules: string[];
  /** Statut HTTP quand le chargement a échoué, sinon `null`. */
  error: number | null;
}

export interface SitePlan {
  cms: PlanRow[];
  pages: PlanRow[];
  /** Autres liens internes trouvés dans les pages chargées, non chargés eux-mêmes
   * (modules inconnus). */
  links: PlanRow[];
}

/** Lien interne relevé dans une page. */
export interface FoundLink {
  label: string;
  url: string;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "text" | "json">>;

/** Nombre de pages chargées en parallèle. */
const CONCURRENCY = 4;

const MODULE_MARKER_RE = /<!--\s*rp-module:([^:]+):/g;

const byFr = (a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base" });

/** URL du contrôleur « pages » exposée par le module PrestaShop (`Media::addJsDef`). */
export function resolvePagesUrl(win: Window): string | undefined {
  const v = (win as unknown as { renderPickerPagesUrl?: string }).renderPickerPagesUrl;
  return v || undefined;
}

/** Noms des modules racine présents dans un HTML (marqueurs `rp-module`), sans doublon,
 * triés de A à Z. Pur. */
export function modulesInHtml(html: string): string[] {
  const names = new Set<string>();
  for (const m of html.matchAll(MODULE_MARKER_RE)) names.add(m[1]!);
  return [...names].sort(byFr);
}

/** Fichiers qui ne sont pas des pages (images, documents, assets). */
const FILE_RE = /\.(?:jpe?g|png|gif|webp|svg|ico|pdf|zip|css|js|xml|txt|mp4|webm)$/i;

/**
 * URL canonique d'un lien pour le plan, ou `null` s'il ne compte pas : autre origine,
 * fichier, ou query non vide (filtres, tri, pagination, actions panier, `back=`…). Les
 * paramètres vides sont ignorés (`?type=` → sans query), l'ancre est retirée, le `/`
 * final aussi (sauf racine). Pur.
 */
export function normalizeLink(href: string, base: string): string | null {
  let u: URL;
  try {
    u = new URL(href, base);
  } catch {
    return null;
  }
  if (u.origin !== new URL(base).origin) return null;
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  for (const [, v] of u.searchParams) if (v !== "") return null;
  if (FILE_RE.test(u.pathname)) return null;
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
  return u.origin + path;
}

const clean = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

/** Libellés vides de sens pour nommer une page. */
const GENERIC_RE = /^(tout voir|voir( plus| tout)?|lire( la suite| le guide| les avis)?|en savoir plus|découvrir|acheter|ajouter au panier)$/i;

/** Qualité d'un libellé : 0 vide, 1 faible (générique, prix, texte de carte trop long),
 * 2 bon. Sert à garder le meilleur libellé parmi tous les liens vers une même URL. Pur. */
export function labelScore(label: string): number {
  if (!label) return 0;
  if (GENERIC_RE.test(label) || /\d\s?€/.test(label) || label.length > 70) return 1;
  return 2;
}

/** Texte lisible d'un lien, du plus fiable au moins fiable : titre interne (`h1`-`h6`,
 * classe `*title*` / `*name*`), attribut `title`, `alt` d'une image, `aria-label`, puis
 * le texte complet (souvent pollué par le prix sur une carte produit). */
function linkLabel(a: Element): string {
  const candidates = [
    a.querySelector("h1, h2, h3, h4, h5, h6, [class*='title'], [class*='name']")?.textContent,
    a.getAttribute("title"),
    a.querySelector("img[alt]")?.getAttribute("alt"),
    a.getAttribute("aria-label"),
    a.textContent,
  ].map(clean);
  const best = candidates.find((c) => labelScore(c) === 2) ?? candidates.find(Boolean) ?? "";
  return best.length > 80 ? `${best.slice(0, 79)}…` : best;
}

/** Garde dans `map` le meilleur libellé pour `url` (score le plus haut, premier à égalité). */
function keepBest(map: Map<string, string>, url: string, label: string): void {
  const current = map.get(url);
  if (current === undefined || labelScore(label) > labelScore(current)) map.set(url, label);
}

/** Liens internes d'un HTML (voir `normalizeLink`), sans doublon, meilleur libellé gardé
 * (`labelScore`). `base` = URL de la page (liens relatifs, même origine). */
export function linksInHtml(html: string, base: string): FoundLink[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found = new Map<string, string>();
  for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
    const url = normalizeLink(a.getAttribute("href")!, base);
    if (url) keepBest(found, url, linkLabel(a));
  }
  return [...found].map(([url, label]) => ({ url, label }));
}

/** Chemin + query d'une URL (plus lisible dans le plan que l'URL absolue). Pur. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function rowLine(row: PlanRow): string {
  const status = row.error !== null ? ` (erreur HTTP ${row.error || "réseau"})` : "";
  return `- **${row.label}** : \`${shortUrl(row.url)}\`${status}`;
}

/** Plan prêt à afficher : pages CMS toutes gardées, pages sans module (et sans erreur)
 * retirées, lignes et modules triés de A à Z. Pur. */
export function sortPlan(plan: SitePlan): SitePlan {
  const sortRow = (row: PlanRow): PlanRow => ({ ...row, modules: [...row.modules].sort(byFr) });
  const byLabel = (a: PlanRow, b: PlanRow) => byFr(a.label, b.label);
  return {
    cms: plan.cms.map(sortRow).sort(byLabel),
    pages: plan.pages
      .filter((p) => p.modules.length > 0 || p.error !== null)
      .map(sortRow)
      .sort(byLabel),
    links: [...plan.links].sort(byLabel),
  };
}

/** Rendu Markdown du plan (`sortPlan`) : pages CMS puis pages avec modules. Pur. */
export function sitePlanMarkdown(plan: SitePlan, title = "Plan du site"): string {
  const { cms, pages, links } = sortPlan(plan);
  const lines: string[] = [`# ${title}`, "", "## Pages CMS", ""];
  if (cms.length === 0) lines.push("_(aucune page CMS)_");
  for (const row of cms) {
    lines.push(rowLine(row));
    for (const mod of row.modules) lines.push(`  - ${mod}`);
  }

  lines.push("", "## Pages avec modules", "");
  if (pages.length === 0) lines.push("_(aucune page avec module)_");
  for (const row of pages) {
    lines.push(rowLine(row));
    for (const mod of row.modules) lines.push(`  - ${mod}`);
  }

  if (links.length > 0) {
    lines.push("", "## Autres liens", "");
    for (const row of links) lines.push(rowLine(row));
  }
  return lines.join("\n");
}

interface Loaded {
  row: PlanRow;
  links: FoundLink[];
}

/** Charge une page, relève ses modules et ses liens internes ; une erreur réseau ou HTTP
 * est notée, pas levée. */
async function loadRow(fetchFn: FetchFn, label: string, url: string): Promise<Loaded> {
  try {
    const res = await fetchFn(url, { credentials: "same-origin" });
    const html = await res.text();
    // Modules relevés même sur une erreur HTTP : la page 404 du thème en affiche aussi.
    return {
      row: { label, url, modules: modulesInHtml(html), error: res.ok ? null : res.status },
      links: res.ok ? linksInHtml(html, url) : [],
    };
  } catch {
    return { row: { label, url, modules: [], error: 0 }, links: [] };
  }
}

/** Fusionne les liens relevés : hors pages déjà listées, sans doublon, meilleur libellé
 * (`labelScore`), sinon dernier segment de l'URL. Pur. */
function mergeLinks(found: FoundLink[][], listed: string[], base: string): PlanRow[] {
  const known = new Set(listed.map((u) => normalizeLink(u, base) ?? u));
  const merged = new Map<string, string>();
  for (const link of found.flat()) {
    if (!known.has(link.url)) keepBest(merged, link.url, link.label);
  }
  return [...merged].map(([url, label]) => ({
    label: label || decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "/"),
    url,
    modules: [],
    error: null,
  }));
}

/** Exécute `tasks` avec au plus `limit` promesses en vol, résultats dans l'ordre d'entrée. */
async function runLimited<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]!();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/** Lit l'index des pages, charge chaque page (concurrence limitée) et renvoie le plan.
 * `onProgress(fait, total)` est appelé après chaque page chargée. */
export async function buildSitePlan(
  indexUrl: string,
  fetchFn: FetchFn = fetch,
  onProgress?: (done: number, total: number) => void,
): Promise<SitePlan> {
  const res = await fetchFn(indexUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`index des pages : HTTP ${res.status}`);
  const index = (await res.json()) as SitePlanIndex;

  const total = index.cms.length + index.pages.length;
  let done = 0;
  const track = (row: Promise<Loaded>) =>
    row.then((r) => {
      done++;
      onProgress?.(done, total);
      return r;
    });
  const cmsTasks = index.cms.map((c) => () => track(loadRow(fetchFn, c.title || `CMS #${c.id}`, c.url)));
  const pageTasks = index.pages.map((p) => () => track(loadRow(fetchFn, p.label, p.url)));
  const loaded = await runLimited([...cmsTasks, ...pageTasks], CONCURRENCY);
  const rows = loaded.map((l) => l.row);
  const base = new URL(indexUrl, typeof location !== "undefined" ? location.href : "http://localhost").href;
  return {
    cms: rows.slice(0, cmsTasks.length),
    pages: rows.slice(cmsTasks.length),
    links: mergeLinks(
      loaded.map((l) => l.links),
      rows.map((r) => r.url),
      base,
    ),
  };
}

/** Nœud de l'arbre des pages : un segment d'URL, la page qui s'y trouve (s'il y en a une)
 * et les segments enfants. */
export interface PageTreeNode {
  segment: string;
  row: PlanRow | null;
  children: PageTreeNode[];
}

/** Segments d'une URL (`/content/1-livraison` → `["content", "1-livraison"]`), la query
 * éventuelle collée au dernier segment. Pur. */
function urlSegments(url: string): string[] {
  let path = url;
  let search = "";
  try {
    const u = new URL(url, "http://x");
    path = u.pathname;
    search = u.search;
  } catch {
    // URL invalide : traitée comme un chemin brut.
  }
  const segments = path.split("/").filter(Boolean);
  if (search) {
    if (segments.length === 0) segments.push(search);
    else segments[segments.length - 1] += search;
  }
  return segments;
}

/** Arbre des pages (CMS, autres pages et autres liens) d'après leur chemin d'URL, racine `/`, enfants triés de
 * A à Z. Une URL vue deux fois n'apparaît qu'une fois. Pur. */
export function buildPageTree(plan: SitePlan): PageTreeNode {
  const root: PageTreeNode = { segment: "/", row: null, children: [] };
  for (const row of [...plan.cms, ...plan.pages, ...plan.links]) {
    let node = root;
    for (const seg of urlSegments(row.url)) {
      let child = node.children.find((c) => c.segment === seg);
      if (!child) {
        child = { segment: seg, row: null, children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.row ??= row;
  }
  const sortRec = (n: PageTreeNode) => {
    n.children.sort((a, b) => byFr(a.segment, b.segment));
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

/** Arbre des pages en texte (`├──`, `└──`), titre de la page entre parenthèses. À coller
 * dans un `.md` (bloc de code) ou un message. Pur. */
export function pageTreeText(plan: SitePlan): string {
  const root = buildPageTree(plan);
  const name = (n: PageTreeNode) => (n.row ? `${n.segment} (${n.row.label})` : n.segment);
  const lines = [name(root)];
  const walk = (nodes: PageTreeNode[], prefix: string) => {
    nodes.forEach((n, i) => {
      const last = i === nodes.length - 1;
      lines.push(`${prefix}${last ? "└── " : "├── "}${name(n)}`);
      walk(n.children, prefix + (last ? "    " : "│   "));
    });
  };
  walk(root.children, "");
  return lines.join("\n");
}
