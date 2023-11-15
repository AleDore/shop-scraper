import { constVoid, pipe } from "fp-ts/lib/function";
import * as AR from "fp-ts/NonEmptyArray";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { RedisClientType } from "redis";
import amazonSearch from "../AmazonScrape";
import ebaySearch from "../EbayScrape";
import { SearchPayload } from "./types";
import { delay } from "./promise";
import { withBrowser } from "./puppeteer";

export const searchAllShop = (
  redisClient: RedisClientType,
  requestId: string,
  searchPayload: SearchPayload
): TE.TaskEither<Error, void> =>
  pipe(
    AR.range(1, searchPayload.numberOfPages),
    AR.map((pageNum) =>
      pipe(
        withBrowser([
          amazonSearch(searchPayload, pageNum),
          ebaySearch(searchPayload, pageNum),
        ]),
        TE.map(AR.flatten),
        TE.chain((results) =>
          TE.tryCatch(
            () =>
              redisClient.set(
                `${requestId}-${pageNum}`,
                JSON.stringify({ page: pageNum, results })
              ),
            E.toError
          )
        ),
        TE.chain(() => delay(2000))
      )
    ),
    AR.sequence(TE.ApplicativeSeq),
    TE.map(constVoid)
  );
