---
layout: post
title: From Firestore to BigQuery with Firebase Functions
categories: programming, google cloud, firebase, functions
---

In building my [sentiment analysis service](https://github.com/elithrar/centiment), I needed a way to get data into BigQuery + Data Studio so I could analyze trends against pricing data. My service (on App Engine) uses Firestore as its primary data store as an append-only log of all analysis runs to date.

The flexible schema (especially during development), solid Go client library & performance story were major draws, but one of the clear attractions was being able to trigger an external Firebase Function (Cloud Function) on Firestore events. Specifically, I wanted to get the results of each analysis run into BigQuery so I could run queries & set up Data Studio visualizations as-needed.

I wrote a quick function that:

* Triggers on each `onCreate` [event](https://firebase.google.com/docs/functions/firestore-events#trigger_a_function_when_a_new_document_is_created) to Firestore
* Pulls out the relevant fields I wanted to analyze in BigQuery: counts, aggregates and the search query used
* Inserts them into the configured BigQuery dataset & table.

With that data in BigQuery, I'm able pull it into Data Studio, generate charts & analyze trends over time.

### Creating the Function

If you haven't created a Firebase Function before, there's a great [Getting Started](https://firebase.google.com/docs/functions/get-started) guide that steps you through installing the SDK, logging in, and creating the scaffolding for your Function.

> Note: Firebase Functions initially need to be created & deployed via the [Firebase CLI](https://firebase.google.com/docs/functions/get-started), although it sounds like Google will support the Firebase-specific event types within Cloud Functions & the gcloud SDK (CLI) in the not-too-distant future.

Within `index.js`, we'll require the necessary libraries, and export our `sentimentsToBQ` function. This function has a Firestore trigger: specifically, it triggers when any document that matches `/sentiment/{sentimentID}` is created (`onCreate`). The `{sentimentID}` part is effectively a wildcard: it means "any document under this path".

```js
const functions = require("firebase-functions")
const BigQuery = require("@google-cloud/bigquery")

exports.sentimentsToBQ = functions.firestore
  .document("/sentiments/{sentimentID}")
  .onCreate(event => {
    console.log(`new create event for document ID: ${event.data.id}`)

    // Set via: firebase functions:config:set centiment.{dataset,table}
    let config = functions.config()
    let datasetName = config.centiment.dataset || "centiment"
    let tableName = config.centiment.table || "sentiments"
    let bigquery = new BigQuery()
```

We can use the Firebase CLI to override the config variables that define our dataset & table names as needed via `firebase functions:config:set centiment.dataset "centiment"`- useful if we want to change the destination table during a migration/copy.

```js
let dataset = bigquery.dataset(datasetName)
dataset.exists().catch(err => {
  console.error(
    `dataset.exists: dataset ${datasetName} does not exist: ${JSON.stringify(
      err
    )}`
  )
  return err
})

let table = dataset.table(tableName)
table.exists().catch(err => {
  console.error(
    `table.exists: table ${tableName} does not exist: ${JSON.stringify(err)}`
  )
  return err
})
```

We check that the destination dataset & table exist - if they don't, we return an error. In some cases you may want to [create them](https://cloud.google.com/nodejs/docs/reference/bigquery/0.12.x/BigQuery#createDataset) on-the-fly, but here we expect that they exist with a specific schema.

```js
let document = event.data.data()
document.id = event.data.id

let row = {
  insertId: event.data.id,
  json: {
    id: event.data.id,
    count: document.count,
    fetchedAt: document.fetchedAt,
    lastSeenID: document.lastSeenID,
    score: document.score,
    variance: document.variance,
    stdDev: document.stdDev,
    searchTerm: document.searchTerm,
    query: document.query,
    topic: document.topic,
  },
}
```

The `event.data.data()` method returns the current state of the Firestore document, which is what we want to insert. The previous state of the document can also be accessed via `event.data.previous.data()`, which could be useful if we were logging specific deltas (say, a field changes by >= 10%) or otherwise tracking per-field changes within a document.

Note that we define an `insertId` to [prevent duplicate rows](https://cloud.google.com/bigquery/streaming-data-into-bigquery#dataconsistency) in the event the function fails to stream the data and [has to retry](https://firebase.google.com/docs/functions/retries). The `insertId` is simply the auto-generated ID that Firestore provides, which is exactly what we want to de-duplicate a record on should it potentially be inserted twice, as our application treats Firestore as an append-only log. If we were expecting multiple writes to a record every minute, and wanted to stream those to BigQuery as distinct documents, we would need to use a different approach.

Beyond that, we compose an object with explicit `columnName` <=> `fieldName` mappings, based on our BigQuery schema. We don't need every possible field from Firestore - only the ones we want to run analyses on. Further, since Firestore has a flexible schema, new fields added to our Firestore documents may not exist in our BigQuery schema.

The last part of our function is responsible for actually inserting the row into BigQuery: we call `table.insert` and set `raw: true` in the options, since we're passing a row directly:

```js
return table.insert(row, { raw: true }).catch(err => {
  console.error(`table.insert: ${JSON.stringify(err)}`)
  return err
})
```

As `table.insert` is a Promise, we should return the Promise itself, which will either resolve (success) or reject (failure). Because we don't need to do any post-processing in the success case, we only explicitly handle the rejection, logging the error and returning it to signal completion. Not returning the Promise would cause the function to return early, and potentially prevent execution or error handling of our `table.insert`. Not good!

### Deploying

Deploying our function is straightforward:

```sh
# Deploys our function by name
$ firebase deploy --only functions:sentimentsToBQ

=== Deploying to 'project-name'...
i  deploying functions
i  functions: ensuring necessary APIs are enabled...
✔  functions: all necessary APIs are enabled
i  functions: preparing _functions directory for uploading...
i  functions: packaged _functions (41.74 KB) for uploading
✔  functions: _functions folder uploaded successfully
i  functions: current functions in project: sentimentsToBQ
i  functions: uploading functions in project: sentimentsToBQ
i  functions: updating function sentimentsToBQ...
✔  functions[sentimentsToBQ]: Successful update operation.
```

Deployment takes about 10 - 15 seconds, but I'd recommend using the [local emulator](https://firebase.google.com/docs/functions/local-emulator#invoke_firestore_functions) to ensure the functions behaves as expected.

### Querying in BigQuery

So how do we query our data? We use the [BigQuery console](https://bigquery.cloud.google.com) or the [`bq` CLI](https://cloud.google.com/bigquery/bq-command-line-tool). We'll use the command line tool here, but the query is still the same:

```sh
bq query --nouse_legacy_sql 'SELECT * FROM `centiment.sentiments` ORDER BY fetchedAt LIMIT 5;'
Waiting on bqjob_r1af4578a67b94241_000001618c40385c_1 ... (1s)
Current status: DONE

+----------------------+---------+---------------------+-------+
|          id          |  topic  |        score        | count |
+----------------------+---------+---------------------+-------+
| PSux4gwOsHyUGqqdsdEI | bitcoin | 0.10515464281605692 |    97 |
| ug8Zm5sSZ2dtJXPIQWKj | bitcoin |  0.0653061231180113 |    98 |
| 63Qo2gRgsG7Cz2zywKOO | bitcoin | 0.09264705932753926 |    68 |
| Y5sraBzPrhBzsmOyHcm3 | bitcoin | 0.06601942062956613 |   103 |
| r3XApKXJ6feglUcyG1db | bitcoin | 0.13238095435358221 |   105 |
+----------------------+---------+---------------------+-------+
# Note that I've reduced the number of columns returned so it fits in the blog post
```

We can now see the results that we originally wrote to Firestore, and run aggregations, analyses and/or export them to other formats as needed.

![sentiment-analysis-in-data-studio](/public/files/sentiment-data-studio-20180212.png)

### The Code

For the record, here's the full function as it is in production at the time of writing:

```js
const functions = require("firebase-functions")
const BigQuery = require("@google-cloud/bigquery")

exports.sentimentsToBQ = functions.firestore
  .document("/sentiments/{sentimentID}")
  .onCreate(event => {
    console.log(`new create event for document ID: ${event.data.id}`)

    // Set via: firebase functions:config:set centiment.{dataset,table}
    let config = functions.config()
    let datasetName = config.centiment.dataset || "centiment"
    let tableName = config.centiment.table || "sentiments"
    let bigquery = new BigQuery()

    let dataset = bigquery.dataset(datasetName)
    dataset.exists().catch(err => {
      console.error(
        `dataset.exists: dataset ${datasetName} does not exist: ${JSON.stringify(
          err
        )}`
      )
      return err
    })

    let table = dataset.table(tableName)
    table.exists().catch(err => {
      console.error(
        `table.exists: table ${tableName} does not exist: ${JSON.stringify(
          err
        )}`
      )
      return err
    })

    let document = event.data.data()
    document.id = event.data.id

    let row = {
      insertId: event.data.id,
      json: {
        id: event.data.id,
        count: document.count,
        fetchedAt: document.fetchedAt,
        lastSeenID: document.lastSeenID,
        score: document.score,
        variance: document.variance,
        stdDev: document.stdDev,
        searchTerm: document.searchTerm,
        query: document.query,
        topic: document.topic,
      },
    }

    return table.insert(row, { raw: true }).catch(err => {
      console.error(`table.insert: ${JSON.stringify(err)}`)
      return err
    })
  })
```
