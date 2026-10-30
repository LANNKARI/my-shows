# Actor pages

Click an actor's image or name in a title's cast list to open `/actors/{TMDB person ID}`.

The public API `/api/actors/{id}` reads Russian person details and combined acting credits from TMDB. If the biography is missing, it requests the English biography and labels the fallback. Missing dates, images, biography and roles have explicit empty states. Failed sources return a retryable 503; a real missing person returns 404. TMDB reads use a seven-second timeout and six-hour cache. The public actor response has no personal library data or database writes.

Acting credits combine repeated roles by media type and TMDB ID. Film and series filters, popularity/date sorting and batches of 24 are handled in the browser. Long titles stay contained; full title text is available in the link's accessible name and tooltip.

Authenticated users load library badges separately from `/api/actors/{id}/library`. The server derives the account from the session, matches its titles by both media type and TMDB ID, and disables caching. Guests never request this endpoint. A library failure leaves the public profile usable and provides a retry.

Filmography links include `source=tmdb` and the media type so local Show IDs cannot shadow a credited title with the same number. Existing local links retain their previous meaning. The actor feature needs no database migration. It uses the existing TMDB server credentials.

Validation includes source fixtures for biography fallback, malformed data and deduplication; real local database/API tests for owner scoping and ID collisions; browser checks for responsive layout, filters, sorting, pagination, errors and cast links. External TMDB delivery and production credentials are not verified by fixture tests.

Filmography excludes TMDB television genres News (10763), Reality (10764) and Talk (10767), and credits explicitly labelled as self/host/presenter/guest appearances, including ceremonies marked as movies. This filtering happens before deduplication and sorting, so all tabs, counts and private badges use the same selection. Titles are not filtered by name: fictional works containing the word “show” stay eligible. Accuracy depends on the genres and roles supplied by TMDB.
