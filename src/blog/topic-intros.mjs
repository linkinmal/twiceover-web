/**
 * topic-intros — the paragraphs under a topic page's heading and one-line description. Growth's, from
 * `ai-team/growth/blog-site-copy.md` section 5b. Evergreen only: no figure here goes stale and none names a
 * post, so a topic page reads the same with one post or ten. Each topic is two paragraphs; the first says what
 * the subject is, the second says what the posts on the page do with it.
 */
export const TOPIC_INTROS = Object.freeze({
  "option-math": [
    "An option's price is not a bet on direction alone. It has parts. One part is the gap between the stock price and the strike price. Another is the time left until the option expires. A third is implied volatility, which is the size of move the options market expects.",
    "When implied volatility falls, an option can lose value even while the stock rises. Traders call a sharp fall after a big event IV crush. The posts on this page work through the arithmetic with real numbers. Each figure is written out in words, so you can follow it without a chart in front of you.",
  ],
  "expiration-assignment": [
    "Every option has a last day. After the closing bell on that day, a contract either has value or it does not. An option that finishes in the money by a cent or more is normally exercised automatically. A call is in the money when the stock is above the strike. A put is in the money when the stock is below it.",
    "Assignment is the other side of exercise. When a holder exercises, a seller is chosen and must deliver on the contract. The notice arrives after the market closes, so a seller can learn the result after trading has ended. The posts here follow what happens in those hours, and what it means for shares, cash and risk.",
  ],
  "earnings": [
    "A company reports earnings on a set date. Before the report, options prices carry an estimate of how far the stock will move afterward. That estimate is called the implied move. It is built from the prices traders pay for options that expire just after the report.",
    "The posts on this page set the implied move beside what the stock actually did. They show both numbers, the size of the gap and the days involved. They also say what the report contained, so the move can be read against the news.",
  ],
  "company-events": [
    "Some of the biggest stock moves come from the company itself changing. In a merger, one company agrees to acquire another. In a tender offer, the bidder asks shareholders to hand over shares directly at a stated price, within a stated window. In a spin-off, a company gives its shareholders shares in a new company.",
    "When a buyer agrees to pay cash, the target's stock usually trades a little under the offer. That gap is the market's price for the chance the deal does not close, plus the cost of waiting. The posts on this page read the deal documents, then compare what they say with what the stock price implies.",
  ],
  "reading-the-document": [
    "Public companies file documents with the SEC, and anyone can read them for free on EDGAR. An 8-K reports a major event soon after it happens. A 10-K is the annual report. A 10-Q is the quarterly one. A merger agreement is usually filed as an attachment to an 8-K.",
    "These documents hold facts that headlines leave out, such as who pays a fee if a deal fails, or what a company must disclose and when. The posts on this page read one document at a time. They quote the passage that matters, explain the terms in plain words and say where to find it.",
  ],
  "market-plumbing": [
    "A trade is not finished when you click the button. It settles later, when cash and shares actually change hands. Short selling means borrowing shares, selling them, and buying them back later. An index fund holds the stocks in an index, so it must trade when the index changes its members.",
    "These mechanics run in the background, and they explain moves that look odd from the outside. The posts on this page describe how each one works, step by step, and show an example with numbers. They are about how the market is built, not about where it goes next.",
  ],
  "macro-fed": [
    "Some numbers move every stock at once. The Federal Reserve's rate committee meets eight times a year and sets a target for short-term interest rates. Inflation reports, such as the Consumer Price Index, arrive on a published schedule. Each one shifts what the market expects for rates.",
    "The posts on this page start from what the market expected before a release, then show what came out and how prices moved after. They name the next release where there is one. Figures come from the agencies that publish them, and the posts name the source.",
  ],
  "policy-geopolitics": [
    "Tariffs, wars and speeches change what companies earn and what investors will pay for those earnings. The link between a headline and a stock price is rarely a straight line. Some effects arrive in days. Others take quarters to show up in a company's results.",
    "The posts on this page pick one event and follow it into the numbers. They show what was said or decided, what companies reported afterward and how their stock prices moved. Where the cause is unclear, the post says so instead of choosing a story.",
  ],
  "other-markets": [
    "Stocks do not move alone. Oil, gold, government bonds, the dollar and bitcoin each pull on stock prices in their own way. Higher bond yields can lower what investors will pay for future profits. A stronger dollar can reduce the dollar value of what a company sells abroad.",
    "The posts on this page take one of these markets and trace its link to stocks. They show the data for both over the same dates, so you can see where the link held and where it did not. Each one explains the mechanism before it shows the numbers.",
  ],
  "sectors-industry": [
    "A sector is a group of companies in the same line of business, such as banks, energy producers or chip makers. Each one has its own numbers that move its stocks. Oil producers watch the weekly inventory report. Banks report results every quarter. Chip makers follow a cycle of orders and supply.",
    "The posts on this page explain one of those industry numbers and how it reaches stock prices. They show the figure and what it was compared with. The aim is to make the number readable to someone who does not work in the industry.",
  ],
  "risk-sizing-behaviour": [
    "Position sizing is how much of an account goes into one trade. It matters because losses and gains are not symmetric. A fall of 50 percent needs a rise of 100 percent to get back to even. Formulas such as the Kelly rule turn a bet's odds into a size, and the answer is often smaller than people expect.",
    "The posts on this page work through the math with small, clear examples. They also cover what studies show about how traders actually behave, such as holding losers and selling winners early. These posts explain the arithmetic of risk. They do not tell you what size to use.",
  ],
  "levels-patterns": [
    "Traders draw lines on charts. Support is a price where a stock has stopped falling before. Resistance is a price where it has stopped rising. A gap is a jump between one day's close and the next day's open, and a gap fill is a return to the old price. Round numbers, such as 100, draw attention too.",
    "The posts on this page take one of these ideas and check it against price history. Each one states the rule being tested, the period, and how many cases it found. The result is reported as it came out, whether the idea held or not.",
  ],
  "positioning-flow": [
    "Who holds a stock, and who is betting against it, is public in pieces. Short interest is the number of shares sold short, and it is published twice a month. A 13F is a quarterly filing in which large investment managers list what they hold. Options flow is the record of options trades as they happen.",
    "Each of these is delayed or partial, and the posts on this page say so. They show what the figure is, when it was reported and what it can and cannot tell you. They read the filings and the data directly instead of repeating a summary.",
  ],
  "number-in-the-headline": [
    "A news story often rests on one number, such as a percentage, a record or a total. Numbers in headlines are easy to repeat and hard to check. The base, the period and the way it was counted can change what the number means.",
    "The posts on this page take one number from the news and recompute it from the original data. They show the source, the steps and the result. If the number holds, the post says so. If it depends on a choice the headline did not mention, the post names the choice.",
  ],
  "how-to-read": [
    "Charts and indicators compress a lot of data into one picture. A payoff diagram shows what an options position is worth at expiration for every stock price. The VIX is an index that turns option prices into an estimate of how much the stock market is expected to move over the next 30 days.",
    "The posts on this page show how to read one of these, one step at a time. Each starts with what is on each axis and what a point on the picture means. Then it works an example with numbers, so the picture and the arithmetic match.",
  ],
});
