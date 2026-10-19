---
title: "Kelly rule: a 40% bet on a coin that wins 60% of flips loses money"
description: "A bet on a coin that lands heads 60% of the time can still lose money. At a 40% bet on every flip, 60 wins in 100 turn $25 into $19.57. The Kelly rule puts the fastest-growing bet at 20%, which ends at $187.25."
publishAt: "2026-10-30T07:00:00-04:00"
topic: "risk-sizing-behaviour"
lens: "concept"
build: "text-led"
look: "printout"
hit: "loses money"
sources: "Haghani and Dewey, 2017 | https://arxiv.org/abs/1701.01427; Kelly, 1956"
---

## In plain words

A bettor on a coin that lands heads 60% of the time still loses money when each bet takes too much of the stack, the money on the table. The edge is real, and bet size decides what it pays.

At 20% of the stack a flip, 100 flips with 60 heads take $25 to $187.25. At 40% a flip, the same 100 flips leave $19.57. The coin did what it promised both times.

The Kelly rule gives the size that grows the stack fastest. John Kelly of Bell Labs published it in 1956. For an even-money bet the bet equals the edge. Here that is 60% minus 40%, so 20% of the stack.

## 1. The facts

- **The coin:** heads 60% of the time. A win pays the amount bet.
- **The stack:** $25.
- **The run:** 100 flips, 60 heads and 40 tails.
- **The only choice:** what share of the stack goes on each flip.

## 2. The same 100 flips at seven bet sizes

Each row is the same run of 60 heads and 40 tails. The share stays fixed for all 100 flips, so the dollar bet grows and shrinks with the stack.

| Share of the stack bet each flip | Stack after 100 flips |
|---|---|
| 5% | $60.01 |
| 10% | $112.51 |
| 20% | $187.25 |
| 30% | $109.26 |
| 40% | $19.57 |
| 50% | $0.84 |
| 100% | $0, at the first tail |

The order of the flips changes nothing in this table. Every flip multiplies the stack: by one plus the share on a head, and by one minus the share on a tail. Multiplication gives the same answer in any order, so only the count of heads matters.

## 3. Why a 40% bet shrinks the stack

The loss shows in any win followed by a loss. Take a 40% bet. A head turns $1.00 into $1.40, and a tail then takes 40% of that, leaving $0.84. One win and one loss cost 16% of the stack.

At 20% the same pair leaves $0.96, a cost of 4%.

The coin lands three heads for every two tails. At 20% a set of five flips like that multiplies the stack by 1.106, a gain of about 10.6%. At 40% the same five flips multiply it by 0.988, a loss of about 1.2%. Twenty such sets make the 100 flips in the table.

## 4. Why the average points the wrong way

Each flip’s average gain rises with the bet. At 20% the average flip adds 4% of the stack. At 40% it adds 8%. Over 100 flips the average outcome at 40% is about $55,000.

That average comes from a few runs with far more than 60 heads. The middle run, the median, has exactly 60 heads and ends at $19.57. At a 40% bet, 54% of all 100-flip runs finish below the $25 start. At a 20% bet the figure is 18%.

The Kelly rule gives the fastest growth to the middle run, which is the typical one. At twice the Kelly size that growth falls to just below zero on this coin, and the stack slowly shrinks.

## 5. What 61 economics students and finance workers did with the coin

Victor Haghani and Richard Dewey put real money on this coin. Their paper, posted in January 2017, describes the game.

- 61 players, mostly college students in economics and finance and young professionals at finance firms.
- Each got $25 and 30 minutes of flips, with payouts capped at $250.
- The game’s rules said, in bold, that the coin came up heads 60% of the time.
- The paper puts the Kelly bet at 20% of the stack.

> “Only 21% of participants reached the maximum payout of $250”

Their game ran longer than 100 flips and stopped at the cap. Over that game, the paper says, a steady bet of anywhere from 10% to 20% would have taken 95% of players to the cap. Instead 28% went bust and got nothing. The average payout was $91. Eighteen players bet everything on a single flip. Forty-one bet on tails at some point, on a coin they knew favored heads. Only 5 of the 61 had heard of the Kelly criterion, the paper’s name for the rule.

The players’ average bet was 15% of the stack, inside that range. The paper calls their betting erratic, too small and then too big, and an average of 15% can hide one all-in flip.

## 6. What the coin says about trading

A trader’s edge is an estimate, and an estimate can run high.

A trader who reads the edge as 30% when it is really 20% bets 30% a flip. On the table’s run, the $25 then ends at $109.26 instead of $187.25. An edge misread as 40% doubles the Kelly bet. The $25 then ends at $19.57, below the start.

## 7. Play the coin

Our game [The 60% coin](/blog/play/coin) runs the same coin with a $25 start, a $250 cap and up to 300 flips. It also shows 2,000 games at each bet size.

Two earlier posts put numbers on risk in real markets: [how often earnings moves stayed inside the implied move](/blog/earnings-implied-move-average), and [what can happen to an option after expiration day’s close](/blog/expiring-option-after-the-close).
