import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as AR from "fp-ts/lib/Array";
import * as express from "express";
import * as bodyParser from "body-parser";
import { pipe } from "fp-ts/lib/function";
import amazonSearch from "./AmazonScrape";
import { SearchPayload } from "./utils/requestTypes";
import ebaySearch from "./EbayScrape";

const app = express();
const port = 3000;

// Parse the incoming request body. This is needed by Passport spid strategy.
app.use(
  bodyParser.json({
    verify: (_req, res: express.Response, buf, _encoding: BufferEncoding) => {
      // eslint-disable-next-line functional/immutable-data
      res.locals.body = buf;
    },
  })
);

// Parse an urlencoded body.
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/amazon", (req: express.Request, res) =>
  pipe(
    req.body,
    SearchPayload.decode,
    E.mapLeft((errs) => res.status(400).send({ error: errs })),
    TE.fromEither,
    TE.chainW(({ toSearch, numberOfPages }) =>
      amazonSearch(toSearch, numberOfPages)
    ),
    TE.map((items) => res.status(200).json({ items, size: items.length })),
    TE.mapLeft((err) => res.status(500).json({ error: String(err) }))
  )()
);

app.post("/ebay", (req: express.Request, res) =>
  pipe(
    req.body,
    SearchPayload.decode,
    E.mapLeft((errs) => res.status(400).send({ error: errs })),
    TE.fromEither,
    TE.chainW(({ toSearch, numberOfPages }) =>
      ebaySearch(toSearch, numberOfPages)
    ),
    TE.map((items) => res.status(200).json({ items, size: items.length })),
    TE.mapLeft((err) => res.status(500).json({ error: String(err) }))
  )()
);

app.post("/all", (req: express.Request, res) =>
  pipe(
    req.body,
    SearchPayload.decode,
    E.mapLeft((errs) => res.status(400).send({ error: errs })),
    TE.fromEither,
    TE.chainW(({ toSearch, numberOfPages }) =>
      pipe(
        [
          amazonSearch(toSearch, numberOfPages),
          ebaySearch(toSearch, numberOfPages),
        ],
        AR.sequence(TE.ApplicativePar),
        TE.map(AR.flatten)
      )
    ),
    TE.map((items) => res.status(200).json({ items, size: items.length })),
    TE.mapLeft((err) => res.status(500).json({ error: String(err) }))
  )()
);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Example app listening on port ${port}`);
});
