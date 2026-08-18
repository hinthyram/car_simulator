# V15.3 API diagnostic build

This version changes only the map API error reporting.

If the map list cannot connect, the page shows:
- exact API URL
- network vs HTTP error
- HTTP status and response body when available
- current page origin

It also logs the same details in the browser console.

No Render server/database code and no vehicle physics code are changed.
