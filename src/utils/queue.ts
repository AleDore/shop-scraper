/* eslint-disable no-console */
import { QueueClient, QueueServiceClient } from "@azure/storage-queue";

import { constVoid, flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import * as B from "fp-ts/lib/boolean";
import * as E from "fp-ts/lib/Either";
import * as AR from "fp-ts/lib/Array";
import * as J from "fp-ts/lib/Json";
import * as t from "io-ts";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { asyncIteratorToArray } from "./async";

export const enqueue =
  (queueClient: QueueClient) =>
  (textMessage: string): TE.TaskEither<Error, void> =>
    pipe(
      TE.tryCatch(() => queueClient.createIfNotExists(), E.toError),
      TE.chain(() =>
        TE.tryCatch(() => queueClient.sendMessage(textMessage, {}), E.toError)
      ),
      TE.map(constVoid)
    );

export const dequeue =
  <A, S>(queueClient: QueueClient, decoder: t.Type<S, A>) =>
  (
    messageHandler: (item: S) => TE.TaskEither<Error, void>
  ): TE.TaskEither<Error, void> =>
    pipe(
      TE.tryCatch(() => queueClient.createIfNotExists(), E.toError),
      TE.chain(() =>
        TE.tryCatch(() => queueClient.receiveMessages(), E.toError)
      ),
      TE.map((response) => response.receivedMessageItems),
      TE.map(AR.head),
      TE.chain(
        flow(
          TE.fromOption(() => Error("No messages to dequeue")),
          TE.map((msg) => ({ existsMessage: true, msg })),
          TE.orElse(() => TE.of({ existsMessage: false, msg: undefined }))
        )
      ),
      TE.chain(({ existsMessage, msg }) =>
        pipe(
          existsMessage,
          B.fold(
            () => TE.right(void 0),
            () =>
              pipe(
                msg.messageText,
                J.parse,
                E.mapLeft(E.toError),
                E.chain(
                  flow(
                    decoder.decode,
                    E.mapLeft((errs) =>
                      Error(errorsToReadableMessages(errs).join("|"))
                    )
                  )
                ),
                TE.fromEither,
                TE.chain(messageHandler),
                TE.chain(() =>
                  TE.tryCatch(
                    () =>
                      queueClient.deleteMessage(msg.messageId, msg.popReceipt),
                    E.toError
                  )
                ),
                TE.map(constVoid)
              )
          )
        )
      )
    );

export const getQueueClient = (
  connectionUrl: string,
  queueName: string
): T.Task<QueueClient> =>
  pipe(
    QueueServiceClient.fromConnectionString(connectionUrl),
    (queueServiceClient) =>
      pipe(
        queueServiceClient.listQueues(),
        (iter) => TE.tryCatch(() => asyncIteratorToArray(iter), E.toError),
        TE.map((queueItems) =>
          queueItems.map((queueItem) => queueItem.name).includes(queueName)
        ),
        TE.chain(
          B.fold(
            () =>
              pipe(
                TE.tryCatch(
                  () => queueServiceClient.createQueue(queueName),
                  E.toError
                ),
                TE.map(constVoid)
              ),
            () => TE.right<Error, void>(void 0)
          )
        ),
        TE.map(() => queueServiceClient.getQueueClient(queueName))
      ),
    TE.getOrElse((err) => {
      throw err;
    })
  );

const delay = (pollingIntervalMs: number): TE.TaskEither<never, void> =>
  pipe(T.delay(pollingIntervalMs)(T.of(void 0)), TE.fromTask);

export const createQueueListener =
  <A, S>(queueClient: QueueClient, pollingIntervalMs: number) =>
  async (
    decoder: t.Type<S, A>,
    messageHandler: (item: S) => TE.TaskEither<Error, void>
  ): Promise<void> => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await pipe(
        dequeue(queueClient, decoder)(messageHandler),
        TE.mapLeft((e) =>
          Error(`Error while processing item dequeue|ERROR=${String(e)}`)
        ),
        TE.orElseW((err) => {
          console.error(err);
          return delay(pollingIntervalMs);
        }),
        TE.chain(() => delay(pollingIntervalMs))
      )();
    }
  };
