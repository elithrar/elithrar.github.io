---
layout: post
title: Diving Into FiveThirtyEight's "Russian Troll Tweets" Dataset with BigQuery
categories: data, bigquery, tutorial
---

FiveThityEight [recently released a dataset](https://fivethirtyeight.com/features/why-were-sharing-3-million-russian-troll-tweets/) of what is believed to be ~3 million tweets associated with "Russian trolls". These tweets are designed to spread misinformation (let's not mince words: lies), and ultimately influence voters. If you haven't read the linked article, I highly suggest you do that before continuing on.

Exploring a ~700MB+ CSV file isn't hugely practical (it's since been sharded into < 100MB chunks), and so I've made the tweets available as a public dataset via Google's [BigQuery](https://cloud.google.com/bigquery/) analytics engine. BigQuery has a sizeable [free tier of 1TB](https://cloud.google.com/bigquery/pricing#free-tier) per month, which should allow a fair bit of exploration, even if you're a student or if paid services present a challenge for you.

> Note: This isn't a BigQuery & SQL tutorial: for that, take a look at the [documentation](https://cloud.google.com/bigquery/docs/quickstarts/quickstart-web-ui).

If you're already familiar with BigQuery & accessing public datasets, then you can simply run the below to start exploring the data:

```sql
#standardSQL
SELECT author, COUNT(*) as tweets, followers
FROM `optimum-rock-145719.fivethirtyeight_russian_troll_tweets.russian_troll_tweets`
GROUP BY author, followers
ORDER BY tweets DESC, followers DESC
```

For everyone else: read on.

## Accessing the Dataset

We're going to use the BigQuery web UI, so navigate to https://console.cloud.google.com/bigquery and select the project you want to access it from. You can't (yet) see the schema from the new (beta) BigQuery UI, so I'm posting it here to save you switching back:

| name               | type      | mode     |
| ------------------ | --------- | -------- |
| external_author_id | FLOAT     | NULLABLE |
| author             | STRING    | NULLABLE |
| content            | STRING    | NULLABLE |
| region             | STRING    | NULLABLE |
| language           | STRING    | NULLABLE |
| publish_date       | TIMESTAMP | NULLABLE |
| harvested_date     | TIMESTAMP | NULLABLE |
| following          | INTEGER   | NULLABLE |
| followers          | INTEGER   | NULLABLE |
| updates            | INTEGER   | NULLABLE |
| post_type          | STRING    | NULLABLE |
| account_type       | STRING    | NULLABLE |
| new_june_2018      | INTEGER   | NULLABLE |
| retweet            | INTEGER   | NULLABLE |
| account_category   | STRING    | NULLABLE |

Specifically, we can look at how these tweets were amplified (updates), what language the tweet was posted in (what audience was it for?), and the direct audience of the account (followers). We don't get details on the followers themselves however, which makes it hard to know how impactful the reach was: is it trolls/bots followed by other trolls, or members of the general Twitter populace?

## Analyzing It

OK, let's take a quick look at the data to get you thinking about it. We'll answer:

- Was there a specific account with a non-negligible fraction of tweets?
- Which months saw the most activity?
- Which tweets were the most amplified in each language?

```sql
-- Was there a specific account with a non-negligible fraction of tweets?
WITH
  total AS (
  SELECT
    COUNT(*) AS count
  FROM
    `optimum-rock-145719.fivethirtyeight_russian_troll_tweets.russian_troll_tweets` )
SELECT
  author,
  COUNT(*) AS count,
  FORMAT("%.2f", COUNT(*) / (
    SELECT
      count
    FROM
      total) * 100) AS percent
FROM
  `optimum-rock-145719.fivethirtyeight_russian_troll_tweets.russian_troll_tweets`
GROUP BY
  author
ORDER BY
  percent DESC
LIMIT
  10
```

The `EXQUOTE` account was definitely a sizeable contributor, although there's not an order-of-magnitude difference across the top 10.

| author          | count | percent |
| --------------- | ----: | ------: |
| EXQUOTE         | 59652 |    2.01 |
| SCREAMYMONKEY   | 44041 |    1.48 |
| WORLDNEWSPOLI   | 36974 |    1.24 |
| AMELIEBALDWIN   | 35371 |    1.19 |
| TODAYPITTSBURGH | 33602 |    1.13 |
| SPECIALAFFAIR   | 32588 |    1.10 |
| SEATTLE_POST    | 30800 |    1.04 |
| FINDDIET        | 29038 |    0.98 |
| KANSASDAILYNEWS | 28890 |    0.97 |
| ROOMOFRUMOR     | 28360 |    0.95 |

```sql
-- Which months saw the most activity?
SELECT
  FORMAT("%d-%d", EXTRACT(month
    FROM
      publish_date), EXTRACT(year
    FROM
      publish_date) ) AS date,
  COUNT(*) AS count
FROM
  `optimum-rock-145719.fivethirtyeight_russian_troll_tweets.russian_troll_tweets`
GROUP BY
  date
ORDER BY
  count DESC
LIMIT
    10
```

Unsuprisingly here, we see October 2016 (just prior to the election on Nov 8th) feature prominently, as well [August 2017](https://en.wikipedia.org/wiki/Timeline_of_the_Trump_presidency,_2017_Q3#August_2017), in which the North Korean conversation escalated immensely.

| date    |  count |
| ------- | -----: |
| 8-2017  | 191528 |
| 12-2016 | 155560 |
| 10-2016 | 152115 |
| 7-2015  | 145504 |
| 4-2017  | 136013 |
| 1-2017  | 135811 |
| 11-2015 | 132306 |
| 3-2017  | 128483 |
| 11-2016 | 123374 |
| 8-2015  | 119454 |

```sql
-- Which tweets were the most amplified (likes, retweets) by language?
SELECT
  language,
  content,
  updates
FROM (
  SELECT
    language,
    content,
    updates,
    RANK() OVER (PARTITION BY language ORDER BY updates DESC) AS tweet_rank
  FROM
    `optimum-rock-145719.fivethirtyeight_russian_troll_tweets.russian_troll_tweets`
  GROUP BY
    language,
    updates,
    content ) troll_tweets
WHERE
  tweet_rank = 1
GROUP BY
  language,
  content,
  updates
ORDER BY
  updates DESC
LIMIT
  10
```

I'll leave analyzing these tweets as an exercise to the reader, but they certainly appear to prey on the hot button issues in a few places. Also note that I've truncated the output here, for brevity. Also be mindful of any links you follow here: I have not vetted them.

| language        | truncated_content                                  | updates |
| --------------- | -------------------------------------------------- | ------: |
| English         | '@JustinTrudeau Mr. Trudeau, Canadian citizens dem |  166113 |
| Turkish         | KARMA, KARMA, KARMA!!! https://t.co/Eh5XUyILeJ     |  165833 |
| Catalan         | '@HCDotNet Excellent! ðŸ‡ºðŸ‡¸ðŸ‘ ðŸ »ðŸ˜†'        |  165751 |
| Farsi (Persian) | Shameful https://t.co/rll2JrUzRI                   |  165468 |
| Dutch           | Trumpâ€™s tweets. #ThingsITrustMoreThanCNN https:/ |  165407 |
| Norwegian       | #2018PredictionsIn5Words Pro-Trump landslide       |  165371 |
| Vietnamese      | So sad. @TitosVodka rocks!! https://t.co/sWtLlZxL5 |  164288 |
| Lithuanian      | Stump for Trump @Stump4TrumpPac https://t.co/S0NS9 |  164082 |
| Estonian        | #QAnon @Q #FOLLOWTHEWHITERABBIT ðŸ ‡ #FLYSIDFLY#   |  163448 |
| Croatian        | '@FoxNews @rayann2320 @POTUS Bravo Mr President!!' |  163126 |

## Wrap

There's a lot of data to explore here, but it's also worth keeping in mind that three (3) million tweets is only a small fraction of tweets associated with this kind of content, and this kind of bounded data collection may have some subjectivity to it.

If you have any questions about the dataset itself, you should [open an issue](https://github.com/fivethirtyeight/russian-troll-tweets) on FiveThirtyEight's GitHub repository. As for questions about exploring it via BigQuery: feel free to tweet [@elithrar](https://twitter.com/elithrar) with your questions or explorations!
