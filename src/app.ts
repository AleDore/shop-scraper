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
import { RedisClientMode, RedisClientSelector } from "./utils/redis";
import { getConfigOrThrow } from "./utils/config";
import { createRequestSubscriber } from "./subscribers/requestSub";

const config = getConfigOrThrow();

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createApp = async () => {
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

  const REDIS_CLIENT = await pipe(
    TE.tryCatch(
      () =>
        RedisClientSelector(false)(
          config.REDIS_URL,
          config.REDIS_PASSWORD,
          config.REDIS_PORT
        ),
      E.toError
    ),
    TE.map((selector) => selector.selectOne(RedisClientMode.FAST)),
    TE.mapLeft((e) => Error(`Cannot Get Redis Client|${String(e)}`)),
    TE.bindTo("redisClient"),
    TE.chain(({ redisClient }) =>
      pipe(
        createRequestSubscriber(redisClient),
        TE.mapLeft((e) =>
          Error(`Error while subscribing Redis Client to PubSub|${String(e)}`)
        ),
        TE.map(() => redisClient)
      )
    ),
    TE.getOrElse((err) => {
      throw err;
    })
  )();

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
      TE.bind("redisResponse", ({ searchPayload, requestId }) =>
        pipe(
          TE.tryCatch(
            () =>
              REDIS_CLIENT.set(
                requestId,
                JSON.stringify({ status: "ACCEPTED" })
              ),
            E.toError
          ),
          TE.chain(() =>
            TE.tryCatch(
              () =>
                REDIS_CLIENT.publish(
                  "searchRequest",
                  JSON.stringify({
                    requestId,
                    searchPayload,
                  })
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

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Example app listening on port ${port}`);
  });
};
