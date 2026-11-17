<?php
/**
 * Index des pages pour la fenêtre « Plan du site » (render-picker, dev only).
 *
 * Renvoie en JSON :
 * - `cms`   : toutes les pages CMS actives de la boutique ;
 * - `pages` : toutes les pages de la table `meta` (cœur + modules), plus une catégorie et
 *   un produit représentatifs.
 *
 * Le navigateur charge ensuite chaque URL et relève les modules dans les marqueurs
 * `rp-module` (voir `src/core/source/site-plan.ts` dans le repo render-picker).
 * URL : `index.php?fc=module&module=renderpicker&controller=pages`.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class RenderPickerPagesModuleFrontController extends ModuleFrontController
{
    public function initContent()
    {
        if (!defined('_RENDER_PICKER_ENABLED_') || !_RENDER_PICKER_ENABLED_) {
            header('HTTP/1.1 404 Not Found');
            exit;
        }

        $idLang = (int) $this->context->language->id;
        $idShop = (int) $this->context->shop->id;
        $link = $this->context->link;

        $cms = [];
        foreach (CMS::getCMSPages($idLang, null, true, $idShop) as $page) {
            $cms[] = [
                'id' => (int) $page['id_cms'],
                'title' => (string) $page['meta_title'],
                'url' => $link->getCMSLink((int) $page['id_cms'], $page['link_rewrite']),
            ];
        }

        // Toutes les pages connues de PrestaShop (table `meta` : pages du cœur et pages de
        // modules, celles qu'on règle dans « Trafic et SEO »). Libellé français pour les
        // pages courantes, sinon le titre SEO, sinon le nom technique.
        $labels = [
            'index' => 'Accueil',
            'cart' => 'Panier',
            'order' => 'Commande',
            'my-account' => 'Mon compte (connexion requise)',
            'authentication' => 'Connexion',
            'contact' => 'Contact',
            'search' => 'Recherche',
            'prices-drop' => 'Promotions',
            'new-products' => 'Nouveautés',
            'best-sales' => 'Meilleures ventes',
            'manufacturer' => 'Marques',
            'supplier' => 'Fournisseurs',
            'stores' => 'Magasins',
            'sitemap' => 'Plan du site',
            'pagenotfound' => 'Page introuvable (404)',
        ];
        // Pages qui exigent un identifiant : représentées plus bas (catégorie, produit) ou
        // déjà listées (CMS).
        // Pages techniques (pas de vraie page à voir) : tunnel en une page, confirmation
        // sans commande.
        $skip = [
            'category', 'product', 'cms', 'order-opc', 'order-confirmation',
            'module-' . $this->module->name . '-pages',
        ];
        // Contrôleurs de modules techniques : retours de paiement, validations, cron, ajax.
        $technical = '/(validation|payment|redirect|iframe|rest|submit|callback|ipn|notif|cron|ajax|confirm|return|webhook|remind)/i';

        $pages = [];
        $seen = [];
        foreach (Meta::getMetasByIdLang($idLang) as $meta) {
            $page = (string) $meta['page'];
            if (in_array($page, $skip, true) || isset($seen[$page])) {
                continue;
            }
            $seen[$page] = true;

            if (strpos($page, 'module-') === 0) {
                $parts = explode('-', substr($page, 7), 2);
                if (count($parts) !== 2 || !Module::isEnabled($parts[0]) || preg_match($technical, $parts[1])) {
                    continue;
                }
                $url = $link->getModuleLink($parts[0], $parts[1]);
            } else {
                $url = $link->getPageLink($page);
            }

            $label = isset($labels[$page])
                ? $labels[$page]
                : ((string) $meta['title'] !== '' ? (string) $meta['title'] . ' (' . $page . ')' : $page);
            $pages[] = ['label' => $label, 'url' => $url];
        }

        // Une catégorie et un produit représentatifs (premiers actifs).
        $categories = Category::getChildren((int) Configuration::get('PS_HOME_CATEGORY'), $idLang, true, $idShop);
        if (!empty($categories)) {
            $first = reset($categories);
            $pages[] = [
                'label' => 'Catégorie (' . $first['name'] . ')',
                'url' => $link->getCategoryLink((int) $first['id_category']),
            ];
        }
        $products = Product::getProducts($idLang, 0, 1, 'id_product', 'ASC', false, true);
        if (!empty($products)) {
            $first = reset($products);
            $pages[] = [
                'label' => 'Produit (' . $first['name'] . ')',
                'url' => $link->getProductLink((int) $first['id_product']),
            ];
        }

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['cms' => $cms, 'pages' => $pages], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
