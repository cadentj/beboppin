```md
# Curius Public API Notes

Target profile used for reverse engineering:
- Profile URL: `https://curius.app/caden-juang`
- Resolved user slug: `caden-juang`
- Resolved user id: `6562`

## Core flow

The public profile page fetches:
1. `GET /api/users/:userLink`
2. `GET /api/users/:userId/links?page=0`

For this profile:

- `GET https://curius.app/api/users/caden-juang`
- `GET https://curius.app/api/users/6562/links?page=0`

No auth was required for these public endpoints.

## Endpoints

### 1. Resolve profile slug to user metadata
`GET /api/users/:userLink`

Example:
`GET https://curius.app/api/users/caden-juang`

Response shape:
```json
{
  "user": {
    "id": 6562,
    "firstName": "Caden",
    "lastName": "Juang",
    "userLink": "caden-juang",
    "website": "cadentj.com",
    "twitter": "kh4dien"
  }
}
```

Useful fields:
- `user.id`
- `user.firstName`
- `user.lastName`
- `user.userLink`

### 2. Main saved-links endpoint
`GET /api/users/:userId/links?page=0`

Example:
`GET https://curius.app/api/users/6562/links?page=0`

Response shape:
```json
{
  "userSaved": [
    {
      "id": 6450,
      "link": "https://worksinprogress.co/issue/the-speed-of-science",
      "title": "The speed of science - Works in Progress",
      "favorite": false,
      "snippet": "Critics of scientific reform maintain that transparency comes at the cost of speed.",
      "toRead": null,
      "createdBy": 585,
      "createdDate": "2026-04-15T21:11:03.112Z",
      "modifiedDate": "2026-04-15T22:07:14.197Z",
      "lastCrawled": null,
      "trails": [],
      "comments": [],
      "mentions": [],
      "topics": [],
      "highlights": []
    }
  ]
}
```

Useful fields for visualization:
- `id`
- `link`
- `title`
- `snippet`
- `favorite`
- `toRead`
- `createdDate`
- `modifiedDate`
- `topics[]`
- `highlights[]`
- `comments[]`

### 3. Lightweight link list
`GET /api/users/:userId/searchLinks`

Example:
`GET https://curius.app/api/users/6562/searchLinks`

Response shape:
```json
{
  "links": [
    {
      "id": 6450,
      "link": "https://worksinprogress.co/issue/the-speed-of-science",
      "title": "The speed of science - Works in Progress",
      "favorite": false,
      "snippet": "Critics of scientific reform maintain that transparency comes at the cost of speed.",
      "toRead": null,
      "createdDate": "2026-04-15T21:11:03.112Z",
      "modifiedDate": "2026-04-15T22:07:14.197Z",
      "lastCrawled": null
    }
  ]
}
```

This is useful if the UI only needs:
- title
- url
- snippet
- save/update timestamps
- basic flags

It does **not** include the richer arrays present in `userSaved`.

## Save date metadata

There does not appear to be a separate save-action endpoint needed for public reads.

Use `createdDate` from either:
- `/api/users/:userId/links?page=0`
- `/api/users/:userId/searchLinks`

Interpretation:
- `createdDate`: likely the save date for that link on the user’s shelf
- `modifiedDate`: last update to that saved record
- `createdBy`: original creator of the shared link object, not necessarily the shelf owner

For UI display, `createdDate` is the field to treat as “saved at”.

## Optional related endpoints

Observed on page load:
- `GET /api/user/topics?uid=:userId`
- `GET /api/trails/:userId`
- `GET /api/users/:userId/suggestedFollows`
- `GET /api/users/:userId/followingLinks`

These are not required for a basic link visualization UI.

## Filters observed in frontend bundle

The frontend constructs the links URL like:

```text
users/:id/links?page=:pageNumber
```

and conditionally appends:
- `&favorited=1`
- `&toRead=1`
- `&topicSlug=:slug`
- `&query=:searchString`

Observed logic in bundle indicates the endpoint supports filtered variants like:
- `/api/users/6562/links?page=0&favorited=1`
- `/api/users/6562/links?page=0&toRead=1`
- `/api/users/6562/links?page=0&topicSlug=work`
- `/api/users/6562/links?page=0&query=umap`

I did not fully validate all combinations, but the bundle clearly builds URLs this way.

## Practical integration recipe

1. Resolve slug to user id:
```ts
const profile = await fetch("https://curius.app/api/users/caden-juang").then(r => r.json());
const userId = profile.user.id;
```

2. Fetch rich links:
```ts
const data = await fetch(`https://curius.app/api/users/${userId}/links?page=0`).then(r => r.json());
const links = data.userSaved;
```

3. Map to UI model:
```ts
const items = links.map(x => ({
  id: x.id,
  title: x.title,
  url: x.link,
  snippet: x.snippet,
  savedAt: x.createdDate,
  updatedAt: x.modifiedDate,
  favorite: x.favorite,
  toRead: x.toRead,
  topicSlugs: (x.topics || []).map(t => t.slug),
  highlightCount: (x.highlights || []).length,
  commentCount: (x.comments || []).length
}));
```

## Example display fields

Good default card fields:
- `title`
- hostname from `link`
- `snippet`
- `savedAt`
- `favorite`
- topic badges from `topics[].slug`
- counts for `highlights.length` and `comments.length`

## Caveat

Response headers included:
- `Access-Control-Allow-Origin: http://localhost:8001`

So browser-side cross-origin fetches from arbitrary origins may hit CORS issues. If needed, use:
- server-side fetch
- local proxy
- same-origin dev setup
```