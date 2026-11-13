# Atlas Search index for ranking player search

Typo-tolerant name search on `/rankings/...` ("sarma" finds "Sharma").
Code: `src/shared/services/ranking/atlasPlayerSearch.ts`. It is OFF until
`ATLAS_SEARCH_ENABLED=true`, and when it is on, its matches are added to the
regex matches, so a missing index never breaks the page.

## Create the index (Atlas UI, Search, Create Search Index, JSON editor)

- Database: `Powermysport` (this is production, there is no other)
- Collection: `rankingentries`
- Index name: `ranking_name_search` (must match exactly)

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "fullName": [
        { "type": "string", "analyzer": "lucene.standard" },
        {
          "type": "autocomplete",
          "analyzer": "lucene.standard",
          "tokenization": "edgeGram",
          "minGrams": 2,
          "maxGrams": 15,
          "foldDiacritics": true
        }
      ],
      "sportSlug": { "type": "token" },
      "category": { "type": "token" },
      "subcategory": { "type": "token" },
      "state": { "type": "token" },
      "isLatest": { "type": "boolean" },
      "asOnDate": { "type": "date" }
    }
  }
}
```

The collection holds ~468k archived rows beside the current lists, so the first
build takes a few minutes. Search indexes add to storage; check the cluster's
usage first.

## Turn on

1. Wait until the index shows status ACTIVE.
2. Set `ATLAS_SEARCH_ENABLED=true` on the server and deploy (`npm run deploy`).
3. Try `/rankings/tennis/<category>/<subcategory>?search=sarma`.

Turn off by unsetting the variable. No migration is involved.
