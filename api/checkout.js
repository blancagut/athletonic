// Consolidated route: `/api/checkout` is served by the canonical handler in
// `api/checkout/index.js` (server-side pricing + private pricing + the 13-arg
// `create_pending_order` RPC). This thin re-export removes the previous dual
// implementation so the route is unambiguous regardless of file resolution,
// mirroring how `api/checkout-quote.js` re-exports `api/checkout/quote.js`.
module.exports = require("./checkout/index");
