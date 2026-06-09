# Plan de Développement Strict : ReadyState (MVP)

> **DETERMINISTIC STATE BUS**
> ReadyState : Ground truth for AI workflows. Self-hosted, SQLite-backed, zero hallucination.

## Contexte Architectural
Tu construis "ReadyState", un bus d'état M2M (Machine-to-Machine) qui permet aux agents IA (via MCP) de savoir si une capacité technique est réellement déployée et active sur un environnement donné. 
- **Stack :** Node.js, TypeScript, Hono, Prisma (SQLite local), et `@modelcontextprotocol/sdk`.
- **Règle d'exécution :** Tu es en mode Supervisé. Exécute chaque tâche l'une après l'autre. Utilise le terminal intégré pour effectuer les validations de fin d'étape. Affiche les résultats dans la console et **attends mon approbation explicite** avant de passer à la tâche suivante.

## Règles d'Exploitation
- **Rechargement MCP :** L'éditeur lance le serveur MCP en tâche de fond. **RÈGLE CRITIQUE :** Chaque fois que tu modifies le code source de l'intégration MCP (`src/mcp.ts`, modifications Prisma, etc.) et que tu le recompiles, tu DOIS demander à l'utilisateur de "Reload Window" (recharger sa fenêtre) dans son éditeur. Sinon, les outils MCP continueront de tourner sur l'ancienne version du code !

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

## <Task 6: L'Outil de Découverte (List Recents)>
**Objectif :** Permettre aux agents de l'IA de découvrir les dernières capacités enregistrées ou mises à jour.

1. **Mise à jour du Schéma :** Dans `schema.prisma`, ajoute un champ `updatedAt` automatique sur le modèle `Capability` pour pouvoir trier par récence :
   ```prisma
   model Capability {
     id              String   @id
     description     String
     requiredFlag    String?
     environmentName String
     environment     Environment @relation(fields: [environmentName], references: [name])
     updatedAt       DateTime @updatedAt // <- À ajouter
   }

## <Task 7: Outil d'Écriture avec Traçabilité (Upsert Capability)>
**Objectif :** Permettre aux agents de déclarer ou mettre à jour une capacité, en signant leur action pour l'historique d'audit.

1. **Mise à jour du Schéma :**
   Dans `schema.prisma`, ajoute `createdBy` (String) et `updatedBy` (String) et `createdAt` (DateTime) et `updatedAt` (DateTime) au modèle `Capability`. Exécute `npx prisma db push`.

2. **Déclaration de l'Outil MCP :**
   Dans `src/mcp.ts`, ajoute l'outil `upsert_capability` :
   ```json
   {
     "name": "upsert_capability",
     "description": "Ajoute ou met à jour une capacité. L'agent DOIT fournir son identifiant dans le champ author.",
     "inputSchema": {
       "type": "object",
       "properties": {
         "capabilityId": { "type": "string" },
         "environment": { "type": "string" },
         "description": { "type": "string" },
         "requiredFlag": { "type": "string" },
         "author": { "type": "string", "description": "Identifiant de l'agent ou de l'utilisateur effectuant l'action." }
       },
       "required": ["capabilityId", "environment", "description", "author"]
     }
   }


## <Task 8: L'Initialisation "Magique" (Auto-génération des Tokens)>
**Objectif :** Automatiser la création sécurisée des tokens `READ` et `WRITE` au premier lancement du conteneur Docker, sans exiger de configuration manuelle complexe de la part de l'utilisateur.

1. **Préparation de l'Environnement :**
   - Installe le package `dotenv` (`npm install dotenv`).
   - Au tout début de `src/index.ts` et `src/mcp.ts`, ajoute la configuration pour forcer la lecture des variables d'environnement depuis le volume persistant : `require('dotenv').config({ path: '/app/data/.env' });` (ou l'équivalent ES Modules).

2. **Le Script d'Entrypoint (Shell) :**
   Crée un fichier `docker-entrypoint.sh` à la racine du projet. 
   Implémente cette logique stricte en bash :
   - Vérifie si le fichier `/app/data/.env` existe.
   - S'il n'existe pas : 
     a. Génère un token de lecture via Node : `READ_TOKEN="rs_read_$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")"`
     b. Génère un token d'écriture : `WRITE_TOKEN="rs_write_$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")"`
     c. Crée le fichier `/app/data/.env` et écris ces deux variables à l'intérieur (`READYSTATE_READ_TOKEN` et `READYSTATE_WRITE_TOKEN`).
     d. Affiche un bloc d'alerte TRÈS VISIBLE dans la console (avec `echo`) pour avertir l'utilisateur qu'il s'agit du premier lancement et qu'il doit copier ces tokens pour ses agents.
   - S'il existe : passe silencieusement cette étape.
   - À la toute fin du script, transfère l'exécution à Node en ajoutant : `exec "$@"`

3. **Mise à jour du Dockerfile :**
   Modifie ton `Dockerfile` (créé à la Tâche 5) pour intégrer cette mécanique :
   - Ajoute : `COPY docker-entrypoint.sh /usr/local/bin/`
   - Rends-le exécutable : `RUN chmod +x /usr/local/bin/docker-entrypoint.sh`
   - Déclare-le comme point d'entrée principal : `ENTRYPOINT ["docker-entrypoint.sh"]` et `CMD ["npm", "start"]`.

## <Task 9: Sécurisation des Accès (Vérification des Tokens)>
**Objectif :** Valider les tokens générés pour protéger les routes et les actions.

1. **Sécurisation du Webhook (Hono) :**
   Dans `src/index.ts`, ajoute une vérification dans la route `/webhooks/github`.
   Vérifie que le header `x-hub-signature-256` correspond au HMAC SHA-256 du payload signé avec le `READYSTATE_WRITE_TOKEN`. (Si absent ou invalide, retourne une erreur 401).

2. **Sécurisation du MCP :**
   Dans `src/mcp.ts`, ajoute une vérification au démarrage : si `process.env.READYSTATE_READ_TOKEN` ou `process.env.READYSTATE_WRITE_TOKEN` sont absents, le processus doit se terminer avec une erreur (process.exit(1)).

3. **Mise à jour du script de test :**
   Dans `scripts/test-mcp.ts`, ajoute l'envoi d'une requête HTTP vers le webhook avec la signature HMAC correcte pour vérifier que l'API Hono est bien protégée.

## <Task 10: Ingestion Dynamique via Manifeste>
**Objectif :** Remplacer le "Mock MVP" de l'ingestion par la lecture dynamique d'un manifeste de capacités depuis le dépôt GitHub source.

1. **Création du manifeste (Dogfooding) :**
   - Crée un fichier `readystate-manifest.json` à la racine du dépôt GitHub.
   - Ce fichier contiendra un objet JSON avec une clé `capabilities` (un tableau d'objets `id`, `description`, `requiredFlag`).

2. **Modification du Webhook (Hono) :**
   - Dans `src/index.ts`, modifie la route `POST /webhooks/github`.
   - Extrait `repository.full_name` depuis le payload de l'événement.
   - Effectue une requête HTTP (via `fetch`) vers `https://raw.githubusercontent.com/${repository.full_name}/${sha}/readystate-manifest.json`.
   - Si le fichier existe (HTTP 200), parse le JSON et utilise `prisma.capability.upsert` dans une boucle pour enregistrer toutes les capacités dans SQLite.
   - S'il n'existe pas (HTTP 404), continue silencieusement (tous les dépôts n'ont pas forcément un manifeste).

3. **Validation :**
   - Modifie `scripts/test-mcp.ts` pour envoyer un webhook avec un payload contenant un vrai `repository.full_name` et un SHA valide pointant vers un commit où le manifeste existe.
   - Vérifie dans la base de données que les capacités du manifeste ont bien été ajoutées.


## <Task 11: Refactoring Critique (Clé Composite par Environnement)>
**Objectif :** Modifier le modèle de base de données pour qu'une même capacité (feature) puisse exister simultanément sur plusieurs environnements avec des états et des métadonnées distincts.

1. **Mise à jour du Schéma (Prisma) :**
   Dans `schema.prisma`, modifie le modèle `Capability` pour utiliser une clé composite :
   - Renomme le champ `id` en `capabilityId` (String). Retire l'attribut `@id`.
   - Assure-toi que les champs `environmentName` (String) et les autres métadonnées sont présents.
   - Ajoute cette directive exacte à la toute fin du modèle : `@@id([capabilityId, environmentName])`
   - Exécute la commande `npx prisma db push` dans le terminal. *(Note pour l'agent : Si Prisma avertit d'une perte de données sur SQLite à cause du changement de clé primaire, accepte-la avec `--accept-data-loss` ou supprime le fichier dev.db, c'est un environnement de dev).*

2. **Mise à jour Globale du Serveur MCP (`src/mcp.ts`) :**
   Tu dois refactoriser toutes les requêtes Prisma du fichier pour utiliser la nouvelle structure :
   - **Outil `upsert_capability` :** Modifie le `prisma.capability.upsert`. Le bloc `where` doit désormais utiliser l'identifiant composite : `where: { capabilityId_environmentName: { capabilityId, environmentName } }`. Mets à jour les blocs `create` et `update` pour utiliser `capabilityId` au lieu de `id`.
   - **Outil `get_capability_status` :** Modifie le `findFirst` pour chercher explicitement avec `where: { capabilityId, environmentName }`.
   - **Outil `list_recent_capabilities` :** Assure-toi que l'objet JSON retourné expose bien la propriété `"capabilityId"` et non plus `"id"`.

3. **Validation Terminal (Le Test de Duplication Légale) :**
   Dans ton script de test local :
   - Fais un appel `upsert_capability` pour `capabilityId: "api-checkout-v3"` sur l'environnement `"staging"`.
   - Fais un deuxième appel `upsert_capability` pour le MÊME `capabilityId: "api-checkout-v3"`, mais sur l'environnement `"production"`.
   - Écris une requête Prisma brute pour compter le nombre de lignes dans la table `Capability`. Confirme dans la console qu'il y a exactement **deux lignes distinctes**.
   - Demande l'autorisation de terminer la tâche.   

## <Task 12: External References & YAML Migration>
**Objectif :** Supporter les identifiants externes (ex: Linear, Jira) via un champ `annotations` et migrer le format du manifeste de JSON vers YAML.

1. **Mise à jour du Schéma (Prisma) :**
   Dans `schema.prisma`, ajoute le champ `annotations` (String, nullable) au modèle `Capability`. Exécute la migration (`npx prisma migrate dev --name add_annotations`) et regénère le client Prisma.

2. **Migration vers YAML :**
   - Installe le package `yaml` (`npm install yaml`).
   - Renomme `readystate-manifest.json` en `readystate-manifest.yml` et convertis son contenu en YAML. Ajoute un exemple d'annotation (ex: `linear.app/issue: LIN-123`).

3. **Mise à jour de l'Ingestion (Webhook) :**
   Dans `src/index.ts`, modifie la route webhook pour récupérer le fichier `.yml` au lieu de `.json`. Utilise `YAML.parse()` au lieu de `JSON.parse()`. Stringifie l'objet `annotations` (s'il existe) avant de faire le `prisma.capability.upsert`.

4. **Mise à jour du Serveur MCP :**
   Dans `src/mcp.ts` :
   - Mets à jour `upsert_capability` pour accepter un objet `annotations` (Record<string, string>). Stringifie-le avant l'insertion en base.
   - Modifie `list_recent_capabilities` et `get_capability_status` pour parser la chaîne `annotations` retournée par la base de données (via `JSON.parse`) avant de l'envoyer dans la réponse MCP.

5. **Validation :**
   Vérifie que le serveur TypeScript recompile correctement. Exécute le webhook ou le script de test pour confirmer que les annotations sont bien ingérées et retournées par les outils MCP.

## <Task 13: Query Capability Status by Annotation>
**Objectif :** Rendre l'outil `get_capability_status` plus intelligent en permettant de chercher une capacité via une annotation (ex: ticket Jira) plutôt que par son ID.

1. **Mise à jour du schéma MCP :**
   Dans `src/mcp.ts`, modifie `get_capability_status` pour :
   - Rendre `capabilityId` optionnel.
   - Ajouter `annotationKey` (string, optionnel) et `annotationValue` (string, optionnel).

2. **Mise à jour du handler :**
   - Si `capabilityId` est fourni, faire la recherche exacte (comportement existant).
   - Si `annotationKey` et `annotationValue` sont fournis, utiliser Prisma `findFirst` avec `where: { annotations: { contains: '"' + annotationKey + '":"' + annotationValue + '"' } }` (ou en adaptant pour la recherche JSON SQLite).
   - Gérer le cas où aucun critère n'est fourni (retourner une erreur).

3. **Validation :**
   Modifie `test-mcp.ts` pour tester un appel à `get_capability_status` en utilisant `annotationKey: "test/issue"` et `annotationValue: "123"` sur staging.

## <Task 14: Gestion des Environnements (Alias & Normalisation)>
**Objectif :** Résoudre le problème d'alias implicites en normalisant systématiquement les noms d'environnements (ex: `prod` -> `production`).

1. **Création d'un utilitaire de normalisation :**
   - Crée `src/utils/envMapper.ts`.
   - Implémente une fonction `normalizeEnvironment(env: string): string` qui gère des alias complets (avec fallback sur l'entrée d'origine) et qui peut lire la variable d'environnement `ENV_ALIASES` si elle existe.
2. **Mise à jour de l'API MCP :**
   - Modifie `src/mcp.ts` pour passer toutes les chaînes `environment` entrantes dans `normalizeEnvironment`.
3. **Mise à jour du Webhook :**
   - Modifie `src/index.ts` pour s'assurer que le champ `environment` récupéré de GitHub est également normalisé.
4. **Validation :**
   - Teste l'outil `get_capability_status` avec l'environnement `prod` et confirme qu'il retourne bien les données de `production`.

## <Task 15: Isolation des Capacités par Component (Multi-Repo)>
**Objectif :** Empêcher les collisions de `capabilityId` entre différents dépôts (ex: backend vs frontend) en introduisant une notion de `component` (standard Backstage).

1. **Mise à jour du Schéma (Prisma) :**
   - Dans `schema.prisma`, ajoute le champ `component String @default("default")` au modèle `Capability`.
   - Modifie la clé primaire composite : `@@id([capabilityId, environmentName, component])`.
   - Exécute la mise à jour de la base de données.
2. **Mise à jour du Serveur MCP (`src/mcp.ts`) :**
   - Modifie `upsert_capability` pour requérir `component` et mettre à jour l'appel Prisma.
   - Modifie `get_capability_status` et `list_recent_capabilities` pour accepter `component` comme filtre optionnel.
3. **Mise à jour du Manifeste :**
   - Ajoute `component: "nom-du-composant"` dans `readystate-manifest.yml`.

## <Task 16: API de Synchronisation Universelle (Push CI) & Garbage Collection>
**Objectif :** Remplacer la dépendance au webhook GitHub par une API universelle `POST /api/sync` adaptée aux monorepos, et implémenter le "Garbage Collection" (suppression des capacités retirées du code).

1. **Mise à jour du Schéma (Prisma) :**
   - Dans `schema.prisma`, ajoute un champ `componentType String?` au modèle `Capability`.
   - Exécute `npx prisma db push --accept-data-loss`.
2. **Création de l'API Push (`src/index.ts`) :**
   - Crée une route `POST /api/sync`.
   - Sécurisation : Vérifie le header `Authorization: Bearer <WRITE_TOKEN>`.
   - Entrées : Headers `x-environment` et `x-commit-sha`, body = fichier YAML brut.
   - Parsing : Lit `component` et `componentType` à la racine du YAML.
   - Synchro : Fait un `upsert` de toutes les capacités.
   - Garbage Collection : Fait un `deleteMany` pour supprimer les capacités de la base (pour ce composant + environnement) qui ne sont plus dans le YAML reçu.
3. **Mise à jour du Serveur MCP (`src/mcp.ts`) :**
   - Ajoute le support du filtre optionnel `componentType` dans `list_recent_capabilities`.
4. **Validation :**
   - Crée un script `scripts/test-sync.ts` simulant une CI qui envoie le manifeste via `curl/fetch` vers l'API.