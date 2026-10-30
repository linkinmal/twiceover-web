# Position size and risk of ruin — the definition

The page's math in words, with no code. The module (`position-size.mjs`) and the page's words (`position-size-view.mjs`) follow this file; the separate checker works from this file alone (blog-playables-routine.md §2 step 6). The PM reads it before the page merges (blog-math-cases.md: the model and the horizon are the PM's to confirm).

## What it teaches

How the share of the account risked on each trade, on its own, decides whether an edge survives. The same odds can end ahead in most runs at one size and fall to half the start in most runs at another.

## The model

- **One run** is 100 trades in a row, starting from an account of 1. The page prints the start as $10,000 and the floor as $5,000; the math does not depend on the dollar amount.
- **Every trade risks the same share `f` of the account as it stands before that trade** (fixed-fraction sizing; the amount risked changes as the account changes).
- A trade **wins** with chance `p`, independently of every other trade. A win adds `f × b × account`, where `b` is the payoff: what a win pays as a multiple of the amount risked. A loss takes `f × account`.
- So after `w` wins and `l` losses, in any order, the account is `(1 + f·b)^w × (1 − f)^l`.
- **The floor** is half the start. A run whose account is **at or below 1/2** after any trade **stops there**: it has *fallen to the floor* and takes no further trades. At `f` = 100% a single loss takes the account to 0, which is at the floor.
- **Horizon: finite, 100 trades.** This is not the infinite-horizon risk of ruin. Nothing is said about trade 101 onward.

Every run ends in exactly one of three outcomes:

1. **Fell to the floor:** the account was at or below 1/2 after some trade among the 100.
2. **Ahead:** it never fell to the floor, and after trade 100 the account is **strictly above 1**.
3. **Neither:** it never fell to the floor, and after trade 100 the account is at or below 1 (but above 1/2).

The page shows the exact probability of outcomes 1 and 2 (not a simulation; no seed, no randomness in the figures). The three add up to 1.

## The inputs

| Input | How it is entered | Range accepted | Read as |
|---|---|---|---|
| Win chance `p` | typed, with a % mark | 1% to 99% inclusive | rounded to the nearest 0.1% (half up) before anything else; the range is checked on the rounded value |
| Payoff `b` | typed, with a % mark: what a win pays, as a percent of the amount risked (100% = even money) | 1% to 1000% inclusive | rounded to the nearest 0.1% (half up), range checked on the rounded value |
| Size `f` | slider | 1% to 100%, whole percents | as is |

A typed number is digits with at most one decimal mark, a dot or a comma; spaces at either end are ignored. A comma followed by exactly three digits is a thousands separator and is refused (so `1,000` is refused and `1000` is accepted). A sign, an exponent, a space inside, a typed % sign (the mark sits beside the box), or other text is refused. (This is the shared reader the other tool pages use.) Rounding to 0.1 is decimal rounding of the number as typed: 55.55 is 55.6, 55.549 is 55.5.

**Opening state:** win chance 60%, payoff 100%, size 10%.

**The six examples** (samples, not anyone's record; "Try another example" deals one of the five examples other than the one it last dealt, or the opening one, even after the reader has typed their own odds, and leaves the size where it is):

| # | Win chance | Payoff |
|---|---|---|
| 0 (opening) | 60% | 100% |
| 1 | 55% | 100% |
| 2 | 40% | 200% |
| 3 | 30% | 300% |
| 4 | 50% | 150% |
| 5 | 65% | 60% |

## The figures, and how each is rounded

Write `p%` and `b%` for the two typed inputs after rounding to 0.1, and `p = p%/100`, `b = b%/100`.

1. **Edge per trade**, as a percent of the amount risked: `p·b − (1 − p)`, times 100. Shown to one decimal, rounded half away from zero, with a sign: `+20.0%`, `−5.0%` (the minus is U+2212), and `0.0%` with no sign when it rounds to zero. It is computed exactly: with `p%` and `b%` in tenths (`P = 10·p%`, `B = 10·b%`, integers), the edge in percent is `(P·B − 1000·(1000 − P)) / 10000`.
2. **The fastest-growing size** (the Kelly fraction): `p − (1 − p)/b`, which equals the edge divided by the payoff. Shown as a whole percent, rounded half up. When the edge is zero or negative it is shown as `none`. When it is above 0 but rounds to 0, it is shown as `under 1%`. In integers: `(P·B − 1000·(1000 − P)) / (10·B)` percent.
3. **Ahead after 100 trades** and **fell to half the start**: the two probabilities above, each as a percent of runs:
   - exactly 0 → `0%`
   - above 0 and below 0.5% → `under 1%`
   - from 99.5% up to but not including 100% → `over 99%`
   - exactly 100% → `100%`
   - otherwise the whole percent, rounded half up.
   "Exactly 0" means the outcome cannot happen, and "exactly 100%" that it always happens. On the accepted inputs neither case ever arises: the all-wins run is always ahead, and the all-losses run always reaches the floor (even at `f` = 1%, 69 losses in a row take the account to 0.99^69 ≈ 0.4998). So the page shows "under 1%" and "over 99%" at the ends. The two rules are kept for completeness.

## The bars

One row per size, for the sizes 1%, 2%, 5%, 10%, 20%, 30%, 50% and 100%, in that order. When the slider's size is not one of these, a row for it is added in its place in the order. The row at the slider's size is marked. Each row shows the two shares from figure 3 at the current odds, as `A ahead · B to $5,000` (the dot is U+00B7), with A and B printed by the rules of figure 3.

## The page's sentences

Money is printed with thousands separators: whole dollars bare (`$11,000`), otherwise two decimals (`$10,112.50`). A number held in tenths prints without a trailing `.0` (`60`, `55.5`).

- **The sentence over the answer:** `Risking X% on each trade, A of runs end above $10,000 and B fall to $5,000 on the way.` X is the slider's size; A and B are figure 3. When the exact edge is zero or negative (not the edge as shown to one decimal), a second sentence follows: `With no positive edge, no size grows the account on average.`
- **The three tiles:** A `of runs end the 100 trades above $10,000`; B `of runs fall to $5,000 on the way, and stop`; figure 2 `the size that grows the account fastest`.
- **The first trade, under the slider:** `At X%, the first trade risks R of the $10,000. A win adds W, to $10,000 + W. A loss takes R, to $10,000 − R. Each later trade risks X% of what the account holds then.` R = $10,000 × X/100; W = R × b. In cents both are whole numbers.
- **The note under the win chance box:** `p% means about p trades in 100 win.`
- **The note under the payoff box:** `At b%, a trade that risks $1,000 wins $1,000 × b. ` followed by the edge in words: `Edge: E. On average a trade earns C cents for each $1 it risks.` (or `loses`, when the edge is negative; `1 cent` when C is 1; `Edge: 0.0%. On average a trade earns nothing.` when E prints as 0.0%). E is figure 1 and C is the same number without its sign or % mark, printed without a trailing `.0`.
- **The edge, at the top** (opening odds): `Here a trade wins V cents and loses L cents for each $1 it risks, on average. The difference, E, is the edge.` V = 100·p·b and L = 100·(1 − p), each to at most two decimals with trailing zeros dropped.
- **The lesson** quotes, at the opening odds (60%, 100%): what a win and then a loss of the same size leave of $10,000, at 10% ($9,900) and at 50% ($7,500), worked as $10,000 × (1 + X/100) × (1 − X/100); the fastest-growing size (figure 2); and the share that fell to $5,000 at 10%, at 40% and at the fastest-growing size, each printed by figure 3's rules.

## Refusals (bad input)

A refused box is marked, its note is replaced by its message, and the page keeps the last good result. Each box is checked on its own.

- Win chance blank, not a number, or outside 1% to 99% after rounding: `Type a chance from 1% to 99%. Showing the last good result.`
- Payoff blank, not a number, or outside 1% to 1000% after rounding: `Type a payoff from 1% to 1000%. Showing the last good result.` The limit is written without a separator because the reader refuses `1,000`; `1000` is accepted.

## Worked by hand (for the checker's sanity, not the oracle)

- 60% and 100%: edge `0.6·1 − 0.4 = 0.2` → `+20.0%`; fastest-growing size `0.6 − 0.4/1 = 0.2` → `20%`.
- 40% and 200%: edge `0.8 − 0.6 = 0.2` → `+20.0%`; size `0.4 − 0.6/2 = 0.1` → `10%`.
- 65% and 60%: edge `0.39 − 0.35 = 0.04` → `+4.0%`; size `0.65 − 0.35/0.6 = 0.0667` → `7%`.
- 50% and 100%: edge `0.0%`, size `none`.
- At `f` = 100% the run falls to the floor at its first loss, so "fell to half the start" is `1 − p^100` and "ahead" is `p^100`.
- At `f` = 50% and `b` = 200%: a win doubles the account and a loss halves it, so the account is `2^(w − l)`; it is at the floor when losses first exceed wins, and ahead when, never having been there, wins exceed losses after 100 trades.
