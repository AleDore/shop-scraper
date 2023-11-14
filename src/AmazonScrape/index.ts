import * as TE from "fp-ts/TaskEither";
import { getConfigOrThrow } from "../utils/config";
import { SearchPayload } from "../utils/types";
import { withBrowser } from "../utils/puppeteer";
import { scrapeAmazonHandler } from "./handler";

const config = getConfigOrThrow();

export const amazonSearch = (
  searchPayload: SearchPayload,
  pageNumber: number
): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
  withBrowser(
    scrapeAmazonHandler(config.AMAZON_SEARCH_URL, searchPayload, pageNumber)
  );

export default amazonSearch;
