import * as TE from "fp-ts/TaskEither";
import { getConfigOrThrow } from "../utils/config";
import { SearchPayload } from "../utils/types";
import { withBrowser } from "../utils/puppeteer";
import { scrapeEbayHandler } from "./handler";

const config = getConfigOrThrow();

export const ebaySearch = (
  searchPayload: SearchPayload,
  pageNumber: number
): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
  withBrowser(
    scrapeEbayHandler(config.EBAY_SEARCH_URL, searchPayload, pageNumber)
  );

export default ebaySearch;
