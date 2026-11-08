# Publication npm

## Contenu publié

- Nom npm : `@antone-br/render-picker` (scopé). `publishConfig.access: public` obligatoire, sinon npm le publie en privé (payant).
- Le champ `files` de `package.json` limite le paquet à `dist/`, `README.md`, `LICENSE`. Le reste (tests, `.claude/`, config) ne part pas sur npm.
- Vérifier avant chaque publication : `npm pack --dry-run`.

## Métadonnées

- `author` : `Antone Barbaud <antone.barbaud@icloud.com>`. Toujours cette adresse personnelle, jamais une adresse professionnelle.
- Projet personnel : aucune mention de l'employeur, de l'agence ou de leurs projets internes (nom, adresse, chemin local, outil interne) dans le code, les tests, les docs ou les commits.
- `repository` / `homepage` / `bugs` : `https://github.com/antone-io/render-picker`.
- `license` : MIT. Le fichier `LICENSE` porte `Copyright (c) <année> Antone Barbaud`.

## Versions (semver)

| Changement                                     | Version |
| ---------------------------------------------- | ------- |
| Correction sans changement d'API               | patch   |
| Nouvelle option / nouvel export compatible     | minor   |
| Option renommée/supprimée, format de sortie modifié | major (minor tant qu'on est en `0.x`) |

Une version publiée est immuable : corriger = publier une nouvelle version.

## Procédure

1. `npm run typecheck && npm test && npm run build`
2. `npm pack --dry-run`
3. Monter la version (`npm version patch|minor|major`)
4. `npm publish` — **toujours demander confirmation à l'utilisateur avant** (action publique, irréversible)
5. `git push --follow-tags`

## Anti-patterns

- Publier sans confirmation explicite.
- Publier avec des tests ou un typecheck en échec.
- Mettre un secret (token npm, `.env`) dans le repo ou le paquet.
