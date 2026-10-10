/**
 * normalCdf — the standard normal cumulative distribution function, N(x).
 *
 * Hart's 1968 rational approximation in the double-precision form West published in "Better
 * approximations to cumulative normal functions" (Wilmott, 2005): accurate to about 1e-15 and in the
 * far tails to a relative 1e-14. The Black-Scholes pricer in `overnight-call.mjs` multiplies it by a
 * stock price of up to 100,000, so a 1e-7 erf approximation would show as a wrong cent; this does not.
 *
 * `.mjs` and JSDoc, no dependency: this repo has no type-check step, and the same file is imported by
 * the build (to render a page's opening state) and by the block script in `public/js/`.
 */

/**
 * @param {number} x
 * @returns {number} the probability that a standard normal variable is at most `x`
 */
export function normalCdf(x) {
  if (Number.isNaN(x)) return NaN;
  const a = Math.abs(x);
  if (a > 37) return x > 0 ? 1 : 0;
  const e = Math.exp((-a * a) / 2);
  let tail;
  if (a < 7.07106781186547) {
    let num = 3.52624965998911e-2 * a + 0.700383064443688;
    num = num * a + 6.37396220353165;
    num = num * a + 33.912866078383;
    num = num * a + 112.079291497871;
    num = num * a + 221.213596169931;
    num = num * a + 220.206867912376;
    let den = 8.83883476483184e-2 * a + 1.75566716318264;
    den = den * a + 16.064177579207;
    den = den * a + 86.7807322029461;
    den = den * a + 296.564248779674;
    den = den * a + 637.333633378831;
    den = den * a + 793.826512519948;
    den = den * a + 440.413735824752;
    tail = (e * num) / den;
  } else {
    let b = a + 0.65;
    b = a + 4 / b;
    b = a + 3 / b;
    b = a + 2 / b;
    b = a + 1 / b;
    tail = e / b / 2.506628274631;
  }
  return x > 0 ? 1 - tail : tail;
}
