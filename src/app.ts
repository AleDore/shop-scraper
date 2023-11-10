/* eslint-disable no-console */
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as J from "fp-ts/lib/Json";
import * as TE from "fp-ts/lib/TaskEither";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as ulid from "ulid";
import { flow, pipe } from "fp-ts/lib/function";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import amazonSearch from "./AmazonScrape";
import { SearchPayload, SearchResults } from "./utils/types";
import ebaySearch from "./EbayScrape";
import { getConfigOrThrow } from "./utils/config";
import { getRedisClient } from "./utils/redis";
import { createRequestSubscriber } from "./subscribers/requestSub";

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

  const REDIS_CLIENT = await getRedisClient(
    config.REDIS_URL,
    config.REDIS_PASSWORD,
    config.REDIS_PORT
  )(createRequestSubscriber)();

  app.get("/info", (_: express.Request, res) =>
    res.status(200).json({ status: "OK" })
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

  app.post("/search", (req: express.Request, res) =>
    pipe(
      req.body,
      SearchPayload.decode,
      E.mapLeft((errs) => res.status(400).send({ error: errs })),
      TE.fromEither,
      TE.bindTo("searchPayload"),
      TE.bind("requestId", () => pipe(ulid.ulid(), TE.right)),
      TE.bind("redisResponse", ({ requestId, searchPayload }) =>
        pipe(
          TE.tryCatch(
            () =>
              REDIS_CLIENT.set(
                requestId,
                JSON.stringify({ status: "PENDING" })
              ),
            E.toError
          ),
          TE.chain(() =>
            TE.tryCatch(
              () =>
                REDIS_CLIENT.publish(
                  "searchRequest",
                  JSON.stringify({ requestId, searchPayload })
                ),
              E.toError
            )
          )
        )
      ),
      TE.map(({ requestId }) => res.status(202).json({ requestId })),
      TE.mapLeft((err) => res.status(500).json({ error: String(err) }))
    )()
  );

  app.get("/search/:requestId", (req: express.Request, res) =>
    pipe(
      req.params.requestId,
      O.fromNullable,
      TE.fromOption(() =>
        res.status(400).send({ error: "No given requestID" })
      ),
      TE.bindTo("requestId"),
      TE.bindW("requestStatus", ({ requestId }) =>
        TE.tryCatch(() => REDIS_CLIENT.get(requestId), E.toError)
      ),
      TE.bind("searchResponse", ({ requestStatus }) =>
        pipe(
          requestStatus,
          J.parse,
          E.mapLeft(E.toError),
          E.chain(
            flow(
              SearchResults.decode,
              E.mapLeft((errs) =>
                Error(errorsToReadableMessages(errs).join("|"))
              )
            )
          ),
          TE.fromEither
        )
      ),
      TE.map(({ requestId, searchResponse }) =>
        res.status(200).json({ requestId, ...searchResponse })
      ),
      TE.mapLeft((err) => res.status(500).json({ error: String(err) }))
    )()
  );

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Example app listening on port ${port}`);
  });
};

createApp().then(console.log).catch(console.error);
