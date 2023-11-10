/* eslint-disable no-console */
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as ulid from "ulid";
import { pipe } from "fp-ts/lib/function";
import amazonSearch from "./AmazonScrape";
import { SearchPayload } from "./utils/types";
import ebaySearch from "./EbayScrape";
import { createSimpleRedisClient } from "./utils/redis";
import { getConfigOrThrow } from "./utils/config";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createApp = async () => {
  const config = getConfigOrThrow();
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

  app.get("/info", (_: express.Request, res) =>
    res.status(200).json({ status: "OK" })
  );

  app.post("/redis", (_: express.Request, res) =>
    pipe(
      TE.tryCatch(
        () =>
          createSimpleRedisClient(false)(
            config.REDIS_URL,
            config.REDIS_PASSWORD,
            config.REDIS_PORT
          ),
        E.toError
      ),
      TE.map(() => res.status(200).json({ status: "OK" })),
      TE.mapLeft((err) => res.status(500).json({ error: String(err) }))
    )()
  );

  app.post("/amazon", (req: express.Request, res) =>
    pipe(
      req.body,
      SearchPayload.decode,
      E.mapLeft((errs) => res.status(400).send({ error: errs })),
      TE.fromEither,
      TE.chainW((searchPayload) => amazonSearch(searchPayload)),
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
      TE.chainW((searchPayload) => ebaySearch(searchPayload)),
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
      TE.bindTo("searchPayload"),
      TE.bind("requestId", () => pipe(ulid.ulid(), TE.right)),
      TE.map(({ requestId }) => res.status(202).json({ requestId })),
      TE.mapLeft((err) => res.status(500).json({ error: String(err) }))
    )()
  );

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Example app listening on port ${port}`);
  });
};

createApp().then(console.log).catch(console.error);
