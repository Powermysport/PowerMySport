# Atlas Search index for community people search

Typo-tolerant, as-you-type search for parents on the community Discover page.
Code: `communityPeopleSearch.ts`. It is OFF until `ATLAS_SEARCH_ENABLED=true`, and
when it is on a missing or failing index falls back to the old query.

Without it, every keystroke makes MongoDB read every user (an unanchored regex
cannot use an index). With it, the name is answered from the search index.

## Create the index (Atlas UI, Search, Create Search Index, JSON editor)

- Database: `Powermysport` (this is production, there is no other)
- Collection: `users`
- Index name: `user_name_search` (must match exactly)

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "name": [
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
      "role": { "type": "token" }
    }
  }
}
```

Only `name` and `role` are indexed. No email, phone, address or date of birth
goes into the search index.

## Turn on

1. Wait until the index shows status ACTIVE. Check the cluster's storage first.
2. Set `ATLAS_SEARCH_ENABLED=true` on the server (the same switch the ranking
   search uses) and deploy (`npm run deploy`).
3. Search a parent's first or last name on the community Discover page.

Turn off by unsetting the variable. No migration is involved.
