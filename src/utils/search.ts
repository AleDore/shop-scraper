import { constVoid, pipe } from "fp-ts/lib/function";
import * as AR from "fp-ts/NonEmptyArray";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { RedisClientType } from "redis";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import amazonSearch from "../AmazonScrape";
import ebaySearch from "../EbayScrape";
import { SearchPayload } from "./types";
import { delay } from "./promise";
import { withBrowser } from "./puppeteer";

export const searchAllShop =
  (proxies: ReadonlyArray<NonEmptyString>) =>
  (
    redisClient: RedisClientType,
    requestId: string,
    searchPayload: SearchPayload,
    pageNum: number
  ): TE.TaskEither<Error, void> =>
    pipe(
      withBrowser(proxies)([
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
      TE.chain(() => delay(2000)),
      TE.map(constVoid)
    );
