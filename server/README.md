# LogixStore — Serveur central (LAN)

Serveur Fastify + PostgreSQL qui synchronise les terminaux POS (POS-01…POS-10) et
les écrans client (DISPLAY-01…DISPLAY-06) sur le réseau local du magasin.

## 1. Prérequis

- Node.js 20+
- PostgreSQL 14+ (avec `pg_dump` / `pg_restore` disponibles dans le `PATH` pour les sauvegardes)
- Un poste « serveur » avec une IP LAN fixe (ex. `192.168.1.10`)

## 2. Installation

```bash
cd server
cp .env.example .env      # puis éditez les valeurs
npm install
npm run db:push           # crée le schéma
npm run db:seed           # données initiales (idempotent)
npm run dev               # développement
# ou
npm run build && npm start
```

Vérification : `http://IP_SERVEUR:3000/api/health`

## 3. Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `PORT` | Port d'écoute (défaut 3000) |
| `SERVER_LAN_IP` | IP LAN annoncée aux terminaux |
| `DATABASE_URL` | Connexion PostgreSQL |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Secrets de signature (32+ caractères aléatoires) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Durées de vie des jetons |
| `CORS_ORIGINS` | Origines autorisées, séparées par des virgules |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | Limitation de débit |
| `OWNER_DEFAULT_PASSWORD` | Mot de passe initial du compte `proprietaire` |
| `BACKUP_DIR` / `BACKUP_RETENTION_DAYS` | Dossier et rétention des sauvegardes |

Générer un secret : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## 4. Données créées par `db:seed`

Magasin + succursale, 6 rôles avec permissions, compte `proprietaire`,
licence `pro`, terminaux POS-01…POS-10 et DISPLAY-01…DISPLAY-06,
unités, catégories de base et paramètres en français.

**Première connexion :** identifiant `proprietaire`, mot de passe
`OWNER_DEFAULT_PASSWORD` — à changer immédiatement.

## 5. API principale

Authentification : `Authorization: Bearer <access_token>`.

- **Auth** — `POST /api/auth/login`, `/refresh`, `/logout`, `/register-terminal`, `GET /api/auth/me`
- **Catalogue** — `GET|POST /api/products`, `GET|PUT|DELETE /api/products/:id`, idem `/api/categories`
- **Stock** — `GET /api/inventory`, `/inventory/low-stock`, `/inventory/movements`, `POST /api/inventory/adjust`
- **Ventes** — `GET|POST /api/sales`, `GET /api/sales/:id`, `POST /api/sales/:id/void`
- **Clients** — `GET /api/customers`
- **Rapports** — `GET /api/reports/*`
- **Terminaux** — `GET /api/terminals`, `POST /api/terminals/heartbeat`
- **Licences** — `GET /api/licenses/current`, `POST /api/licenses/activate|deactivate|generate-key|check`
- **Sauvegardes** — `GET|POST /api/backups`, `POST /api/backups/verify|restore|purge`
- **Synchronisation** — `GET /api/sync/pull`, `GET /api/sync/status`, `POST /api/sync/push`
- **Temps réel** — WebSocket `ws://IP_SERVEUR:3000/ws?token=<access_token>`

## 6. Synchronisation

Chaque terminal accumule ses opérations hors ligne dans une file locale puis
appelle `POST /api/sync/push`. Le serveur applique la résolution de conflits par
`version` (le serveur gagne si sa version est plus récente et renvoie
`status: "conflict"`), puis diffuse les changements via WebSocket. Les terminaux
rattrapent l'historique avec `GET /api/sync/pull?since=<curseur>`.

## 7. Sauvegardes

Automatiques toutes les 6 heures dans `BACKUP_DIR`, avec empreinte SHA-256 et
purge selon `BACKUP_RETENTION_DAYS`.

```bash
npm run backup          # sauvegarde manuelle
npm run backup:verify   # vérifie les empreintes
npm run restore -- <fichier.dump>
```

## 8. Exploitation

- Ouvrir le port `3000` sur le pare-feu du poste serveur (LAN uniquement).
- Ne jamais exposer le serveur directement sur Internet.
- Garder l'IP du serveur fixe (réservation DHCP) : les terminaux la mémorisent.
- Journalisation d'audit activée pour les actions sensibles (licences, sauvegardes, annulations de vente).

## 9. Dépannage

| Symptôme | Cause probable |
| --- | --- |
| `ECONNREFUSED` au démarrage | `DATABASE_URL` incorrect ou PostgreSQL arrêté |
| Terminal en 🔴 | Mauvaise IP serveur, pare-feu, ou terminal non enregistré |
| `pg_dump: command not found` | Outils clients PostgreSQL absents du `PATH` |
| 401 permanent | Secrets JWT modifiés après émission des jetons — reconnectez les terminaux |
