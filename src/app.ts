/* eslint-disable no-console */
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as J from "fp-ts/lib/Json";
import * as TE from "fp-ts/lib/TaskEither";
import * as NAR from "fp-ts/lib/NonEmptyArray";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as ulid from "ulid";
import { flow, pipe } from "fp-ts/lib/function";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import {
  SearchRequestMessagePayload,
  SearchPayload,
  SearchResults,
  SearchResultsPage,
  PageSearchRequestMessagePayload,
} from "./utils/types";
import { getConfigOrThrow } from "./utils/config";
import { getSimpleRedisClient } from "./utils/redis";
import { createQueueListener, enqueue, getQueueClient } from "./utils/queue";
import {
  searchRequestMessageHandler,
  pageRequestMessageHandler,
} from "./listeners/queue";
import amazonSearch from "./AmazonScrape";
import ebaySearch from "./EbayScrape";
import { withBrowser } from "./utils/puppeteer";
import { initializeAndGetProxies } from "./utils/proxies";

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

  const proxies = config.ENABLE_PROXIES ? await initializeAndGetProxies() : [];

  const REDIS_CLIENT = await getSimpleRedisClient(
    config.REDIS_URL,
    config.REDIS_PASSWORD,
    config.REDIS_PORT
  )();

  const QUEUE_CLIENT = await getQueueClient(
    config.STORAGE_CONN_STRING,
    config.SEARCH_REQUEST_QUEUE_NAME
  )();

  const PAGE_QUEUE_CLIENT = await getQueueClient(
    config.STORAGE_CONN_STRING,
    config.PAGE_SEARCH_REQUEST_QUEUE_NAME
  )();

  createQueueListener(QUEUE_CLIENT, 5000)(
    SearchRequestMessagePayload,
    searchRequestMessageHandler(PAGE_QUEUE_CLIENT)
  ).catch(console.error);

  createQueueListener(PAGE_QUEUE_CLIENT, 5000)(
    PageSearchRequestMessagePayload,
    pageRequestMessageHandler(REDIS_CLIENT, proxies)
  ).catch(console.error);

  const enqueueMessage = enqueue(QUEUE_CLIENT);

  app.get("/info", (_: express.Request, res) =>
    res.status(200).json({ status: "OK" })
  );

  app.get("/sample", (_: express.Request, res) =>
    pipe(
      NAR.range(1, 2),
      NAR.map((p) => ({
        page: p,
        searchPayload: {
          numberOfPages: 2,
          toSearch: "Oppo Find",
        } as SearchPayload,
      })),
      NAR.map(({ page, searchPayload }) =>
        pipe(
          withBrowser(proxies)([
            amazonSearch(searchPayload, page),
            ebaySearch(searchPayload, page),
          ]),
          TE.map(NAR.flatten)
        )
      ),
      NAR.sequence(TE.ApplicativeSeq),
      TE.map(NAR.flatten),
      TE.map((results) => res.status(202).json({ results })),
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
            enqueueMessage(JSON.stringify({ requestId, searchPayload }))
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

  app.get("/search/:requestId/page/:pageNumber", (req: express.Request, res) =>
    pipe(
      req.params.requestId,
      O.fromNullable,
      TE.fromOption(() =>
        res.status(400).send({ error: "No given requestID" })
      ),
      TE.bindTo("requestId"),
      TE.bind("pageNum", () =>
        pipe(
          req.params.pageNumber,
          O.fromNullable,
          TE.fromOption(() =>
            res.status(400).send({ error: "No given pageNumber" })
          )
        )
      ),
      TE.bindW("requestPage", ({ requestId, pageNum }) =>
        TE.tryCatch(
          () => REDIS_CLIENT.get(`${requestId}-${pageNum}`),
          E.toError
        )
      ),
      TE.bind("searchResponse", ({ requestPage }) =>
        pipe(
          requestPage,
          J.parse,
          E.mapLeft(E.toError),
          E.chain(
            flow(
              SearchResultsPage.decode,
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
