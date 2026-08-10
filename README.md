# Wikidata EventStream Real-Time Tracker 🚀

Un serveur Node.js et tableau de bord en temps réel permettant d'écouter les modifications du flux mondial de Wikidata (Wikimedia EventStream / SSE), de filtrer en direct les entités (Q-IDs) que vous souhaitez suivre (ex: `Q42`, `Q76`, `Q11571`), de mettre à jour automatiquement leurs données via l'API Wikidata et de déclencher des réactions (base de données, Webhooks, notifications).

---

## 🌟 Fonctionnalités

1. **Écoute du flux SSE Wikimedia (`/v2/stream/recentchange`)**
   - Connexion résiliente avec reconnexion automatique en cas de coupure réseau.
   - Filtrage haute performance des événements concernant l'espace de noms `wikidatawiki`.
   - Traitement de dizaines de modifications par seconde en arrière-plan.

2. **Moteur de Matching de Liste de Suivi (Watchlist)**
   - Extraction automatique des Q-IDs (`Q...`), P-IDs (`P...`) ou L-IDs à partir du titre ou de l'URI de la modification.
   - Vérification instantanée par rapport à la liste d'entités enregistrées.

3. **Interrogation Automatique de l'API Wikidata**
   - Dès qu'un match survient, le serveur interroge l'API `wbgetentities` de Wikidata pour récupérer le nouvel état complet (libellé, description, alias, nombre de déclarations, sitelinks Wikipédia).

4. **Système de Réaction & Webhooks**
   - Enregistrement de l'historique dans une base de données locale (`data.json` / SQLite).
   - Déclenchement automatique de Webhooks personnalisés (POST JSON vers n'importe quelle URL externe ou Discord/Slack).

5. **Tableau de Bord Web Moderne**
   - Visualisation de la vitesse du flux en direct (événements/sec, total analysé, matches).
   - Module de recherche et d'autocomplétion des entités Wikidata par mot-clé avec ajout rapide.
   - Journal en direct des modifications capturées avec badge Bot/Humain, commentaire et liens vers le Diff Wikidata.
   - Modale d'inspection des entités et visualiseur JSON.
   - Panneau de configuration des filtres (ignorer les bots, basculer l'auto-fetch API, tester le webhook).

---

## 🚀 Démarrage Rapide

### 1. Installation des dépendances
```bash
npm install
```

### 2. Lancement du serveur
```bash
npm start
```

Ou en mode développement (rechargement automatique Node.js 20+) :
```bash
npm run dev
```

### 3. Accès au Tableau de Bord
Ouvrez votre navigateur sur : **`http://localhost:3000`**

---

## 📡 API REST

- `GET /api/tracked` : Récupérer la liste des entités suivies
- `POST /api/tracked` : Ajouter une entité à la liste de suivi (`{ "entityId": "Q42" }`)
- `DELETE /api/tracked/:id` : Supprimer une entité de la liste
- `GET /api/events` : Obtenir l'historique des modifications capturées
- `POST /api/events/clear` : Effacer l'historique
- `GET /api/search?q=query` : Rechercher des entités Wikidata par mot-clé
- `GET /api/entity/:id` : Consulter les données en direct d'un Q-ID
- `PUT /api/settings` : Mettre à jour la configuration (Webhook URL, ignorer les bots)
- `POST /api/webhook/test` : Envoyer une notification Webhook de test

---

## 🔔 Structure du Payload Webhook

Lorsqu'une entité suivie est modifiée, le serveur envoie un POST JSON :

```json
{
  "event": "WIKIDATA_ENTITY_MODIFIED",
  "entityId": "Q42",
  "user": "WikidataUser",
  "isBot": false,
  "comment": "/* wbsetclaim-update:2| */ [[Property:P31]]: [[Q5]]",
  "revisionId": "218492049",
  "diffUrl": "https://www.wikidata.org/w/index.php?diff=218492049&oldid=218490000",
  "timestamp": "2026-08-10T10:30:00.000Z",
  "snapshot": {
    "id": "Q42",
    "label": "Douglas Adams",
    "description": "English author and humorist (1952–2001)",
    "claimCount": 65,
    "sitelinkCount": 120
  }
}
```
