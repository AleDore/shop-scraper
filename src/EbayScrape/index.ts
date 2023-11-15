import * as TE from "fp-ts/TaskEither";
import { Browser } from "puppeteer";
import { getConfigOrThrow } from "../utils/config";
import { SearchPayload } from "../utils/types";
import { scrapeEbayHandler } from "./handler";

const config = getConfigOrThrow();

export const ebaySearch =
  (searchPayload: SearchPayload, pageNumber: number) =>
  (browser: Browser): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
    scrapeEbayHandler(
      config.EBAY_SEARCH_URL,
      searchPayload,
      pageNumber
    )(browser);

export default ebaySearch;
