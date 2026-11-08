# Git — commits

## Règle absolue

**Ne JAMAIS commiter soi-même (`git commit`), sauf si l'utilisateur le demande explicitement.**

- Édits, tests, builds : oui. Commit : seulement sur demande claire ("commit", "commit puis publish", etc.).
- Ne jamais regrouper implicitement un commit avec une autre action (publish, push, release).
- Ne jamais `git push` sans demande explicite.
- `npm version` (bump de version + commit + tag automatiques) vaut création de commit → interdit sans demande explicite ; préférer laisser l'utilisateur lancer `release:*`.

## Proposer un message de commit

En fin de tâche, **proposer** un message de commit court (sans commiter) :

- Format Conventional Commits : `type(scope): description`.
- Une seule ligne, en français, 70 caractères max.
- Exemples : `fix(inspector): picker armé cross-bundle`, `chore: repo GitHub antone-io`.

## En cas de doute

S'arrêter avant l'étape git et demander.
