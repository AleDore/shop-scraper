import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import * as TE from "fp-ts/TaskEither";
import { getConfigOrThrow } from "../utils/config";
import { scrapeAmazonHandler } from "./handler";

const config = getConfigOrThrow();

export const amazonSearch = (
  toSearch: NonEmptyString,
  numberOfPages: NonNegativeInteger = 1 as NonNegativeInteger
): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
  scrapeAmazonHandler(config.AMAZON_SEARCH_URL, toSearch, numberOfPages);

export default amazonSearch;
