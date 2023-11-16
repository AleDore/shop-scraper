import { constVoid, pipe } from "fp-ts/lib/function";
import { RedisClientType } from "redis";
import * as TE from "fp-ts/TaskEither";
import * as B from "fp-ts/boolean";
import * as NAR from "fp-ts/NonEmptyArray";
import * as E from "fp-ts/Either";
import { QueueClient } from "@azure/storage-queue";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  PageSearchRequestMessagePayload,
  SearchRequestMessagePayload,
} from "../utils/types";
import { searchAllShop } from "../utils/search";
import { enqueue } from "../utils/queue";

export const searchRequestMessageHandler =
  (queueClient: QueueClient) =>
  (item: SearchRequestMessagePayload): TE.TaskEither<Error, void> =>
    pipe(
      // eslint-disable-next-line no-console
      console.log(`searchRequestMessageHandler => ${JSON.stringify(item)}`),
      () =>
        pipe(
          NAR.range(1, item.searchPayload.numberOfPages),
          NAR.map((page) =>
            enqueue(queueClient)(
              JSON.stringify({
                page,
                requestId: item.requestId,
                searchPayload: item.searchPayload,
              })
            )
          ),
          NAR.sequence(TE.ApplicativeSeq)
        ),
      TE.map(constVoid)
    );

export const pageRequestMessageHandler =
  (redisClient: RedisClientType, proxyList: ReadonlyArray<NonEmptyString>) =>
  (item: PageSearchRequestMessagePayload): TE.TaskEither<Error, void> =>
    pipe(
      // eslint-disable-next-line no-console
      console.log(`requestMessagehandler => ${JSON.stringify(item)}`),
      () =>
        searchAllShop(proxyList)(
          redisClient,
          item.requestId,
          item.searchPayload,
          item.page
        ),
      TE.chain(() =>
        TE.tryCatch(
          () =>
            redisClient.mGet(
              NAR.range(1, item.searchPayload.numberOfPages).map(
                (p) => `${item.requestId}-${p}`
              )
            ),
          E.toError
        )
      ),
      TE.map(
        (processedPages) =>
          processedPages.length === item.searchPayload.numberOfPages
      ),
      TE.chain(
        B.foldW(
          () => TE.right(void 0),
          () =>
            TE.tryCatch(
              () =>
                redisClient.set(
                  item.requestId,
                  JSON.stringify({
                    numOfPages: item.searchPayload.numberOfPages,
                    status: "OK",
                  })
                ),
              E.toError
            )
        )
      ),
      TE.map(constVoid)
    );
