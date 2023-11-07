/* eslint-disable functional/no-let */
/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Browser, ElementHandle, Page } from "puppeteer";
import * as TE from "fp-ts/lib/TaskEither";
import { toError } from "fp-ts/lib/Either";
import * as puppeteer from "puppeteer";
import { pipe } from "fp-ts/lib/function";

export const launchBrowser = () =>
  TE.tryCatch(
    () =>
      puppeteer.launch({
        args: ["--disable-setuid-sandbox"],
        headless: "new",
        ignoreHTTPSErrors: true,
      }),
    toError
  );

export const openNewPage = (browser: Browser) =>
  TE.tryCatch(() => browser.newPage(), toError);

export const setViewPort = (page: Page) =>
  TE.tryCatch(() => page.setViewport({ height: 1080, width: 1920 }), toError);

export const goToUrl = (page: Page, url: string) =>
  TE.tryCatch(
    () => page.goto(url, { timeout: 0, waitUntil: "networkidle2" }),
    toError
  );

export const awaitForSelector = (selector: string) => (page: Page) =>
  pipe(
    TE.tryCatch(() => page.waitForSelector(selector, { timeout: 0 }), toError),
    TE.map(() => page)
  );

export const loadPage = (url: string) => (browser: Browser) =>
  pipe(
    openNewPage(browser),
    TE.chain((page) =>
      pipe(
        setViewPort(page),
        TE.chain(() => goToUrl(page, url)),
        TE.map(() => page)
      )
    )
  );

export const autoScroll = (maxScrolls: number) => (page: Page) =>
  pipe(
    TE.tryCatch(
      () =>
        // eslint-disable-next-line @typescript-eslint/no-shadow
        page.evaluate((maxScrolls) => {
          let totalHeight = 0;
          const distance = 100;
          let scrolls = 0; // scrolls counter
          var timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            scrolls++; // increment counter

            // stop scrolling if reached the end or the maximum number of scrolls
            if (
              totalHeight >= scrollHeight - window.innerHeight ||
              scrolls >= maxScrolls
            ) {
              clearInterval(timer);
            }
          }, 100);
        }, maxScrolls),
      toError
    ),
    TE.map(() => page)
  );

export const evaluatePage =
  <T>(
    fn: (...args: ReadonlyArray<unknown>) => T,
    ...args: ReadonlyArray<unknown>
  ) =>
  (page: Page) =>
    pipe(
      TE.tryCatch(() => page.evaluate(fn, ...args), toError),
      TE.map(() => page)
    );

export const evaluatePageElements =
  <T>(
    fn: (...args: ReadonlyArray<unknown>) => T,
    ...args: ReadonlyArray<unknown>
  ) =>
  (page: Page) =>
    TE.tryCatch(() => page.evaluate(fn, ...args), toError);

export const evaluateLeftClick = (selector: string) => (page: Page) =>
  pipe(
    TE.tryCatch(() => page.click(selector), toError),
    TE.map(() => page)
  );

export const changeInputValueByKeyboard =
  (selector: string, value: string) => (page: Page) =>
    pipe(
      TE.tryCatch(() => page.focus(selector), toError),
      TE.chain(() => TE.tryCatch(() => page.keyboard.type(value), toError)),
      TE.chain(() => TE.tryCatch(() => page.keyboard.press("Enter"), toError)),
      TE.map(() => page)
    );

export const evaluateElement = <T>(
  element: ElementHandle<Element>,
  fn: (el: Element, ...args: ReadonlyArray<unknown>) => T,
  ...args: ReadonlyArray<unknown>
) => TE.tryCatch(() => element.evaluate(fn, ...args), toError);

export const removeModal = (page: Page, selectorToRemove: string) =>
  evaluatePage((sel: string) => {
    const elements = document.querySelectorAll(sel);
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < elements.length; i++) {
      elements[i].parentNode.removeChild(elements[i]);
    }
  }, selectorToRemove)(page);

export const selectElementsWithText = (
  page: Page,
  tag: string,
  textToSearch: string,
  xPathAppend?: string
) =>
  TE.tryCatch(
    () =>
      page.$x(
        `//${tag}[contains(text(),'${textToSearch}')]${
          xPathAppend ? xPathAppend : ""
        }`
      ),
    toError
  );
