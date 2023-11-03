import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as express from "express";
import * as bodyParser from "body-parser";
import { pipe } from "fp-ts/lib/function";
import amazonSearch from "./AmazonScrape";
import { launchBrowser } from "./utils/puppeteer";

const app = express();
const port = 3000;

 // Parse the incoming request body. This is needed by Passport spid strategy.
 app.use(
  bodyParser.json({
    verify: (_req, res: express.Response, buf, _encoding: BufferEncoding) => {
      // eslint-disable-next-line functional/immutable-data
      res.locals.body = buf;
    },
  })
);

// Parse an urlencoded body.
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/amazon', (req: express.Request, res) => 
    pipe(
      req.body.search,
      NonEmptyString.decode,
      E.mapLeft(errs => res.status(400).send({error: errs})),
      TE.fromEither,
      TE.bindTo("toSearch"),
      TE.chainW(({toSearch}) => amazonSearch(toSearch)),
      TE.map(items => res.status(200).json({items, size: items.length})),
      TE.mapLeft(err => res.status(500).json({error: String(err)}))
  )()
)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
