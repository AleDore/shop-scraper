import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as AR from "fp-ts/NonEmptyArray";
import {
  autoScroll,
  awaitForSelector,
  evaluatePageElements,
  launchBrowser,
  loadPage,
} from "../utils/puppeteer";
import { SearchPayload } from "../utils/types";

export const scrapeAliExpressHandler = (
  url: NonEmptyString,
  searchPayload: SearchPayload
): TE.TaskEither<Error, ReadonlyArray<unknown>> =>
  pipe(
    launchBrowser(),
    // loading landing page
    TE.chain((browser) =>
      pipe(
        AR.range(1, searchPayload.numberOfPages),
        AR.map((resPage) =>
          pipe(
            browser,
            loadPage(
              `${url}/w/wholesale-${searchPayload.toSearch
                .split(" ")
                .join("-")}.html?page=${resPage}`
            ),
            TE.chain(awaitForSelector("div[id='card-list']")),
            TE.chain(autoScroll(200)),
            TE.chain(
              evaluatePageElements(() => {
                const pageResults = document.querySelectorAll(
                  "a[class*='search-card-item']"
                );
                // eslint-disable-next-line no-useless-escape
                const re = /<\!--.*?-->/g;
                return Array.from(pageResults).map((res) => ({
                  description: res
                    .querySelector(
                      "div[class*='multi--title'] > h1[class*='multi--titleText']"
                    )
                    ?.innerHTML.replace(re, "")
                    .replace(/<.*>/, ""),
                  imageUrl: res
                    .querySelector("div[class*='images--imageWindow']")
                    ?.getElementsByTagName("img")[0]?.src,
                  price: Array.from(
                    res.querySelector("div[class*='multi--price-sale']")
                      ?.children
                  )
                    .map((e) => e.innerHTML)
                    .join(""),
                }));
              })
            ),
            TE.map((r) => r.filter((e) => e.price !== ""))
          )
        ),
        AR.sequence(TE.ApplicativeSeq)
      )
    ),
    TE.map(AR.flatten)
  );
