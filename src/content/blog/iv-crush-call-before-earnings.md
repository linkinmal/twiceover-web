---
title: "IV crush: a call bought before earnings has already paid for the jump"
description: "Before a company reports, a call's price already includes the jump the news could bring. Once the news is out, that part of the price drains away, and traders call the drain IV crush. In our example the stock rises 4% overnight and the call loses 21%."
publishAt: "2026-11-06T07:00:00-05:00"
topic: "option-math"
lens: "concept"
build: "text-led"
look: "neon"
hit: "has already paid for the jump"
sources: "Black and Scholes, 1973; Overnight call calculator | https://twiceover.io/blog/tools/overnight-call; Own calculation"
---

A call bought the night before earnings has the expected jump built into its price. Once the news is out, that part of the price drains away. Traders call the drain IV crush, where IV stands for implied volatility. In the example below the stock rises 4% overnight, and the call loses 21% of its value.

## The example, in four lines

A call is a contract that lets its owner pay a set price, the strike, for 100 shares until a set date. The call's own price is quoted per share, so one contract costs 100 times that.

- A stock trades at $100 and reports after the close.
- A call on it with a $105 strike and seven days left costs $2.46 a share.
- By the next morning the stock is at $104.
- The call is worth $1.94, down 52 cents a share, or $52 on one contract.

## 1. Two thirds of the $2.46 pays for the jump

With the stock at $100, a $105 call would be worth nothing if it expired today. The call's whole price is a bet on how far the stock could travel in seven days. Traders measure that bet as implied volatility, quoted as a yearly percentage.

Before a report, implied volatility runs high, because a big move is on the calendar. Here implied volatility is 80%. At 45%, where it lands the morning after in this example, the same call would cost $0.79. So $0.79 is the call's ordinary price, and the rest, about two thirds of the $2.46, pays for the jump.

## 2. Where the 52 cents went

Once the results are out, the big unknown is gone and implied volatility falls from 80% to 45%. The calculator splits the night into three steps, in this order.

| Step | Call's value | Change |
|---|---|---|
| The night before | $2.46 | |
| The stock rises 4% | $4.13 | +$1.67 |
| Implied volatility falls to 45% | $2.13 | −$2.00 |
| One day passes | $1.94 | −$0.19 |
| **The night in all** | | **−$0.52** |

The crush took $2.00, more than the $1.67 the stock's rise added. The day that passed took another 19 cents. Had implied volatility stayed at 80%, the same 4% rise would have left the call at $3.79, a 54% gain.

## 3. This call needs the stock up 5.1%

After the crush, with six days left, this call is worth its $2.46 again only if the stock is up 5.1% by morning. At 80%, one day's typical move is about 4.2% either way: 80 divided by the square root of 365. The call needs more than that 4.2%. Each row below is the morning after, with implied volatility at 45% and one day gone.

| Stock by morning | Call by morning | Change |
|---|---|---|
| Flat | $0.66 | −73% |
| Up 2% | $1.18 | −52% |
| Up 4% | $1.94 | −21% |
| Up 6% | $2.96 | +20% |
| Up 8% | $4.24 | +72% |
| Up 10% | $5.74 | +133% |
| Up 12% | $7.41 | +201% |

## 4. Five of 25 reports beat the priced move upward

In 25 big US reports from July to October 2026, 15 stocks moved less than their options had priced. Of the 10 that broke out, five went down. After the crush, this call gains only from a rise, and 5 of the 25 rose by more than their options priced. The full table is in [what 25 earnings reports did against the move options priced](/blog/earnings-implied-move-average).

How much to put on a bet that pays on a minority of outcomes is worked out in [why a 40% bet on a winning coin still loses money](/blog/kelly-rule-bet-size).

## 5. Run your own night

The [overnight call calculator](/blog/tools/overnight-call) opens on this same call. Move the stock, set where implied volatility lands, and the calculator splits the change into the same three steps.
