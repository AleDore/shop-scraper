import * as TE from "fp-ts/TaskEither";
import { Browser } from "puppeteer";
import { getConfigOrThrow } from "../utils/config";
import { SearchPayload } from "../utils/types";
import { scrapeAmazonHandler } from "./handler";

const config = getConfigOrThrow();

export const amazonSearch =
  (searchPayload: SearchPayload, pageNumber: number) =>
  (browser: Browser): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
    scrapeAmazonHandler(
      config.AMAZON_SEARCH_URL,
      searchPayload,
      pageNumber
    )(browser);

export default amazonSearch;
