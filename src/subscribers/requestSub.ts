import { constVoid, flow, pipe } from "fp-ts/lib/function";
import { RedisClientType } from "redis";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as J from "fp-ts/Json";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { searchAllShop } from "../utils/search";
import { RequestMessagePayload } from "../utils/types";

export const createRequestSubscriber = (
  redisSubcriberClient: RedisClientType,
  redisClient: RedisClientType
): TE.TaskEither<Error, void> =>
  TE.tryCatch(
    () =>
      redisSubcriberClient.subscribe("searchRequest", (message, channel) => {
        // eslint-disable-next-line no-console
        console.log(`message ${message} received on channel ${channel}`);
        return pipe(
          message,
          J.parse,
          E.mapLeft(E.toError),
          E.chain(
            flow(
              RequestMessagePayload.decode,
              E.mapLeft((errs) =>
                Error(errorsToReadableMessages(errs).join("|"))
              )
            )
          ),
          TE.fromEither,
          TE.chain(({ requestId, searchPayload }) =>
            pipe(
              searchAllShop(redisClient, requestId, searchPayload),
              TE.chain(() =>
                TE.tryCatch(
                  () =>
                    redisClient.set(
                      requestId,
                      JSON.stringify({
                        numOfPages: searchPayload.numberOfPages,
                        status: "OK",
                      })
                    ),
                  E.toError
                )
              ),
              TE.orElse((err) =>
                TE.tryCatch(
                  () =>
                    redisClient.set(
                      requestId,
                      JSON.stringify({ error: String(err), status: "KO" })
                    ),
                  E.toError
                )
              )
            )
          ),
          // eslint-disable-next-line no-console
          TE.bimap(console.error, constVoid),
          TE.toUnion
        )();
      }),
    E.toError
  );
