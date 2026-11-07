---
title: "Early assignment: an in-the-money call you sold is worth exercising when the dividend tops its time value"
description: "On the last day before a stock goes ex-dividend, the owner of an in-the-money call gains by exercising when the dividend is bigger than the time value left in the call. The writer then misses the dividend, or owes it."
publishAt: "2026-11-16T07:00:00-05:00"
topic: "expiration-assignment"
lens: "concept"
build: "picture-led"
look: "house"
hit: "Early assignment"
image:
  src: "/blog-images/early-assignment-before-dividend.png"
  alt: "TwiceOver’s Position section on a covered call, with its dividend note"
  source: "TwiceOver’s Position section"
  licence: "Own chart"
sources: "Cboe on dividend risk | https://www.cboe.com/insights/posts/dont-get-stuck-paying-the-dividend-on-your-short-trade/; OIC on covered calls | https://www.optionseducation.org/strategies/all-strategies/covered-call-buy-write; OIC on T+1 | https://www.optionseducation.org/news/understanding-t-1-conversion; FINRA Notice 24-04 | https://www.finra.org/rules-guidance/notices/24-04; FINRA on assignment | https://www.finra.org/investors/insights/trading-options-understanding-assignment"
---

You sold a call, and it can be exercised before it expires. Exercise is most likely on the last day before the stock goes ex-dividend, when the call is in the money and the dividend is worth more than its time value.

## 1. The words first

You sold the call, so you are its writer. The buyer is its holder. When the holder exercises, you are assigned: you sell 100 shares at the strike.

A US stock option can be exercised on any day the market is open before it expires. So a writer can be assigned on any of those days. What can happen on the last day, after the 4:00 close, is in [our post on the expiring option](/blog/expiring-option-after-the-close).

A call is in the money when the stock is above the strike. Its price has two parts. Intrinsic value is what exercising pays right now: the stock price minus the strike, or zero when the stock is below it. Time value is everything above that. It is what the holder gives up by exercising today. How fast it can drain around earnings is worked in [our post on IV crush](/blog/iv-crush-call-before-earnings).

The ex-dividend date is the first day a buyer of the stock no longer gets the next dividend. On that morning the stock usually opens lower by about the dividend.

## 2. The trade

A company pays a quarterly dividend of $0.50 a share. Its ex-dividend date is Thursday 19 November 2026. You hold 100 shares, bought at $48.00. Against them you sold one $45 call expiring Friday 20 November, for $4.10 a share. That is a covered call.

| Wednesday 18 November, at the close | Per share |
|---|---|
| Stock | $52.00 |
| The $45 call | $7.05 |
| Intrinsic value, $52.00 minus $45.00 | $7.00 |
| Time value, $7.05 minus $7.00 | $0.05 |
| Dividend, ex-dividend Thursday | $0.50 |

The picture above is this position the way TwiceOver’s Position section draws it. Its large green figure is the gain so far at Wednesday’s prices. Its last line is the note that flags this case, and it calls time value by its other name, extrinsic value.

## 3. The holder’s two paths

Wednesday is the holder’s last day to exercise and still get the dividend. Say the stock opens Thursday $0.50 lower, at $51.50, and nothing else changes.

| The holder’s choice on Wednesday | Value by Thursday, per share |
|---|---|
| Keep the call: $6.50 intrinsic plus $0.05 time value | $6.55 |
| Exercise: pay $45.00 for a share worth $51.50, and be owed the $0.50 dividend | $7.00 |
| Gain from exercising | $0.45 |

The gain is the dividend minus the time value: $0.50 minus $0.05. Per contract, that is a $45 gain. Change one number and the answer flips. Had the call held $0.60 of time value, keeping it would be worth $7.10, and exercising would lose the holder $0.10 a share.

So for a call that stays in the money after the drop, the test is two numbers: the dividend and the call’s time value. The holder gains by exercising when the dividend is the larger one. A call out of the money never passes. Paying $45 for a share worth less than $45 loses money, whatever the dividend. Strictly, what counts is the time value the call keeps after Thursday’s drop. The holder also pays the strike four days sooner than an exercise at expiration, which settles on Monday 23 November. Here the first stays near Wednesday’s $0.05, and the second costs about 2 cents a share at a 4% interest rate.

## 4. What early assignment costs you

You expected to keep your shares through Thursday, collect the dividend, and have them called away at $45 on Friday. Early assignment delivers them on Thursday.

| Your covered call | Assigned at expiration | Assigned early |
|---|---|---|
| Shares sold at the strike | $4,500 | $4,500 |
| Paid for the shares | −$4,800 | −$4,800 |
| Premium collected | $410 | $410 |
| Dividend | $50 | $0 |
| Result | $160 | $110 |

The early assignment costs you the $50 dividend. Everything else is the same, as long as the stock is still above $45 on Friday.

A writer assigned on a call sold without owning the shares owes the dividend. Assigned on Wednesday’s exercise, that writer is short 100 shares on Thursday, the record date. A short seller pays the dividend to whoever lent the shares: $50 here.

## 5. The calendar that makes it Wednesday

Since 28 May 2024, US stock trades settle one business day after the trade. That rule is known as T+1. Shares delivered on an exercise settle the same way, the next business day. Under T+1 the ex-dividend date is the same day as the record date, the day the company checks who owns the shares.

| Day | What happens |
|---|---|
| Wednesday 18 Nov | The holder sends the exercise, on the last day that settles in time. |
| Thursday 19 Nov, before the open | You get the assignment notice. |
| Thursday 19 Nov | The exercise settles. The holder is the owner on the record date, which is also the ex-dividend date. |
| Friday 20 Nov | The call would have expired. |

The clearing house hands each exercise to a broker at random. The broker picks one of its customers who sold that call, at random or by its own fair method. Not every holder exercises. You find out on Thursday morning whether you were picked.

## 6. What decides it

For any call you sold, four facts decide whether this case is live. The ex-dividend date falls before expiration. The call is in the money by more than the dividend, so it stays in the money after the drop. Then two numbers: the dividend per share and the call’s time value at its current price. When the dividend is the larger one, early assignment becomes more likely.
