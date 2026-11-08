# AGENTS.md

Instructions pour les agents IA (Claude Code, Codex, Cursor, etc.) qui travaillent sur ce dépôt.

## Règle absolue : jamais de commit sans permission

**Ne jamais commiter soi-même (`git commit`), ni `git push`, ni `npm version`, sauf si l'utilisateur le demande explicitement.** En fin de tâche, proposer un message de commit court (`type(scope): description`, une ligne). Modifier, tester, builder : oui. Commiter : uniquement sur demande claire. En cas de doute, s'arrêter et demander. Détails : `.claude/rules/git-commits.md`.

## Projet personnel

Aucune mention de l'employeur, de l'agence ou de leurs projets internes (nom, adresse email, chemin local, outil interne) dans le code, les tests, les docs ou les messages de commit. Dans les exemples, utiliser des chemins génériques (`C:\Users\dev\...`, `/home/user/app`).

## RTK : à utiliser s'il est installé

[RTK (Rust Token Killer)](https://github.com/rtk-ai/rtk) est un proxy CLI qui compresse la sortie des commandes de dev (git, tests, grep, find...) pour économiser des tokens.

1. Vérifier s'il est installé : `rtk --version` et `rtk gain`.
   - Attention au conflit de nom : un autre outil `rtk` (Rust Type Kit) existe. Si `rtk gain` échoue, ce n'est pas le bon binaire.
2. **S'il est installé**, préfixer les commandes par `rtk` (`rtk git status`, `rtk npm test`...). Avec Claude Code, un hook le fait automatiquement.
   - Si `rtk` casse une sortie (JSON, script lu sur stdin), utiliser `rtk bypass <commande>`.
   - Pour récupérer une sortie tronquée par un filtre : `rtk recall <hash>`.
3. **S'il n'est pas installé**, lancer les commandes normalement. Ne pas l'installer sans l'accord de l'utilisateur.

Détails : `.claude/rules/rtk.md`.

## Règles et docs : tout est dans `.claude/`

Lire les fichiers concernés **avant** de modifier le code.

### `.claude/rules/` : conventions à respecter

| Fichier | Sujet |
| --- | --- |
| `arch.md` | Stack, couches (`core` sans React), règles structurelles, **checklist de fin de tâche** |
| `react-components.md` | Composants `FC<Props>`, styles inline + tokens, intégration (portals, `data-pathpicker-ignore`) |
| `react-hooks.md` | Emplacement, cleanup des effets, pattern ref |
| `types-interfaces.md` | `interface` vs `type`, nommage, JSDoc des types publics |
| `imports.md` | Imports relatifs, sens des dépendances, ordre |
| `file-naming.md` | kebab-case, noms courts, pas d'`index.ts` |
| `tests.md` | Vitest + jsdom, conventions, mocks |
| `test-structure.md` | `tests/` en miroir de `src/core/`, un `index.md` par dossier |
| `git-commits.md` | Jamais de commit ni de push sans demande explicite |
| `publishing.md` | Publication npm (confirmation obligatoire avant `npm publish`) |
| `rtk.md` | Référence complète des commandes RTK |
| `communication.md` | Réponses très courtes, infos minimales |

### `.claude/.docs/` : documentation technique

| Fichier | Sujet |
| --- | --- |
| `architecture.md` | Fonctionnement interne du module PrestaShop (prefilter Smarty, overrides `Module.php` / `Hook.php`, overlay modules, perf, pièges de déploiement) |
| `structurer-arbre-modules.md` | Comment structurer les templates pour obtenir un arbre de modules lisible |

## Avant de terminer une tâche

```bash
npm run typecheck
npm test
npm run ext:build   # si extension/ ou du code partagé a changé
```

Puis mettre à jour l'`index.md` des tests concernés et le `README.md` si l'API publique change (voir `.claude/rules/arch.md`).
