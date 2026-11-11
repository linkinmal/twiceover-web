---
title: "XIV lost 96% in one day in 2018, and since 2010 its terms had said its long-term expected value was zero"
description: "From its launch in 2010, XIV’s terms carried one plain line: the note’s long-term expected value was zero. On 5 February 2018 its value fell from $108.37 to $4.22 in a few hours. The next day the bank said it would wind the note up."
publishAt: "2026-11-20T07:00:00-05:00"
topic: "reading-the-document"
lens: "history"
build: "chart-led"
look: "paper-marker"
hit: "long-term expected value was zero"
image:
  src: "/blog-images/xiv-feb-2018.png"
  alt: "XIV’s value fell from $108.37 on Friday to $4.22 by Monday evening, 5 February 2018"
  source: "Credit Suisse; US Court of Appeals, Second Circuit, 2021"
  licence: "Own chart"
sources: "Credit Suisse terms for XIV, 29 Jan 2018 | https://www.sec.gov/Archives/edgar/data/1053092/000095010318000969/dp85741_424b2-vix48.htm; Credit Suisse terms for XIV, 30 Nov 2010 | https://www.sec.gov/Archives/edgar/data/1053092/000095010310003543/dp20129_424b2-vlsetn1.htm; Credit Suisse notice, 6 Feb 2018 | https://www.sec.gov/Archives/edgar/data/1053092/000095010318001572/dp86358_ex9901.htm; Second Circuit, Set Capital v. Credit Suisse | https://www.courtlistener.com/opinion/4877428/set-capital-llc-v-credit-suisse-group-ag/; Cboe VIX, via FRED | https://fred.stlouisfed.org/series/VIXCLS"
---

XIV was a popular bet against market fear, and its own terms said, from the day it launched in 2010, that its long-term expected value was zero. On 5 February 2018 it lost 96% of its value in a few hours. Traders still call that day Volmageddon.

XIV traded on Nasdaq like a stock. Its ticker is VIX spelled backwards. Each day its value moved opposite to futures on a gauge of expected stock swings, so it gained on calm days. Calm days were most days from 2010 into early 2018.

## 1. The same line in 2010 and in 2018

Credit Suisse, the bank behind XIV, set out its terms in a pricing supplement. That is the legal document that says what a note pays and what can go wrong. The first one, filed on 30 November 2010, carries this line. So does the one filed on 29 January 2018, a week before the fall.

> "The long term expected value of your ETNs is zero."

An ETN, or exchange-traded note, is an IOU from a bank. The bank owes the formula's value only when it redeems the note or winds it up, and a holder who sells on Nasdaq gets the market price.

The next sentence in both filings spells it out.

> "If you hold your ETNs as a long term investment, it is likely that you will lose all or a substantial portion of your investment."

## 2. The trap door

The note's running value was meant to be published every 15 seconds through the day. That value came from the formula, and it could differ from the price on Nasdaq. Every XIV value from here on is that running value.

The 2018 terms carry a trap door. If the running value fell to 20% or less of the previous day's closing value, the bank could wind the note up. Holders would then be paid the closing value on a set day, and the note would be gone.

## 3. What XIV followed

XIV followed an index of VIX futures. The VIX is a measure of how much movement the options market expects in the S&P 500 over the next 30 days. VIX futures are contracts that settle on where the VIX will be in a month or two.

In calm markets, those futures usually trade above the VIX and drift down toward it as they near expiry. The index of them drifts down too. XIV's value moved by minus one times the index's daily move, so it collected that drift.

The same formula has a flaw. When the note's daily change is minus one times the index's daily change, a 100% rise in the index wipes the note out. A single day on which the index doubles is enough.

## 4. The afternoon and evening of 5 February

The S&P 500 fell 4.1% that Monday. The VIX closed at 37.32, up from 17.31 on Friday, a rise of 116% in one session.

XIV's closing value on Friday was $108.37, according to Credit Suisse's own notice. The appeals court that later heard investors' lawsuit set out the rest of the day in its 2021 opinion.

| New York time, 2018 | XIV's running value per note | Against Friday's close |
|---|---|---|
| Friday 2 February, closing value | $108.37 | |
| Monday 5 February, end of regular trading | $72.59 | −33% |
| 4:09 p.m. | about $20 | about −82% |
| 4:15 p.m. | just over $4 | about −96% |
| 5:09 p.m., value published by Nasdaq | $4.22 | −96.1% |

The stock market closed at 4:00 p.m., and VIX futures kept trading. XIV's value kept following them down. The trap door sat at $21.67, a fifth of Friday's $108.37, and by 4:09 p.m. the note was below it. From 4:09 p.m. the published value stopped updating properly. At 5:09 p.m. Nasdaq published the correct figure, $4.22. Nearly 15 million notes were outstanding, according to the court.

The index XIV followed rose by about 96% that day, which is what a 96% fall in a minus-one note means. Because the rise stopped short of 100%, XIV kept about 4% of its value. The VIX itself rose 116%, more than the futures index did.

## 5. The notice the next morning

Credit Suisse announced the wind-up on 6 February. Its notice says the running value on 5 February fell to "twenty percent" or less of Friday's closing value, so "an acceleration event has occurred". Holders would be paid XIV's closing value on a valuation date, expected to be 15 February. In a later notice, on 14 February, the bank said Nasdaq would suspend trading after the close on 15 February.

## 6. What it teaches today

XIV's terms said in ten words what its formula would do over time. The trap door and the minus-one formula said what one bad day could do. All three sat in the filing of 29 January 2018.

Another market went through its own floor in April 2020, when US oil futures settled below zero because the barrels had nowhere to go. [The oil post](/blog/oil-below-zero-april-2020) walks through that day in dollars. For how the options market prices fear before one company's earnings, and how fast that price drains after, see [the post on IV crush](/blog/iv-crush-call-before-earnings).
