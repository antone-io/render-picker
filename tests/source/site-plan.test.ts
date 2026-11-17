import { describe, expect, it, vi } from "vitest";

import {
  buildPageTree,
  buildSitePlan,
  labelScore,
  linksInHtml,
  modulesInHtml,
  normalizeLink,
  pageTreeText,
  resolvePagesUrl,
  sitePlanMarkdown,
  sortPlan,
} from "../../src/core/source/site-plan";

describe("modulesInHtml", () => {
  it("relève les modules des marqueurs, sans doublon, triés de A à Z", () => {
    const html =
      "<!-- rp-module:ps_shoppingcart:displayNav2:3:t/x.tpl:1 --><div></div><!-- /rp-module -->" +
      "<!-- rp-module:blockreassurance::1:t/y.tpl:1 --><div></div><!-- /rp-module -->" +
      "<!-- rp-module:ps_shoppingcart:displayTop:2:t/x.tpl:1 -->";
    expect(modulesInHtml(html)).toEqual(["blockreassurance", "ps_shoppingcart"]);
  });

  it("aucun marqueur → liste vide", () => {
    expect(modulesInHtml("<div><!-- rp@t/x.tpl:1 --></div>")).toEqual([]);
  });
});

describe("sitePlanMarkdown", () => {
  it("trie de A à Z (accents compris) et exclut les pages sans module", () => {
    const md = sitePlanMarkdown({
      cms: [
        { label: "Livraison", url: "http://s.test/content/1-livraison", modules: [], error: null },
        { label: "À propos", url: "http://s.test/content/4-a-propos", modules: ["cjcore"], error: null },
      ],
      pages: [
        { label: "Produit", url: "http://s.test/p.html", modules: ["cjproduct"], error: null },
        { label: "Contact", url: "http://s.test/contact", modules: [], error: null },
        { label: "Accueil", url: "http://s.test/", modules: ["cjhero", "cjbrands"], error: null },
      ],
      links: [],
    });
    expect(md).toBe(
      [
        "# Plan du site",
        "",
        "## Pages CMS",
        "",
        "- **À propos** : `/content/4-a-propos`",
        "  - cjcore",
        "- **Livraison** : `/content/1-livraison`",
        "",
        "## Pages avec modules",
        "",
        "- **Accueil** : `/`",
        "  - cjbrands",
        "  - cjhero",
        "- **Produit** : `/p.html`",
        "  - cjproduct",
      ].join("\n"),
    );
  });

  it("garde une page en erreur avec son statut", () => {
    const md = sitePlanMarkdown({
      cms: [],
      pages: [{ label: "Panier", url: "http://s.test/panier", modules: [], error: 500 }],
      links: [],
    });
    expect(md).toContain("_(aucune page CMS)_");
    expect(md).toContain("- **Panier** : `/panier` (erreur HTTP 500)");
  });
});

describe("sortPlan", () => {
  it("garde toutes les pages CMS, retire les pages sans module, trie lignes et modules", () => {
    const plan = sortPlan({
      cms: [
        { label: "Zones", url: "/z", modules: [], error: null },
        { label: "Avis", url: "/a", modules: ["b", "a"], error: null },
      ],
      pages: [
        { label: "Contact", url: "/c", modules: [], error: null },
        { label: "Accueil", url: "/", modules: ["cjhero", "cjbrands"], error: null },
      ],
      links: [],
    });
    expect(plan.cms.map((r) => r.label)).toEqual(["Avis", "Zones"]);
    expect(plan.cms[0]!.modules).toEqual(["a", "b"]);
    expect(plan.pages).toEqual([{ label: "Accueil", url: "/", modules: ["cjbrands", "cjhero"], error: null }]);
  });
});

describe("buildSitePlan", () => {
  it("charge l'index puis chaque page, erreurs notées sans lever", async () => {
    const pages: Record<string, { ok: boolean; status: number; body: string }> = {
      "/cms/1": { ok: true, status: 200, body: "<!-- rp-module:cjlivraison::1:t/x.tpl:1 -->" },
      "/": { ok: true, status: 200, body: "<!-- rp-module:cjhero::1:t/x.tpl:1 -->" },
      "/panier": { ok: false, status: 404, body: "<!-- rp-module:cjnotfound::1:t/x.tpl:1 -->" },
    };
    const fetchFn = vi.fn(async (url: string) => {
      if (url === "/index") {
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => ({
            cms: [{ id: 1, title: "Livraison", url: "/cms/1" }],
            pages: [
              { label: "Accueil", url: "/" },
              { label: "Panier", url: "/panier" },
              { label: "Hors ligne", url: "/down" },
            ],
          }),
        };
      }
      const p = pages[url];
      if (!p) throw new Error("réseau");
      return { ok: p.ok, status: p.status, text: async () => p.body, json: async () => null };
    });

    const progress = vi.fn();
    const plan = await buildSitePlan("/index", fetchFn, progress);

    expect(progress).toHaveBeenCalledTimes(4);
    expect(progress).toHaveBeenLastCalledWith(4, 4);

    expect(plan.cms).toEqual([{ label: "Livraison", url: "/cms/1", modules: ["cjlivraison"], error: null }]);
    expect(plan.pages).toEqual([
      { label: "Accueil", url: "/", modules: ["cjhero"], error: null },
      { label: "Panier", url: "/panier", modules: ["cjnotfound"], error: 404 },
      { label: "Hors ligne", url: "/down", modules: [], error: 0 },
    ]);
  });

  it("index en erreur → rejet", async () => {
    const fetchFn = async () => ({ ok: false, status: 404, text: async () => "", json: async () => null });
    await expect(buildSitePlan("/index", fetchFn)).rejects.toThrow("HTTP 404");
  });
});

describe("resolvePagesUrl", () => {
  it("lit window.renderPickerPagesUrl, vide → undefined", () => {
    expect(resolvePagesUrl({ renderPickerPagesUrl: "/rp" } as unknown as Window)).toBe("/rp");
    expect(resolvePagesUrl({ renderPickerPagesUrl: "" } as unknown as Window)).toBeUndefined();
  });
});

describe("arbre des pages", () => {
  const row = (label: string, url: string) => ({ label, url, modules: [], error: null });
  const plan = {
    cms: [row("Mentions légales", "http://s.test/content/2-mentions"), row("Livraison", "http://s.test/content/1-livraison")],
    pages: [
      row("Accueil", "http://s.test/"),
      row("Panier", "http://s.test/panier"),
      row("Panier bis", "http://s.test/panier"),
      row("Blog", "http://s.test/index.php?fc=module&module=hiblog"),
    ],
    links: [],
  };

  it("buildPageTree : segments d'URL, enfants triés, URL en double gardée une fois", () => {
    const root = buildPageTree(plan);
    expect(root.row?.label).toBe("Accueil");
    expect(root.children.map((c) => c.segment)).toEqual(["content", "index.php?fc=module&module=hiblog", "panier"]);
    expect(root.children[0]!.row).toBeNull();
    expect(root.children[0]!.children.map((c) => c.row?.label)).toEqual(["Livraison", "Mentions légales"]);
    expect(root.children[2]!.row?.label).toBe("Panier");
  });

  it("pageTreeText : rendu en arbre texte", () => {
    expect(pageTreeText(plan)).toBe(
      [
        "/ (Accueil)",
        "├── content",
        "│   ├── 1-livraison (Livraison)",
        "│   └── 2-mentions (Mentions légales)",
        "├── index.php?fc=module&module=hiblog (Blog)",
        "└── panier (Panier)",
      ].join("\n"),
    );
  });
});

describe("normalizeLink", () => {
  const base = "http://s.test/content/1-livraison";

  it("garde un lien interne, retire ancre, / final et paramètres vides", () => {
    expect(normalizeLink("/202-amenagement-exterieur/#top", base)).toBe("http://s.test/202-amenagement-exterieur");
    expect(normalizeLink("http://s.test/blog?type=", base)).toBe("http://s.test/blog");
    expect(normalizeLink("/", base)).toBe("http://s.test/");
  });

  it("écarte autre origine, fichiers, query non vide et schémas non web", () => {
    expect(normalizeLink("https://autre.test/x", base)).toBeNull();
    expect(normalizeLink("/img/logo.png", base)).toBeNull();
    expect(normalizeLink("/panier?action=show", base)).toBeNull();
    expect(normalizeLink("mailto:a@b.c", base)).toBeNull();
    expect(normalizeLink("tel:0102030405", base)).toBeNull();
  });
});

describe("linksInHtml", () => {
  it("relève les liens internes, sans doublon, avec un libellé lisible", () => {
    const html =
      '<a href="/fabricants/12-elho"><img alt="ELHO"></a>' +
      '<a href="/fabricants/12-elho">  ELHO\n pots </a>' +
      '<a href="/connexion?back=my-account">Connexion</a>' +
      '<a href="/blog" title="Guides et conseils"></a>';
    expect(linksInHtml(html, "http://s.test/")).toEqual([
      { url: "http://s.test/fabricants/12-elho", label: "ELHO" },
      { url: "http://s.test/blog", label: "Guides et conseils" },
    ]);
  });
});

describe("buildSitePlan — autres liens", () => {
  it("ajoute les liens trouvés hors pages déjà listées, dans l'arbre aussi", async () => {
    const fetchFn = async (url: string) => {
      if (url === "http://s.test/index") {
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => ({ cms: [], pages: [{ label: "Accueil", url: "http://s.test/" }] }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => null,
        text: async () =>
          '<!-- rp-module:cjhero::1:t/x.tpl:1 --><a href="/">Accueil</a><a href="/blog">Guides</a><a href="/202-jardin">Jardin</a>',
      };
    };
    const plan = await buildSitePlan("http://s.test/index", fetchFn);
    expect(plan.links.map((l) => [l.label, l.url])).toEqual([
      ["Guides", "http://s.test/blog"],
      ["Jardin", "http://s.test/202-jardin"],
    ]);
    expect(pageTreeText(plan)).toBe(["/ (Accueil)", "├── 202-jardin (Jardin)", "└── blog (Guides)"].join("\n"));
    expect(sitePlanMarkdown(plan)).toContain("## Autres liens");
  });
});

describe("libellés des liens", () => {
  it("labelScore : vide, générique, prix ou trop long → faible ; sinon bon", () => {
    expect(labelScore("")).toBe(0);
    expect(labelScore("Tout voir")).toBe(1);
    expect(labelScore("Asperseur 3 branches5,66 €Prix initial : 7,08 €")).toBe(1);
    expect(labelScore("Vases - pots")).toBe(2);
  });

  it("préfère le titre de la carte produit au texte avec prix, et un libellé précis à « Tout voir »", () => {
    const html =
      '<a href="/214-vases-pots">Tout voir</a>' +
      '<a href="/214-vases-pots">Vases - pots</a>' +
      '<a href="/p/1.html"><img alt="Photo"><h3>Asperseur rotatif</h3><span>5,66 €</span></a>';
    expect(linksInHtml(html, "http://s.test/")).toEqual([
      { url: "http://s.test/214-vases-pots", label: "Vases - pots" },
      { url: "http://s.test/p/1.html", label: "Asperseur rotatif" },
    ]);
  });
});
