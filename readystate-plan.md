# Plan de Développement Strict : ReadyState (MVP)

> **DETERMINISTIC STATE BUS**
> ReadyState : Ground truth for AI workflows. Self-hosted, SQLite-backed, zero hallucination.

## Contexte Architectural
Tu construis "ReadyState", un bus d'état M2M (Machine-to-Machine) qui permet aux agents IA (via MCP) de savoir si une capacité technique est réellement déployée et active sur un environnement donné. 
- **Stack :** Node.js, TypeScript, Hono, Prisma (SQLite local), et `@modelcontextprotocol/sdk`.
- **Règle d'exécution :** Tu es en mode Supervisé. Exécute chaque tâche l'une après l'autre. Utilise le terminal intégré pour effectuer les validations de fin d'étape. Affiche les résultats dans la console et **attends mon approbation explicite** avant de passer à la tâche suivante.

---

## <Task 1: Fondations & Base de données>
**Objectif :** Initialiser le projet et le schéma de vérité absolue.
1. Utilise le terminal pour initialiser un projet Node.js avec TypeScript et Hono (`npm create hono@latest readystate --template nodejs`).
2. Installe `prisma` en dépendance de développement, initialise-le avec un fournisseur `sqlite`, et installe `@prisma/client`.
3. Dans `schema.prisma`, définis exactement deux modèles :
   - `Environment` : `name` (String, @id), `currentSha` (String), `updatedAt` (DateTime).
   - `Capability` : `id` (String, @id), `description` (String), `requiredFlag` (String, nullable), `environmentName` (String, relation vers Environment).
4. Exécute la migration initiale Prisma (`npx prisma db push`).
5. **Validation Terminal :** Écris un script éphémère `scripts/test-db.ts` utilisant PrismaClient pour insérer un environnement "staging" avec un SHA factice. Exécute-le (`npx tsx scripts/test-db.ts`) et confirme que la donnée s'insère sans erreur. Demande l'autorisation de continuer.

## <Task 2: Le Moteur d'Ingestion (Webhooks GitHub)>
**Objectif :** Écouter les événements de déploiement pour mettre à jour la base.
1. Dans le serveur Hono (`src/index.ts`), crée une route `POST /webhooks/github`.
2. Implémente la logique d'ingestion :
   - Parse le JSON entrant. Le payload attendu est un événement GitHub `deployment_status` (vérifie que `state === "success"`).
   - Extrait `environment` et `sha` du payload.
   - Utilise Prisma pour créer ou mettre à jour (upsert) l'entrée dans la table `Environment` avec le nouveau `sha`.
   - *Mock MVP :* Simule la lecture d'un manifeste en insérant en dur une capacité `id: "api-checkout-v2"` liée à cet environnement dans la table `Capability`.
3. **Validation Terminal :** Lance le serveur Hono en arrière-plan. Utilise `curl` dans le terminal pour envoyer un faux payload JSON simulant un déploiement réussi sur "staging". Vérifie que la route retourne 200 OK et que Prisma a bien mis à jour SQLite. Demande l'autorisation de continuer.

## <Task 3: Le Pont Feature Flag>
**Objectif :** Simuler la vérification de l'activation métier.
1. Crée un fichier `src/services/flagService.ts`.
2. Implémente une fonction asynchrone `isFlagActive(flagName: string, environment: string): Promise<boolean>`.
3. *Mock MVP :* Pour l'instant, retourne `true` si le nom du flag est "mixpanel_checkout_active", sinon retourne `false`. 
4. **Validation :** Vérifie simplement que le code compile sans erreur TypeScript. Demande l'autorisation de continuer.

## <Task 4: Le Cerveau Déterministe (Serveur MCP)>
**Objectif :** Exposer l'interface pour les agents IA autonomes.
1. Installe le SDK officiel : `npm install @modelcontextprotocol/sdk`.
2. Crée un fichier `src/mcp.ts`. Initialise un serveur MCP local (via transport STDIO ou SSE, selon ce qui s'intègre le mieux avec Hono).
3. Expose un outil strict nommé `get_capability_status`.
   - **Arguments :** `capabilityId` (string) et `environment` (string).
   - **Logique Métier :**
     a. Cherche la capacité via Prisma pour cet environnement.
     b. Si absente -> retourne `{ status: "not_deployed", reason: "Absent du SHA actuel déployé" }`.
     c. Si présente, lis `requiredFlag`. S'il y a un flag, interroge `flagService.ts`.
     d. Si le flag est false -> retourne `{ status: "deployed_but_inactive", reason: "Le code est présent mais le feature flag est désactivé" }`.
     e. Sinon -> retourne `{ status: "fully_released", reason: "Code déployé et flag actif. Prêt à l'usage." }`.
4. **Validation Terminal :** Écris un script client de test `scripts/test-mcp.ts` qui appelle cet outil avec l'ID "api-checkout-v2" sur "staging". Exécute-le et affiche le JSON retourné dans la console pour prouver le déterminisme. Demande l'autorisation de continuer.

## <Task 5: Préparation au Déploiement>
**Objectif :** Packager le bus d'état en un binaire ultra-léger.
1. Génère un fichier `Dockerfile` basé sur `node:20-alpine`.
2. Configure-le pour compiler le projet TypeScript, générer le client Prisma, et exposer le port 3000.
3. Règle critique : Assure-toi que la base de données SQLite est déclarée dans un chemin (ex: `/app/data/`) qui pourra être facilement monté comme volume persistant (EBS ou Fly.io Volume).
4. Ajoute un `.dockerignore` propre.
5. **Validation Finale :** Exécute `npm run build` et confirme qu'il n'y a aucune erreur de build TypeScript.